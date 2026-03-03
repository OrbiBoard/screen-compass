

const ring = document.getElementById('ring');
const compassContainer = document.getElementById('compass-container');
const center = document.getElementById('center');
const dragHint = document.getElementById('drag-hint');

let expanded = false;
let items = [];
const scope = 'screen-compass';
const altScope = 'screen-compass';
let theme = 'sector';
let activeIndex = -1;
let sizeCollapsed = 60;
let sizeExpanded = 240;
let centerSize = 50;
let centerIcon = 'ri-compass-3-line';
let appActive = false;

// Update center button icon
function updateCenterIcon() {
  try {
    center.style.width = centerSize + 'px';
    center.style.height = centerSize + 'px';
    center.style.lineHeight = centerSize + 'px';
    const iconSize = Math.round(centerSize * 0.44) + 'px';
    const isH = (theme==='hleft' || theme==='hright');
    const collapseIcon = isH ? (theme==='hleft' ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line') : 'ri-close-line';
    const v = expanded ? collapseIcon : centerIcon; // In menu layer, it is always expanded conceptually when shown, but we use 'expanded' state for layout.
    // Actually, menu layer IS only shown when expanded. So it should show collapse icon.
    
    if (String(v||'').startsWith('ri-')) {
        center.innerHTML = `<i class="${v}" style="font-size: ${iconSize}"></i>`;
    } else {
        center.innerHTML = `<img src="${v}" style="width: ${iconSize}; height: ${iconSize}; object-fit: contain; border-radius: 4px;" />`;
    }
    
    // Position center button for Horizontal themes
    if (isH) {
        const rootRect = (document.getElementById('root')?.getBoundingClientRect?.()) || { width: 0 };
        const W = rootRect.width || window.innerWidth;
        const dir = (theme==='hleft') ? -1 : 1;
        const nearMargin = 18;
        const centerShift = 5;
        // The container is centered, so we need to offset 'center'
        // Actually, placeItems handles layout. We should just ensure center style is correct.
        // placeItems sets center position for H themes.
    } else {
        center.style.position = ''; center.style.left = ''; center.style.top = '';
    }
  } catch (e) {}
}

async function ensureDefaults() {
  const defaults = { buttons: [ { id: 'rollcall', label: '随机点名', icon: 'ri-shuffle-line', actionType: 'plugin', actionPayload: { pluginId: 'rollcall-random', fn: 'openRollcallTemplate', args: [] } } ] };
  try { await window.compassAPI.configEnsureDefaults(scope, defaults); } catch (e) {}
  try { await window.compassAPI.configEnsureDefaults(scope, { sizeCollapsed: 60, sizeExpanded: 240, centerSize: 50, centerIcon: 'ri-compass-3-line' }); } catch (e) {}
  try { await window.compassAPI.configEnsureDefaults(altScope, defaults); } catch (e) {}
  try { await window.compassAPI.configEnsureDefaults(altScope, { sizeCollapsed: 60, sizeExpanded: 240, centerSize: 50, centerIcon: 'ri-compass-3-line' }); } catch (e) {}
}

async function loadItems() {
  try { let raw = await window.compassAPI.configGet(scope, 'buttons'); const list = (raw && raw.result) ? raw.result : raw; items = Array.isArray(list) ? list : []; if (!items.length) { try { raw = await window.compassAPI.configGet(altScope, 'buttons'); const list2 = (raw && raw.result) ? raw.result : raw; items = Array.isArray(list2) ? list2 : items; } catch (e) {} } } catch (e) { items = []; }
  try { let t = await window.compassAPI.configGet(scope, 'theme'); let v = (t && t.result) ? t.result : t; theme = ['classic','sector','hleft','hright'].includes(v)?v:'classic'; if (!t) { try { t = await window.compassAPI.configGet(altScope, 'theme'); v = (t && t.result) ? t.result : t; theme = ['classic','sector','hleft','hright'].includes(v)?v:theme; } catch (e) {} } } catch (e) { theme = 'classic'; }
  try { await window.compassAPI.pluginCall('screen-compass', 'updateTheme', [theme]); } catch(e){}
  try { let v = await window.compassAPI.configGet(scope, 'sizeCollapsed'); sizeCollapsed = Number((v && v.result) ? v.result : v) || 60; if (!v) { try { v = await window.compassAPI.configGet(altScope, 'sizeCollapsed'); sizeCollapsed = Number((v && v.result) ? v.result : v) || sizeCollapsed; } catch (e) {} } } catch (e) { sizeCollapsed = 60; }
  try { let v = await window.compassAPI.configGet(scope, 'sizeExpanded'); sizeExpanded = Number((v && v.result) ? v.result : v) || 240; if (!v) { try { v = await window.compassAPI.configGet(altScope, 'sizeExpanded'); sizeExpanded = Number((v && v.result) ? v.result : v) || sizeExpanded; } catch (e) {} } } catch (e) { sizeExpanded = 240; }
  try { let v = await window.compassAPI.configGet(scope, 'centerSize'); centerSize = Number((v && v.result) ? v.result : v) || 50; if (!v) { try { v = await window.compassAPI.configGet(altScope, 'centerSize'); centerSize = Number((v && v.result) ? v.result : v) || centerSize; } catch (e) {} } } catch (e) { centerSize = 50; }
  try { let v = await window.compassAPI.configGet(scope, 'centerIcon'); centerIcon = String((v && v.result) ? v.result : v || 'ri-compass-3-line'); if (!v) { try { v = await window.compassAPI.configGet(altScope, 'centerIcon'); const vv = (v && v.result) ? v.result : v; centerIcon = String(vv || centerIcon || 'ri-compass-3-line'); } catch (e) {} } } catch (e) { centerIcon = 'ri-compass-3-line'; }
  
  // Constrain sizes
  try { 
      centerSize = Math.max(32, Math.min(160, Number(centerSize || 50))); 
      sizeCollapsed = Math.max(40, Math.min(240, Number(sizeCollapsed || (centerSize + 10)))); 
      // Ensure expanded is big enough
      sizeExpanded = Math.max(200, Number(sizeExpanded || 240));
      
      // Sync sizeCollapsed to backend to prevent clipping
      await window.compassAPI.pluginCall('screen-compass', 'resizeDragWin', [sizeCollapsed, sizeCollapsed]);
  } catch (e) {}
}

function updateWindowShape() {
  try {
    const rects = [];
    if (theme === 'sector' || theme === 'classic') {
         const ring = document.getElementById('ring');
         if (ring && !ring.classList.contains('hidden')) {
             const items = ring.children;
             for (let i=0; i<items.length; i++) {
                 const r = items[i].getBoundingClientRect();
                 rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
             }
         }
    } else {
         const hTrayBg = document.getElementById('hTrayBg');
         if (expanded && hTrayBg && hTrayBg.style.display !== 'none') {
             const r = hTrayBg.getBoundingClientRect();
             rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
         }
    }
    window.compassAPI.pluginCall('screen-compass', 'setWindowShape', ['application', rects]);
  } catch (e) {}
}

function placeItems() {
  ring.innerHTML = '';
  const rootEl = document.getElementById('root');
  const sectors = document.getElementById('sectors'); sectors.innerHTML = '';
  const hTray = document.getElementById('hTray'); hTray.innerHTML = '';
  const hTrayBg = document.getElementById('hTrayBg'); if (hTrayBg) { try { while (hTrayBg.firstChild) hTrayBg.removeChild(hTrayBg.firstChild); } catch (e) {} }
  const circleBg = document.getElementById('circleBg');
  const rootRect = (document.getElementById('root')?.getBoundingClientRect?.()) || { width: 0, height: 0 };
  
  const isHTheme = (theme==='hleft' || theme==='hright');
  let W = rootRect.width || window.innerWidth;
  let H = rootRect.height || window.innerHeight;
  
  // For horizontal theme in expanded state, calculate expected size
  if (isHTheme && expanded) {
      const N = items.length;
      const itemWidth = 56; const gap = 8; const pad = 16;
      const totalW = (N>0)? (N*itemWidth + Math.max(0, N-1)*gap + pad) : pad;
      const bgPadH = 8;
      const margin = 24;
      const vMargin = 16;
      const expectedW = totalW + 12 + centerSize + bgPadH * 2 + margin * 2;
      const expectedH = Math.max(Math.round(centerSize) + 24, 60) + vMargin * 2;
      // Use expected size if current size is too small
      if (W < expectedW - 10) W = expectedW;
      if (H < expectedH - 10) H = expectedH;
  }
  
  if (W < 40 || H < 40) { try { setTimeout(placeItems, 50); } catch (e) {} return; }
  
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  let R = Math.min(cx, cy) - 24; if (R < 22) R = 22;
  const N = items.length;
  
  try { rootEl.classList.toggle('sector', theme==='sector'); rootEl.classList.toggle('classic', theme==='classic'); } catch (e) {}
  
  const isH = (theme==='hleft' || theme==='hright');
  try { hTray.style.display = isH ? 'flex' : 'none'; } catch (e) {}
  try { if (hTrayBg) hTrayBg.style.display = (isH && expanded) ? 'block' : 'none'; } catch (e) {}
  try { if (circleBg) circleBg.style.display = isH ? 'none' : 'block'; } catch (e) {}
  
  if (theme === 'sector' && N > 0) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('width','100%'); svg.setAttribute('height','100%'); svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    const ro = Math.min(R + 14, Math.min(cx, cy) - 10);
    const centerR = 25;
    const ri = Math.max(centerR + 8, Math.round(R * 0.5));
    for (let i = 0; i < N; i++) {
      const a1 = (Math.PI * 2) * (i / N);
      const a2 = (Math.PI * 2) * ((i + 1) / N);
      const o1x = Math.round(cx + ro * Math.cos(a1));
      const o1y = Math.round(cy + ro * Math.sin(a1));
      const o2x = Math.round(cx + ro * Math.cos(a2));
      const o2y = Math.round(cy + ro * Math.sin(a2));
      const i2x = Math.round(cx + ri * Math.cos(a2));
      const i2y = Math.round(cy + ri * Math.sin(a2));
      const i1x = Math.round(cx + ri * Math.cos(a1));
      const i1y = Math.round(cy + ri * Math.sin(a1));
      const largeArc = ((a2 - a1) % (Math.PI*2)) > Math.PI ? 1 : 0;
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const d = `M ${o1x} ${o1y} A ${ro} ${ro} 0 ${largeArc} 1 ${o2x} ${o2y} L ${i2x} ${i2y} A ${ri} ${ri} 0 ${largeArc} 0 ${i1x} ${i1y} Z`;
      path.setAttribute('d', d); path.setAttribute('fill','rgba(64,128,255,0.18)'); path.setAttribute('stroke','rgba(64,128,255,0.32)'); path.setAttribute('stroke-width','1'); path.style.opacity = (expanded && activeIndex === i) ? '1' : '0'; path.setAttribute('class','wedge'); path.dataset.index = String(i);
      path.addEventListener('mouseenter', () => { if (!expanded) return; activeIndex = i; try { path.style.opacity = '1'; } catch (e) {} });
      path.addEventListener('mouseleave', () => { if (!expanded) return; activeIndex = -1; try { path.style.opacity = '0'; } catch (e) {} });
      path.addEventListener('click', async () => { if (!expanded) return; const it = items[i]; try { await window.compassAPI.pluginCall('screen-compass', 'performAction', [it]); } catch (e) {} try { setExpanded(false); } catch (e) {} });
      svg.appendChild(path);
    }
    sectors.appendChild(svg);
    try { sectors.style.pointerEvents = expanded ? 'auto' : 'none'; } catch (e) {}
  }
  
  if (isH) {
    const itemWidth = 56; const gap = 8; const pad = 16; const totalW = (N>0)? (N*itemWidth + Math.max(0, N-1)*gap + pad) : pad;
    const dir = (theme==='hleft') ? -1 : 1;
    
    let centerX, centerTop, centerY;
    
    if (!expanded) {
        // Collapsed state: center the button in the small window
        centerX = Math.floor((W - centerSize) / 2);
        centerTop = Math.floor((H - centerSize) / 2);
        centerY = centerTop + Math.round(centerSize / 2);
    } else {
        // Expanded state: position button at edge for horizontal expansion
        // Use smaller vertical margin for horizontal theme
        const vMargin = 16;
        const margin = 24;
        const btnTopFixed = vMargin + 12;
        const centerBaseX = (theme==='hleft') ? (W - margin - 18 - Math.round(centerSize)) : (margin + 18); 
        centerX = centerBaseX + 5;
        centerTop = btnTopFixed;
        centerY = btnTopFixed + Math.round(centerSize/2);
    }
    
    // Explicitly set center button pos for H layout
    if (center) {
        center.style.position = 'absolute';
        center.style.left = centerX + 'px';
        center.style.top = centerTop + 'px';
        center.style.zIndex = '100'; // Higher z-index
    }
    const trayHeight = Math.max(Math.round(centerSize) + 8, 48);
    const bgHeight = Math.max(Math.round(centerSize) + 18, 56);
    // Align tray and background to the center of the button (centerY) instead of window center (cy)
    const bgTop = centerY - Math.round(bgHeight/2);
    const trayTop = centerY - Math.round(trayHeight/2);
    
    let bgLeft, bgWidth, trayLeft;
    const bgPadH = 8;
    bgWidth = totalW + 12 + centerSize + bgPadH * 2;
    
    if (dir < 0) { // hleft (tray to left of center)
       // Center is at centerX. Tray ends at centerX - 12
       trayLeft = centerX - 12 - totalW;
       bgLeft = trayLeft - bgPadH;
       hTray.style.justifyContent = 'flex-end';
       hTray.style.paddingRight = '8px';
       hTray.style.paddingLeft = '0px';
    } else { // hright
       trayLeft = centerX + centerSize + 12;
       bgLeft = trayLeft - bgPadH;
       hTray.style.justifyContent = 'flex-start';
       hTray.style.paddingLeft = '8px';
       hTray.style.paddingRight = '0px';
    }
    
    hTray.style.left = (trayLeft + 3) + 'px';
    hTray.style.top = (trayTop + 1) + 'px';
    hTray.style.height = trayHeight + 'px';
    // Increase tray width to accommodate padding without shrinking content?
    // Box-sizing is not set for htray, so padding adds to width.
    // We set width to totalW. If we add padding, actual width becomes totalW + 8.
    // This might overlap?
    // Let's set box-sizing to border-box.
    hTray.style.boxSizing = 'border-box';
    hTray.style.width = totalW + 'px';
    
    if (hTrayBg) {
        hTrayBg.style.display = expanded ? 'block' : 'none';
        hTrayBg.style.left = bgLeft + 'px';
        hTrayBg.style.top = bgTop + 'px';
        hTrayBg.style.width = bgWidth + 'px';
        hTrayBg.style.height = bgHeight + 'px';
        hTrayBg.style.borderRadius = Math.round(bgHeight/2) + 'px';
    }

    for (let i = 0; i < N; i++) {
      const it = items[i];
      const div = document.createElement('div');
      div.className = 'item';
      if (appActive && String(it.actionType||'')==='app') { try { div.classList.add('active'); } catch (e) {} }
      const labelText = String(it.label || '').trim();
      const icStr = String(it.icon || '');
      const useIcon = icStr.startsWith('ri-') ? `<i class="${icStr}"></i>` : `<img src="${icStr}" style="width:20px;height:20px;object-fit:contain;border-radius:4px;" />`;
      div.innerHTML = `${useIcon}<div class="label">${labelText}</div>`;
      div.addEventListener('click', async () => {
        if (!expanded) return;
        try {
          await window.compassAPI.pluginCall('screen-compass', 'performAction', [it]);
        } catch (e) {}
        setExpanded(false);
        try { window.compassAPI.pluginCall('screen-compass', 'closeMenu', []); } catch(e){}
      });
      hTray.appendChild(div);
    }
  } else {
    // Classic/Sector (Radial)
    for (let i = 0; i < N; i++) {
      const it = items[i]; const centerR = 25; let x = 0; let y = 0; { const a = (Math.PI * 2) * ((i + 0.5) / Math.max(N, 1)); const ro2 = Math.min(R + 14, Math.min(cx, cy) - 10); const ri2 = Math.max(centerR + 8, Math.round(R * 0.5)); const RB = Math.round((ro2 + ri2) / 2); x = Math.round(cx + RB * Math.cos(a)); y = Math.round(cy + RB * Math.sin(a)); }
      const div = document.createElement('div'); div.className = 'item'; div.style.position = 'absolute'; const halfW = (theme === 'classic') ? 28 : 22; const halfH = 29; x = Math.max(halfW, Math.min(W - halfW, x)); y = Math.max(halfH+1, Math.min(H - (halfH+1), y)); div.style.left = (x - halfW) + 'px'; div.style.top = (y - halfH) + 'px'; div.title = it.label || ''; const labelText = String(it.label || '').trim(); const icStr = String(it.icon || ''); const useIcon = icStr.startsWith('ri-') ? `<i class="${icStr}"></i>` : `<img src="${icStr}" style="width:20px;height:20px;object-fit:contain;border-radius:4px;" />`; if (theme === 'classic') { div.innerHTML = `<div class="dot">${useIcon}<div class="label">${labelText}</div></div>`; } else { div.innerHTML = `${useIcon}<div class="label">${labelText}</div>`; }
      if (appActive && String(it.actionType||'')==='app') { try { div.classList.add('active'); } catch (e) {} }
      const updateWedgesOpacity = () => { try { const wedges = sectors.querySelectorAll('.wedge'); wedges.forEach((w)=>{ const idx = Number(w.dataset.index||-1); w.style.opacity = (expanded && idx===activeIndex) ? '1' : '0'; }); } catch (e) {} };
      div.addEventListener('mouseenter', () => { activeIndex = i; updateWedgesOpacity(); });
      div.addEventListener('mouseleave', () => { activeIndex = -1; updateWedgesOpacity(); });
      div.addEventListener('click', async () => {
        if (!expanded) return;
        try {
          await window.compassAPI.pluginCall('screen-compass', 'performAction', [it]);
        } catch (e) {}
        setExpanded(false);
        try { window.compassAPI.pluginCall('screen-compass', 'closeMenu', []); } catch(e){}
      });
      ring.appendChild(div);
    }
  }

  // Calculate required window size and center offset
  const margin = 24;
  let reqW = 240, reqH = 240, offX = 120, offY = 120;
  
  if (isH) {
     // For Horizontal:
     // centerSize, totalW (items), gap, pads
     const itemWidth = 56; const gap = 8; const pad = 24; 
     const totalW = (N>0)? (N*itemWidth + Math.max(0, N-1)*gap + pad) : pad;
     const bgPadH = 8;
     
     // Full width includes center button + spacing + tray
     // spacing is 12px between center and tray (or tray end)
     const bgWidth = totalW + 12 + centerSize + bgPadH * 2;
     
     reqW = bgWidth + margin*2;
     // Height: just enough for button with small padding
     const vMargin = 16;
     reqH = Math.max(Math.round(centerSize) + 24, 60) + vMargin * 2;
     
     // ANCHOR CALCULATION
     // We need to tell main process where the "center" of the drag button is, relative to our window.
     
     if (theme === 'hleft') {
         // Menu expands to LEFT. Button is on RIGHT.
         // Layout: [Items] [Gap] [Button]
         // From placeItems logic:
         // centerX = reqW - margin - 18 - centerSize + 5 = reqW - margin - 13 - centerSize
         // Button Center X = centerX + centerSize/2
         offX = Math.floor(reqW - margin - 13 - centerSize/2);
     } else {
         // Menu expands to RIGHT. Button is on LEFT.
         // From placeItems logic:
         // centerX = margin + 18 + 5 = margin + 23
         // Button Center X = centerX + centerSize/2
         offX = Math.floor(margin + 23 + centerSize/2);
     }
     
     offY = Math.floor(vMargin + 12 + centerSize/2);
     
  } else {
     // Radial
     const d = sizeExpanded + margin*2;
     reqW = d; 
     reqH = d;
     offX = Math.floor(reqW / 2);
     offY = Math.floor(reqH / 2);
  }
  
  try {
     // Send reqW, reqH, and ANCHOR POINTS (offX, offY)
     window.compassAPI.pluginCall('screen-compass', 'setSize', [reqW, reqH, offX, offY]);
  } catch(e) {}
  
  // Fix drag hint position for circle theme
  if (dragHint) {
      if (isH) {
          dragHint.style.bottom = '20px';
          dragHint.style.top = '';
          dragHint.style.transform = 'translateX(-50%)';
      } else {
          // Place below center button
          dragHint.style.bottom = '';
          dragHint.style.top = '50%';
          dragHint.style.transform = 'translateX(-50%) translateY(32px)';
          dragHint.style.width = 'max-content';
      }
  }
  setTimeout(updateWindowShape, 50);
}

