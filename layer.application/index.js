

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
  const W = rootRect.width || window.innerWidth;
  const H = rootRect.height || window.innerHeight;
  
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
    const btnTopFixed = 12;
    // ... calculate center pos
    const centerBaseX = (theme==='hleft') ? (W - 18 - Math.round(centerSize)) : 18; 
    const centerX = centerBaseX + 5;
    const centerTop = btnTopFixed;
    
    // Explicitly set center button pos for H layout
    if (center) {
        center.style.position = 'absolute';
        center.style.left = centerX + 'px';
        center.style.top = centerTop + 'px';
        center.style.zIndex = '100'; // Higher z-index
    }

    const centerY = btnTopFixed + Math.round(centerSize/2);
    const trayHeight = Math.max(Math.round(centerSize) + 8, 48);
    const bgHeight = Math.max(Math.round(centerSize) + 18, 56);
    // Align tray and background to the center of the button (centerY) instead of window center (cy)
    const bgTop = centerY - Math.round(bgHeight/2);
    const trayTop = centerY - Math.round(trayHeight/2);
    
    let bgLeft, bgWidth, trayLeft;
    const bgPadH = 8;
    bgWidth = centerSize + 24 + totalW + bgPadH * 2;
    
    if (dir < 0) { // hleft (tray to left of center)
       // Center is at centerX. Tray ends at centerX - 12
       trayLeft = centerX - 12 - totalW;
       bgLeft = trayLeft - bgPadH - 12;
       hTray.style.justifyContent = 'flex-end';
       hTray.style.paddingRight = '8px'; // Add padding near button
       hTray.style.paddingLeft = '0px';
    } else { // hright
       trayLeft = centerX + centerSize + 12;
       bgLeft = centerX - 12 - bgPadH - 12; 
       hTray.style.justifyContent = 'flex-start';
       hTray.style.paddingLeft = '8px'; // Add padding near button
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
        const isApp = String(it.actionType||'')==='app';
        try {
          // Fixed: closeApplicationsWindow is removed, performAction toggles launcher
          await window.compassAPI.pluginCall('screen-compass', 'performAction', [it]);
        } catch (e) {}
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
        const isApp = String(it.actionType||'')==='app';
        try {
          // Fixed: closeApplicationsWindow is removed, performAction toggles launcher
          await window.compassAPI.pluginCall('screen-compass', 'performAction', [it]);
        } catch (e) {}
        try { setExpanded(false); } catch (e) {}
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
     const bgWidth = centerSize + 24 + totalW + bgPadH * 2;
     
     reqW = bgWidth + margin*2; // No min width constraint, fit content
     reqH = Math.max(Math.round(centerSize)+18, 56) + margin*3;
     
     // ANCHOR CALCULATION
     // We need to tell main process where the "center" of the drag button is, relative to our window.
     // margin is 16.
     // centerTop = 12. centerY = 12 + centerSize/2.
     
     if (theme === 'hleft') {
         // Menu expands to LEFT. Button is on RIGHT.
         // Layout: [Items] [Gap] [Button]
         // From placeItems logic:
         // centerX = reqW - 18 - centerSize + 5 = reqW - 13 - centerSize
         // Button Center X = centerX + centerSize/2
         offX = Math.floor(reqW - 13 - centerSize/2);
     } else {
         // Menu expands to RIGHT. Button is on LEFT.
         // From placeItems logic:
         // centerX = 18 + 5 = 23
         // Button Center X = 23 + centerSize/2
         offX = Math.floor(23 + centerSize/2);
     }
     
     offY = Math.floor(12 + centerSize/2);
     
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

// Handle center button drag manually
let isWinDragging = false;
let winStartScreenX = 0;
let winStartScreenY = 0;
let winInitialPos = null;
const WIN_DRAG_THRESHOLD = 5;

center.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click
    
    isWinDragging = false;
    winStartScreenX = e.screenX;
    winStartScreenY = e.screenY;
    winInitialPos = null;
    
    document.addEventListener('mousemove', onCenterMouseMove);
    document.addEventListener('mouseup', onCenterMouseUp);
    
    (async () => {
        try {
            const res = await window.compassAPI.pluginCall('screen-compass', 'getDragWinPos');
            if (res && res.result) winInitialPos = res.result;
            else winInitialPos = null;
        } catch (e) { winInitialPos = null; }
    })();
});

function onCenterMouseMove(e) {
    const dx = e.screenX - winStartScreenX;
    const dy = e.screenY - winStartScreenY;
    
    if (!isWinDragging && (Math.abs(dx) > WIN_DRAG_THRESHOLD || Math.abs(dy) > WIN_DRAG_THRESHOLD)) {
        isWinDragging = true;
        // Collapse if expanded when drag starts
        if (expanded) {
            setExpanded(false);
            try { window.compassAPI.pluginCall('screen-compass', 'closeMenu', []); } catch(e){}
        }
    }
    
    if (isWinDragging && winInitialPos) {
        const newX = winInitialPos.x + dx;
        const newY = winInitialPos.y + dy;
        try { window.compassAPI.pluginCall('screen-compass', 'moveDragWin', [newX, newY]); } catch(e){}
    }
}

function onCenterMouseUp(e) {
    document.removeEventListener('mousemove', onCenterMouseMove);
    document.removeEventListener('mouseup', onCenterMouseUp);
    
    if (!isWinDragging) {
        // Treat as click
        if (expanded) {
             setExpanded(false);
             try { window.compassAPI.pluginCall('screen-compass', 'closeMenu', []); } catch(e){}
        } else {
             setExpanded(true);
             try { window.compassAPI.pluginCall('screen-compass', 'openMenu', []); } catch(e){}
        }
    }
    isWinDragging = false;
    winInitialPos = null;
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
        showDragHint();
        isDragging = false; // Show once per drag attempt
    }
});

root.addEventListener('pointerup', () => { isDragging = false; });
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