function __fadeSet(el, v){ try { if (!el) return; el.style.transition = 'opacity .16s ease'; el.style.opacity = String(v); } catch (e) {} }
function __fadeOutAll(){ try { const r=document.getElementById('ring'); const s=document.getElementById('sectors'); const ht=document.getElementById('hTray'); const hb=document.getElementById('hTrayBg'); const cb=document.getElementById('circleBg'); __fadeSet(r, 0); __fadeSet(s, 0); __fadeSet(ht, 0); __fadeSet(hb, 0); __fadeSet(cb, 0); } catch (e) {} }
function __fadeInAll(){ try { const isH = (theme==='hleft' || theme==='hright'); const r=document.getElementById('ring'); const s=document.getElementById('sectors'); const ht=document.getElementById('hTray'); const hb=document.getElementById('hTrayBg'); const cb=document.getElementById('circleBg'); __fadeSet(r, expanded ? 1 : 0); __fadeSet(s, expanded ? 1 : 0); if (isH) { __fadeSet(ht, expanded ? 1 : 0); __fadeSet(hb, expanded ? 1 : 0); __fadeSet(cb, 0); try { const dir = (theme==='hleft') ? -1 : 1; if (ht) ht.style.transform = expanded ? 'translateX(0px)' : (dir<0 ? 'translateX(12px)' : 'translateX(-12px)'); } catch (e) {} if (expanded && hb) { hb.style.background='rgba(20,28,40,0.62)'; hb.style.border='1px solid rgba(255,255,255,0.30)'; } } else { __fadeSet(ht, 0); __fadeSet(hb, 0); __fadeSet(cb, 1); if (cb) { if (expanded) { cb.style.background='rgba(20,28,40,0.44)'; cb.style.border='1px solid rgba(255,255,255,0.24)'; } else { cb.style.background='rgba(20,28,40,0.28)'; cb.style.border='1px solid rgba(255,255,255,0.18)'; } } } } catch (e) {} }

setExpanded = (on) => {
  expanded = !!on;
  __fadeOutAll();
  
  // Notify main process to close/hide window if collapsed?
  // Or main process controls visibility.
  // Here we just handle animation.
  
  placeItems();
  __fadeInAll();
  
  const nodes = Array.from(ring.children);
  nodes.forEach(n => { if (expanded) { n.classList.remove('hidden'); } else { n.classList.add('hidden'); } });
  
  if (expanded) resetInactivityTimer();
};

// Collapse for drag - only hide UI elements, don't re-render
function collapseForDrag() {
  if (!expanded) return;
  expanded = false;
  
  // Hide all expanded elements without re-rendering
  __fadeOutAll();
  
  // Hide ring items
  const nodes = Array.from(ring.children);
  nodes.forEach(n => { n.classList.add('hidden'); });
  
  // Update center icon
  updateCenterIcon();
}

// Handle center button drag - frontend controls everything, toplayer just manages shape
let isWinDragging = false;
let winStartScreenX = 0;
let winStartScreenY = 0;
let winInitialPos = null;
const WIN_DRAG_THRESHOLD = 5;
let toplayerDragActive = false;
let wasHThemeExpanded = false; // Track if horizontal theme was expanded before drag

// Cleanup function to ensure all listeners are removed
function cleanupDragListeners() {
    window.removeEventListener('mousemove', onCenterMouseMove);
    window.removeEventListener('mouseup', onCenterMouseUp);
    document.removeEventListener('mouseleave', onCenterMouseLeave);
    isWinDragging = false;
    toplayerDragActive = false;
    winInitialPos = null;
    wasHThemeExpanded = false;
    winStartScreenX = 0;
    winStartScreenY = 0;
}

// Subscribe to drag cancel event
try {
    window.compassAPI?.subscribe?.('widget.drag.cancel');
} catch (e) {}

// Listen for drag cancelled event from main process
window.compassAPI?.onEvent?.((name, payload) => {
    if (name === 'widget.drag.cancel') {
        console.log('[ScreenCompass Frontend] Drag cancelled, cleaning up');
        cleanupDragListeners();
    }
});

center.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click
    
    // Clean up any previous drag state first
    cleanupDragListeners();
    
    isWinDragging = false;
    toplayerDragActive = false;
    winStartScreenX = e.screenX;
    winStartScreenY = e.screenY;
    
    // Get initial position synchronously from cached state
    // The backend should have cached the position from last drag
    (async () => {
        try {
            const res = await window.compassAPI.pluginCall('screen-compass', 'getDragWinPos');
            if (res && res.result) winInitialPos = res.result;
        } catch (e) {}
    })();
    
    // Use window to capture events even when mouse leaves the element
    window.addEventListener('mousemove', onCenterMouseMove);
    window.addEventListener('mouseup', onCenterMouseUp);
    document.addEventListener('mouseleave', onCenterMouseLeave);
});

function onCenterMouseMove(e) {
    // Safety check: if we're not dragging, ignore
    if (!isWinDragging && winStartScreenX === 0 && winStartScreenY === 0) {
        return;
    }
    
    const dx = e.screenX - winStartScreenX;
    const dy = e.screenY - winStartScreenY;
    
    if (!isWinDragging && (Math.abs(dx) > WIN_DRAG_THRESHOLD || Math.abs(dy) > WIN_DRAG_THRESHOLD)) {
        isWinDragging = true;
        
        const isH = (theme === 'hleft' || theme === 'hright');
        
        if (expanded) {
            if (isH) {
                // Horizontal theme: only hide UI, keep state for restore after drag
                wasHThemeExpanded = true;
                collapseForDrag();
            } else {
                // Circle/Sector theme: fully collapse
                // setExpanded(false);
                collapseForDrag();
            }
        }
        
        // Notify toplayer to set fullscreen shape (enables mouse events outside widget)
        // Fire and forget - don't wait for response
        window.compassAPI.pluginCall('screen-compass', 'handleDrag', []).then(() => {
            toplayerDragActive = true;
        }).catch(err => {
            console.warn('[ScreenCompass] handleDrag failed:', err);
        });
    }
    
    // We handle the movement ourselves - use last known position if initial not set yet
    if (isWinDragging) {
        // If we don't have initial pos yet, use 0,0 as fallback (will be corrected once we get it)
        const baseX = winInitialPos ? winInitialPos.x : 0;
        const baseY = winInitialPos ? winInitialPos.y : 0;
        const newX = baseX + dx;
        const newY = baseY + dy;
        // Fire and forget for better responsiveness
        window.compassAPI.pluginCall('screen-compass', 'moveDragWin', [newX, newY]).catch(() => {});
    }
}

// Handle mouseleave - only end drag if not currently dragging
function onCenterMouseLeave(e) {
    // If we are dragging, don't end the drag - the user is moving fast
    // The drag will end when mouseup occurs
    if (isWinDragging) {
        return;
    }
    
    // Clean up listeners for non-drag state
    window.removeEventListener('mousemove', onCenterMouseMove);
    window.removeEventListener('mouseup', onCenterMouseUp);
    document.removeEventListener('mouseleave', onCenterMouseLeave);
}

function onCenterMouseUp(e) {
    // Always remove listeners first
    window.removeEventListener('mousemove', onCenterMouseMove);
    window.removeEventListener('mouseup', onCenterMouseUp);
    document.removeEventListener('mouseleave', onCenterMouseLeave);
    
    if (!isWinDragging) {
        // Treat as click
        if (expanded) {
             setExpanded(false);
             try { window.compassAPI.pluginCall('screen-compass', 'closeMenu', []); } catch(e){}
        } else {
             setExpanded(true);
             try { window.compassAPI.pluginCall('screen-compass', 'openMenu', []); } catch(e){}
        }
    } else if (toplayerDragActive) {
        // Notify toplayer to end drag and restore shape
        const dx = e.screenX - winStartScreenX;
        const dy = e.screenY - winStartScreenY;
        const finalX = winInitialPos ? winInitialPos.x + dx : undefined;
        const finalY = winInitialPos ? winInitialPos.y + dy : undefined;
        window.compassAPI.pluginCall('screen-compass', 'endDragFromFrontend', [finalX, finalY]).catch(() => {});
        
        // For horizontal theme: restore expanded state after drag
        // if (wasHThemeExpanded) {
            setExpanded(true);
            try { window.compassAPI.pluginCall('screen-compass', 'openMenu', []); } catch(e){}
        // }
    }
    
    // Reset all state
    isWinDragging = false;
    toplayerDragActive = false;
    winInitialPos = null;
    wasHThemeExpanded = false;
    winStartScreenX = 0;
    winStartScreenY = 0;
}

// Drag hint logic
let hintTimer = null;
const root = document.getElementById('root');

function showDragHint() {
    if (!dragHint) return;
    dragHint.style.opacity = '1';
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
        dragHint.style.opacity = '0';
    }, 2000);
}

// Intercept drags on root to show hint
let isDragging = false;
let startX = 0;
let startY = 0;

root.addEventListener('pointerdown', (e) => {
    // Ignore clicks on interactive elements
    if (e.target.closest('.item') || e.target.closest('.center-btn') || e.target.closest('.sectors')) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
});

root.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > 5 || dy > 5) {
        isDragging = false;
    }
});

root.addEventListener('pointerup', (e) => { 
    if (isDragging && expanded) {
        // Click on non-interactive area - close menu
        if (!e.target.closest('.item') && !e.target.closest('.center-btn') && !e.target.closest('.sectors')) {
            setExpanded(false);
            try { window.compassAPI.pluginCall('screen-compass', 'closeMenu', []); } catch(e){}
        }
    }
    isDragging = false; 
});
root.addEventListener('pointercancel', () => { isDragging = false; });

let inactivityTimer = null;
function resetInactivityTimer(){ try { if (theme==='hleft' || theme==='hright') return; if (inactivityTimer) clearTimeout(inactivityTimer); inactivityTimer = setTimeout(() => { if (expanded) { setExpanded(false); try { window.compassAPI.pluginCall('screen-compass', 'closeMenu', []); } catch(e){} } }, 30000); } catch (e) {} }

try { window.addEventListener('resize', () => { placeItems(); }); } catch (e) {}
(async function init(){ await ensureDefaults(); await loadItems(); placeItems(); setExpanded(false); updateCenterIcon(); })();

try { window.compassAPI.subscribe('screen-compass-channel'); } catch (e) {}
try { window.compassAPI.subscribe('widget.drag.end'); } catch (e) {}
try {
  window.compassAPI.onEvent(async (name, payload) => {
    if (name === 'widget.drag.end' && payload) {
        try { window.compassAPI.pluginCall('screen-compass', 'endDrag', [payload.x, payload.y]); } catch(e){}
        return;
    }
    if (name !== 'screen-compass-channel' || !payload) return;
    if (payload.type === 'buttons.update') {
      try { if (Array.isArray(payload.buttons)) { items = payload.buttons; } else { await loadItems(); } if (payload.theme) { const t = String(payload.theme); theme = ['classic','sector','hleft','hright'].includes(t)?t:theme; } if (payload.centerSize) { centerSize = Math.max(32, Math.min(160, Number(payload.centerSize) || centerSize)); sizeCollapsed = Math.max(40, Math.min(240, centerSize + 10)); } else if (payload.sizeCollapsed) { sizeCollapsed = Math.max(40, Math.min(240, Number(payload.sizeCollapsed) || sizeCollapsed)); centerSize = Math.max(32, Math.min(160, sizeCollapsed - 10)); } if (payload.sizeExpanded) sizeExpanded = Number(payload.sizeExpanded) || sizeExpanded; if (payload.centerIcon) centerIcon = String(payload.centerIcon) || centerIcon; 
      
      // Update window size dynamically
      if (!expanded) {
          await window.compassAPI.pluginCall('screen-compass', 'resizeDragWin', [sizeCollapsed, sizeCollapsed]);
      }
      } catch (e) {} placeItems(); setExpanded(expanded); updateCenterIcon(); }
    if (payload.type === 'app.active') { try { appActive = !!payload.active; } catch (e) { appActive = !!payload.active; } try { placeItems(); } catch (e) {} }
    if (payload.type === 'menu.toggle') { setExpanded(payload.expanded); updateCenterIcon(); }
  });
} catch (e) {}

// Click on root (empty space) closes menu
root.addEventListener('click', (e) => { 
    if (!expanded) return; 
    if (e.target === root) {
        setExpanded(false);
        try { window.compassAPI.pluginCall('screen-compass', 'closeMenu', []); } catch(e){}
    }
});
