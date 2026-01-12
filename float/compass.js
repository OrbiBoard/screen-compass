const center = document.getElementById('center');
const ring = document.getElementById('ring');
const compassContainer = document.getElementById('compass-container');

let expanded = false;
let items = [];
const scope = 'screen-compass';
const altScope = 'screen-compass';
let theme = 'classic';
let activeIndex = -1;
let toggleLock = false;
let sizeCollapsed = 60;
let sizeExpanded = 240;
let centerSize = 50;
let centerIcon = 'ri-compass-3-line';
let hAnchorLeft = null; let hAnchorTop = null;
let appActive = false;

let dragStartBounds = null;
let dragStartMouseX = 0;
let dragStartMouseY = 0;

function setContainerStyle(active, x, y) {
  if (active) {
    compassContainer.style.position = 'absolute';
    compassContainer.style.left = x + 'px';
    compassContainer.style.top = y + 'px';
    const w = expanded ? sizeExpanded : sizeCollapsed;
    const h = expanded ? sizeExpanded : sizeCollapsed;
    compassContainer.style.width = w + 'px';
    compassContainer.style.height = h + 'px';
  } else {
    compassContainer.style.position = 'relative';
    compassContainer.style.left = '';
    compassContainer.style.top = '';
    compassContainer.style.width = '100%';
    compassContainer.style.height = '100%';
    compassContainer.style.transform = '';
  }
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
  try { let v = await window.compassAPI.configGet(scope, 'sizeCollapsed'); sizeCollapsed = Number((v && v.result) ? v.result : v) || 60; if (!v) { try { v = await window.compassAPI.configGet(altScope, 'sizeCollapsed'); sizeCollapsed = Number((v && v.result) ? v.result : v) || sizeCollapsed; } catch (e) {} } } catch (e) { sizeCollapsed = 60; }
  try { let v = await window.compassAPI.configGet(scope, 'sizeExpanded'); sizeExpanded = Number((v && v.result) ? v.result : v) || 240; if (!v) { try { v = await window.compassAPI.configGet(altScope, 'sizeExpanded'); sizeExpanded = Number((v && v.result) ? v.result : v) || sizeExpanded; } catch (e) {} } } catch (e) { sizeExpanded = 240; }
  try { let v = await window.compassAPI.configGet(scope, 'centerSize'); centerSize = Number((v && v.result) ? v.result : v) || 50; if (!v) { try { v = await window.compassAPI.configGet(altScope, 'centerSize'); centerSize = Number((v && v.result) ? v.result : v) || centerSize; } catch (e) {} } } catch (e) { centerSize = 50; }
  try { let v = await window.compassAPI.configGet(scope, 'centerIcon'); centerIcon = String((v && v.result) ? v.result : v || 'ri-compass-3-line'); if (!v) { try { v = await window.compassAPI.configGet(altScope, 'centerIcon'); const vv = (v && v.result) ? v.result : v; centerIcon = String(vv || centerIcon || 'ri-compass-3-line'); } catch (e) {} } } catch (e) { centerIcon = 'ri-compass-3-line'; }
  try { centerSize = Math.max(32, Math.min(160, Number(centerSize || 50))); sizeCollapsed = Math.max(40, Math.min(240, Number(sizeCollapsed || (centerSize + 10)))); centerSize = Math.max(32, Math.min(160, Number(sizeCollapsed - 10))); sizeCollapsed = Math.max(40, Math.min(240, Number(centerSize + 10))); } catch (e) {}
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
  const W = isHTheme
    ? Math.max(centerSize + 24, Math.floor(rootRect.width || window.innerWidth || document.documentElement.clientWidth || (centerSize + 24)))
    : Math.max(200, Math.floor(rootRect.width || window.innerWidth || document.documentElement.clientWidth || 240));
  const H = isHTheme
    ? Math.max(centerSize + 24, Math.floor(rootRect.height || window.innerHeight || document.documentElement.clientHeight || (centerSize + 24)))
    : Math.max(200, Math.floor(rootRect.height || window.innerHeight || document.documentElement.clientHeight || 240));
  if (W < 40 || H < 40) { try { setTimeout(placeItems, 50); } catch (e) {} return; }
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  let R = Math.min(cx, cy) - 24; if (R < 22) R = 22;
  const N = items.length;
  try { rootEl.classList.toggle('sector', theme==='sector'); rootEl.classList.toggle('classic', theme==='classic'); } catch (e) {}
  const centerEl = document.getElementById('center');
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
    let centerLeft, centerTop;
    const nearMargin = 18;
    const centerShift = 5;
    const centerBaseX = (theme==='hleft') ? (W - nearMargin - Math.round(centerSize)) : nearMargin;
    const centerX = centerBaseX + centerShift;
    centerLeft = centerX; centerTop = btnTopFixed;
    try { centerEl.style.position = 'absolute'; centerEl.style.left = centerLeft + 'px'; centerEl.style.top = centerTop + 'px'; centerEl.style.display = 'flex'; centerEl.style.alignItems = 'center'; centerEl.style.justifyContent = 'center'; centerEl.style.zIndex = '3'; } catch (e) {}
    const centerY = btnTopFixed + Math.round(centerSize/2);
    const trayHeight = Math.max(Math.round(centerSize) + 8, 48);
    const bgHeight = Math.max(Math.round(centerSize) + 18, 56);
    const bgTop = Math.max(0, centerY - Math.round(bgHeight/2));
    const trayTop = Math.max(0, bgTop + Math.round((bgHeight - trayHeight) / 2));
    let bgLeft, bgWidth, trayLeft;
    if (expanded) {
      const bgPadH = 8;
      bgWidth = centerSize + 24 + totalW + bgPadH * 2;
      if (dir < 0) {
        const bgPadH2 = 8;
        const trayShift = 3;
        const trayLeftBase = Math.max(0, centerBaseX - (totalW + 16));
        trayLeft = trayLeftBase + trayShift;
        bgLeft = Math.max(0, trayLeftBase - bgPadH2);
        hTray.style.left = trayLeft + 'px';
        hTray.style.top = trayTop + 'px';
        hTray.style.height = trayHeight + 'px';
        hTray.style.width = totalW + 'px';
        try { hTray.style.justifyContent = 'flex-end'; } catch (e) {}
        try { hTray.style.zIndex = '2'; } catch (e) {}
      } else {
        const bgPadH2 = 8;
        bgLeft = Math.max(0, centerBaseX - 12 - bgPadH2);
        const trayShift = 3;
        const trayLeftBase = 74;
        trayLeft = trayLeftBase + trayShift;
        hTray.style.left = trayLeft + 'px';
        hTray.style.top = trayTop + 'px';
        hTray.style.height = trayHeight + 'px';
        hTray.style.width = totalW + 'px';
        try { hTray.style.justifyContent = 'flex-start'; } catch (e) {}
        try { hTray.style.zIndex = '2'; } catch (e) {}
      }
    } else {
      bgLeft = centerLeft;
      bgWidth = centerSize + 24;
      try {
        hTray.style.top = trayTop + 'px';
        hTray.style.height = trayHeight + 'px';
        hTray.style.width = '0px';
      } catch (e) {}
    }
    if (hTrayBg) {
      try {
        if (expanded) {
          hTrayBg.style.display = 'block';
          hTrayBg.style.left = Math.max(0, bgLeft) + 'px';
          hTrayBg.style.top = bgTop + 'px';
          hTrayBg.style.width = bgWidth + 'px';
          hTrayBg.style.height = bgHeight + 'px';
          hTrayBg.style.background = 'rgba(20,28,40,0.52)';
          hTrayBg.style.border = '1px solid rgba(255,255,255,0.28)';
          hTrayBg.style.borderRadius = Math.round(bgHeight/2) + 'px';
          try { hTrayBg.style.zIndex = '1'; } catch (e) {}
        }
      } catch (e) {}
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
          if (isApp && appActive) { await window.compassAPI.pluginCall('screen-compass','closeApplicationsWindow',[]); }
          else { await window.compassAPI.pluginCall('screen-compass', 'performAction', [it]); }
        } catch (e) {}
      });
      hTray.appendChild(div);
    }
  } else {
    // reset center to default (flex center) for non-horizontal themes
    try { centerEl.style.position = ''; centerEl.style.left = ''; centerEl.style.top = ''; } catch (e) {}
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
          if (isApp && appActive) { await window.compassAPI.pluginCall('screen-compass','closeApplicationsWindow',[]); }
          else { await window.compassAPI.pluginCall('screen-compass', 'performAction', [it]); }
        } catch (e) {}
        try { setExpanded(false); } catch (e) {}
      });
      ring.appendChild(div);
    }
  }
}

function setExpanded(on) {
  expanded = !!on;
  try { const centerEl = document.getElementById('center'); const rootEl = document.getElementById('root'); const isH = (theme==='hleft' || theme==='hright'); if (isH) { if (!expanded) { const cr = centerEl.getBoundingClientRect(); const rr = rootEl.getBoundingClientRect(); hAnchorLeft = Math.max(0, Math.round(cr.left - rr.left)); hAnchorTop = Math.max(0, Math.round(cr.top - rr.top)); } } else { hAnchorLeft=null; hAnchorTop=null; } } catch (e) {}
  const nodes = Array.from(ring.children);
  nodes.forEach(n => { if (expanded) { n.classList.remove('hidden'); } else { n.classList.add('hidden'); } });
  try { const hTray = document.getElementById('hTray'); const hTrayBg = document.getElementById('hTrayBg'); const isH = (theme==='hleft' || theme==='hright'); hTray.style.opacity = expanded ? '1' : '0'; hTray.style.pointerEvents = expanded ? 'auto' : 'none'; hTray.style.display = isH ? 'flex' : 'none'; if (hTrayBg) hTrayBg.style.display = (isH && expanded) ? 'block' : 'none'; } catch (e) {}
  try { const hTray = document.getElementById('hTray'); const hTrayBg = document.getElementById('hTrayBg'); const isH = (theme==='hleft' || theme==='hright'); hTray.style.opacity = expanded ? '1' : '0'; hTray.style.pointerEvents = expanded ? 'auto' : 'none'; hTray.style.display = isH ? 'flex' : 'none'; if (hTrayBg) hTrayBg.style.display = (isH && expanded) ? 'block' : 'none'; } catch (e) {}
}

center.addEventListener('click', () => { if (dragging || justDragged || toggleLock) return; toggleLock = true; setExpanded(!expanded); setTimeout(() => { toggleLock = false; }, 160); });

let inactivityTimer = null;
function resetInactivityTimer(){ try { if (theme==='hleft' || theme==='hright') return; if (inactivityTimer) clearTimeout(inactivityTimer); inactivityTimer = setTimeout(() => { if (expanded) setExpanded(false); }, 30000); } catch (e) {} }

let dragging = false; let startScreenX = 0; let startScreenY = 0; let lastScreenX = 0; let lastScreenY = 0; let lastClientX = 0; let lastClientY = 0; let moved = false; let justDragged = false; let rafScheduled = false; let nextX = 0; let nextY = 0; let downClientX = 0; let downClientY = 0; let boundsReady = false;
function getCentroid(touches) {
  if (!touches || touches.length === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (let i = 0; i < touches.length; i++) {
    sx += touches[i].screenX;
    sy += touches[i].screenY;
  }
  return { x: sx / touches.length, y: sy / touches.length };
}
let lastTouchCentroid = { x: 0, y: 0 };
let startTouchCentroid = { x: 0, y: 0 };
let lastEffectiveTouchCentroid = { x: 0, y: 0 };
let startWinX = 0; let startWinY = 0; // The initial window position when drag starts
let currentWinX = 0; let currentWinY = 0; // The calculated current window position (to be smooth)
let touchWinX = 0; let touchWinY = 0; // (Unused in new logic but kept for compatibility if needed)

function handleTouchStart(e) {
  if (e.touches.length === 0) return;
  resetInactivityTimer();
  
  const c = getCentroid(e.touches);
  const isFirst = (e.touches.length === 1);
  
  if (isFirst) {
    dragging = true;
    moved = false;
    boundsReady = false;
    
    lastTouchCentroid = c;
    startTouchCentroid = c;
    lastEffectiveTouchCentroid = c;
    
    window.compassAPI.getBounds().then((raw) => {
      const b = (raw && raw.result) ? raw.result : raw;
      dragStartBounds = b;
      dragStartMouseX = c.x;
      dragStartMouseY = c.y;
      
      try { window.compassAPI.pluginCall('screen-compass', 'setDragging', [true, 0, 0, 'touch']); } catch (e) {}
      setContainerStyle(true, b.x, b.y);
      boundsReady = true;
    });
  }
}

function handleTouchMove(e) {
  if (!dragging) return;
  try { if (e.cancelable) e.preventDefault(); } catch (e) {}
  
  const c = getCentroid(e.touches);
  const dist = Math.sqrt(Math.pow(c.x - lastEffectiveTouchCentroid.x, 2) + Math.pow(c.y - lastEffectiveTouchCentroid.y, 2));
  
  if (dist < 5) return;

  if (boundsReady && dragStartBounds) {
    moved = true;
    const dx = c.x - startTouchCentroid.x;
    const dy = c.y - startTouchCentroid.y;
    
    compassContainer.style.transform = `translate(${dx}px, ${dy}px)`;
    lastEffectiveTouchCentroid = c;
  }
  
  lastTouchCentroid = c;
}

function handleTouchEnd(e) {
  if (e.touches.length > 0) {
    // 简化处理，忽略多指切换的复杂重置
  } else {
    dragging = false;
    if (moved && boundsReady && dragStartBounds) {
      const dx = lastEffectiveTouchCentroid.x - startTouchCentroid.x;
      const dy = lastEffectiveTouchCentroid.y - startTouchCentroid.y;
      const finalX = dragStartBounds.x + dx;
      const finalY = dragStartBounds.y + dy;
      try { window.compassAPI.pluginCall('screen-compass', 'setDragging', [false, finalX, finalY]); } catch (e) {}
      justDragged = true; setTimeout(() => { justDragged = false; }, 200);
    } else {
      try { window.compassAPI.pluginCall('screen-compass', 'setDragging', [false]); } catch (e) {}
    }
    setContainerStyle(false);
    boundsReady = false;
    dragStartBounds = null;
    window.compassAPI.snap();
  }
}

// 绑定 Touch 事件
center.addEventListener('touchstart', handleTouchStart, { passive: false });
center.addEventListener('touchmove', handleTouchMove, { passive: false });
center.addEventListener('touchend', handleTouchEnd);
center.addEventListener('touchcancel', handleTouchEnd);

function onPointerDown(e){ 
  // 如果是触摸类型，交给 touch 事件处理，pointer 事件忽略
  if (String(e.pointerType || '').toLowerCase() === 'touch') return;
  
  dragging = true; moved = false; boundsReady = false; 
  startScreenX = e.screenX; startScreenY = e.screenY; 
  downClientX = e.clientX; downClientY = e.clientY; 
  
  try { e.preventDefault(); } catch (e) {} 
  try { center.setPointerCapture(e.pointerId); } catch (e) {} 
  
  window.compassAPI.getBounds().then((raw)=>{ 
      const b = (raw && raw.result) ? raw.result : raw; 
      dragStartBounds = b;
      dragStartMouseX = e.screenX;
      dragStartMouseY = e.screenY;
      
      try { window.compassAPI.pluginCall('screen-compass','setDragging',[true, 0, 0, 'mouse']); } catch (e) {} 
      setContainerStyle(true, b.x, b.y);
      boundsReady = true;
  }); 
}
function onPointerMove(e){
  if (String(e.pointerType || '').toLowerCase() === 'touch') return;
  if (!dragging) return;
  
  if (!boundsReady || !dragStartBounds) return;

  const dx = e.screenX - dragStartMouseX;
  const dy = e.screenY - dragStartMouseY;
  
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
  
  compassContainer.style.transform = `translate(${dx}px, ${dy}px)`;
  
  try { e.preventDefault(); } catch (e) {}
}
function onPointerUp(e){ 
    try { center.releasePointerCapture(e.pointerId); } catch (e) {} 
    dragging=false; 
    
    if (moved && boundsReady && dragStartBounds) {
        const dx = e.screenX - dragStartMouseX;
        const dy = e.screenY - dragStartMouseY;
        const finalX = dragStartBounds.x + dx;
        const finalY = dragStartBounds.y + dy;
        
        try { window.compassAPI.pluginCall('screen-compass','setDragging',[false, finalX, finalY]); } catch (e) {}
    } else {
        try { window.compassAPI.pluginCall('screen-compass','setDragging',[false]); } catch (e) {}
        if (moved) { justDragged = true; setTimeout(()=>{ justDragged=false; }, 200); }
    }
    
    setContainerStyle(false);
    boundsReady=false; 
    dragStartBounds = null;
    window.compassAPI.snap(); 
}
function onPointerCancel(e){ 
    try { center.releasePointerCapture(e.pointerId); } catch (e) {} 
    dragging=false; 
    setContainerStyle(false);
    boundsReady=false; 
    dragStartBounds = null;
    moved=false; 
    try { window.compassAPI.pluginCall('screen-compass','setDragging',[false]); } catch (e) {}
}
center.addEventListener('pointerdown', onPointerDown);
center.addEventListener('pointermove', onPointerMove);
center.addEventListener('pointerup', onPointerUp);
center.addEventListener('pointercancel', onPointerCancel);

function updateCenterIcon(){ try { center.style.width = centerSize + 'px'; center.style.height = centerSize + 'px'; center.style.lineHeight = centerSize + 'px'; center.style.display = 'flex'; center.style.alignItems = 'center'; center.style.justifyContent = 'center'; const iconSize = Math.round(centerSize * 0.44) + 'px'; const isH = (theme==='hleft' || theme==='hright'); const collapseIcon = isH ? (theme==='hleft' ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line') : 'ri-close-line'; const v = expanded ? collapseIcon : centerIcon; const nowHasImg = !!center.querySelector('img'); const nowHasI = !!center.querySelector('i'); if (String(v||'').startsWith('ri-')) { if (!nowHasI) { center.innerHTML = '<i class="ri-compass-3-line"></i>'; } const iEl = center.querySelector('i'); iEl.className = v; iEl.style.fontSize = iconSize; } else { if (!nowHasImg) { center.innerHTML = '<img />'; } const img = center.querySelector('img'); img.src = String(v||''); img.style.width = iconSize; img.style.height = iconSize; img.style.objectFit = 'contain'; img.style.borderRadius = '4px'; } } catch (e) {} }
const __origSetExpanded = setExpanded;
function __fadeSet(el, v){ try { if (!el) return; el.style.transition = 'opacity .16s ease'; el.style.opacity = String(v); } catch (e) {} }
function __fadeOutAll(){ try { const r=document.getElementById('ring'); const s=document.getElementById('sectors'); const ht=document.getElementById('hTray'); const hb=document.getElementById('hTrayBg'); const cb=document.getElementById('circleBg'); __fadeSet(r, 0); __fadeSet(s, 0); __fadeSet(ht, 0); __fadeSet(hb, 0); __fadeSet(cb, 0); } catch (e) {} }
function __fadeInAll(){ try { const isH = (theme==='hleft' || theme==='hright'); const r=document.getElementById('ring'); const s=document.getElementById('sectors'); const ht=document.getElementById('hTray'); const hb=document.getElementById('hTrayBg'); const cb=document.getElementById('circleBg'); __fadeSet(r, expanded ? 1 : 0); __fadeSet(s, expanded ? 1 : 0); if (isH) { __fadeSet(ht, expanded ? 1 : 0); __fadeSet(hb, expanded ? 1 : 0); __fadeSet(cb, 0); try { const dir = (theme==='hleft') ? -1 : 1; if (ht) ht.style.transform = expanded ? 'translateX(0px)' : (dir<0 ? 'translateX(12px)' : 'translateX(-12px)'); } catch (e) {} if (expanded && hb) { hb.style.background='rgba(20,28,40,0.62)'; hb.style.border='1px solid rgba(255,255,255,0.30)'; } } else { __fadeSet(ht, 0); __fadeSet(hb, 0); __fadeSet(cb, 1); if (cb) { if (expanded) { cb.style.background='rgba(20,28,40,0.44)'; cb.style.border='1px solid rgba(255,255,255,0.24)'; } else { cb.style.background='rgba(20,28,40,0.28)'; cb.style.border='1px solid rgba(255,255,255,0.18)'; } } } } catch (e) {} }
setExpanded = (on) => {
  if (window.__compassToggleTs && Date.now() - window.__compassToggleTs < 140) return;
  window.__compassToggleTs = Date.now();
  let preCenterX = null; let preCenterY = null; let useW = on ? sizeExpanded : sizeCollapsed; let useH = on ? sizeExpanded : sizeCollapsed;
  try {
    const isH = (theme==='hleft' || theme==='hright');
    __fadeOutAll();
    if (isH) {
      const N = items.length; const itemW = 56; const gap = 8; const pad = 16;
      const trayW = on ? (N>0 ? (N*itemW + Math.max(0,N-1)*gap + pad) : pad) : 0;
      const availW = Math.max(0, Number(window.screen?.availWidth || window.innerWidth || document.documentElement.clientWidth || (centerSize + 24)));
      useW = on ? Math.max(centerSize + 24, Math.min(availW, centerSize + 24 + trayW + 24)) : (centerSize + 24);
      try {
        const trayH = Math.max(Math.round(centerSize) + 8, 48);
        useH = on ? Math.max(centerSize + 24, trayH + 24) : (centerSize + 24);
      } catch (e) {
        useH = on ? Math.max(centerSize + 24, 58 + 24) : (centerSize + 24);
      }
      try {
        window.compassAPI.getBounds().then((raw)=>{
          const b = (raw && raw.result) ? raw.result : raw;
          const rootEl = document.getElementById('root');
          const centerEl = document.getElementById('center');
          const rr = (rootEl && typeof rootEl.getBoundingClientRect==='function') ? rootEl.getBoundingClientRect() : {left:0,top:0};
          const cr = (centerEl && typeof centerEl.getBoundingClientRect==='function') ? centerEl.getBoundingClientRect() : {left:0,top:0};
          const centerLeft0 = Math.max(0, Math.round(cr.left - rr.left));
          const centerTop0 = Math.max(0, Math.round(cr.top - rr.top));
          preCenterX = Number(b.x || 0) + centerLeft0;
          preCenterY = Number(b.y || 0) + centerTop0;
        });
      } catch (e) {}
    }
    try {
      const isH2 = (theme==='hleft' || theme==='hright');
      if (isH2) {
        const rootEl = document.getElementById('root');
        const centerEl = document.getElementById('center');
        const rr = (rootEl && typeof rootEl.getBoundingClientRect==='function') ? rootEl.getBoundingClientRect() : { width: 0 };
        const Wnow = Math.max(centerSize + 24, Math.floor(rr.width || window.innerWidth || document.documentElement.clientWidth || (centerSize + 24)));
        const dir2 = (theme==='hleft') ? -1 : 1;
        const nearMargin2 = 18;
        const centerShift2 = 5;
        const cx2 = (dir2 < 0) ? (Wnow - nearMargin2 - Math.round(centerSize) + centerShift2) : (nearMargin2 + centerShift2);
        try { centerEl.style.left = cx2 + 'px'; centerEl.style.top = '12px'; } catch (e) {}
        try { const ht=document.getElementById('hTray'); if (ht) { ht.style.transform = (dir2<0 ? 'translateX(12px)' : 'translateX(-12px)'); } } catch (e) {}
      }
    } catch (e) {}
    setTimeout(()=>{ try { window.compassAPI.pluginCall('screen-compass','setExpandedWindow',[!!on, useW, useH]); } catch (e) {} }, 0);
  } catch (e) {}
  let done = false;
  const run = () => {
    if (done) return; done = true;
    try {
      __origSetExpanded(on); placeItems(); updateCenterIcon();
      __fadeInAll();
      if (expanded && !(theme==='hleft' || theme==='hright')) resetInactivityTimer(); else { try { if (inactivityTimer) clearTimeout(inactivityTimer); } catch (e) {} }
      const isH = (theme==='hleft' || theme==='hright');
      if (isH && preCenterX!=null && preCenterY!=null) {
        setTimeout(()=>{ try {
          window.compassAPI.getBounds().then((raw)=>{
            const b2 = (raw && raw.result) ? raw.result : raw;
            const dir = (theme==='hleft') ? -1 : 1;
            const nearMargin3 = 18;
            const centerShift3 = 5;
            const centerLeftNew = (dir<0 ? (useW - nearMargin3 - Math.round(centerSize) + centerShift3) : (nearMargin3 + centerShift3));
            const centerTopNew = 12;
            let nx = Math.round(preCenterX - centerLeftNew);
            let ny = Math.round(preCenterY - centerTopNew);
            const availW = Math.max(0, Number(window.screen?.availWidth || window.innerWidth || document.documentElement.clientWidth || 0));
            const availH = Math.max(0, Number(window.screen?.availHeight || window.innerHeight || document.documentElement.clientHeight || 0));
            if (nx < 0) nx = 0;
            if (ny < 0) ny = 0;
            if (nx + useW > availW) nx = Math.max(0, availW - useW);
            if (ny + useH > availH) ny = Math.max(0, availH - useH);
            try { window.compassAPI.moveTo(nx, ny); } catch (e) {}
          });
        } catch (e) {} }, 60);
      }
    } catch (e) {}
  };
  const onResize = () => { try { window.removeEventListener('resize', onResize); } catch (e) {} run(); };
  try { window.addEventListener('resize', onResize); } catch (e) {}
  setTimeout(() => { if (!done) { try { window.removeEventListener('resize', onResize); } catch (e) {} run(); } }, 140);
};

try { window.addEventListener('resize', () => { placeItems(); const nodes = Array.from(ring.children); nodes.forEach(n => { if (expanded) n.classList.remove('hidden'); else n.classList.add('hidden'); }); updateCenterIcon(); }); } catch (e) {}
(async function init(){ await ensureDefaults(); await loadItems(); placeItems(); setExpanded(false); })();

try { window.compassAPI.subscribe('screen-compass-channel'); } catch (e) {}
try {
  window.compassAPI.onEvent(async (name, payload) => {
    if (name !== 'screen-compass-channel' || !payload) return;
    if (payload.type === 'buttons.update') {
      try { if (Array.isArray(payload.buttons)) { items = payload.buttons; } else { await loadItems(); } if (payload.theme) { const t = String(payload.theme); theme = ['classic','sector','hleft','hright'].includes(t)?t:theme; } if (payload.centerSize) { centerSize = Math.max(32, Math.min(160, Number(payload.centerSize) || centerSize)); sizeCollapsed = Math.max(40, Math.min(240, centerSize + 10)); } else if (payload.sizeCollapsed) { sizeCollapsed = Math.max(40, Math.min(240, Number(payload.sizeCollapsed) || sizeCollapsed)); centerSize = Math.max(32, Math.min(160, sizeCollapsed - 10)); } if (payload.sizeExpanded) sizeExpanded = Number(payload.sizeExpanded) || sizeExpanded; if (payload.centerIcon) centerIcon = String(payload.centerIcon) || centerIcon; } catch (e) {} placeItems(); setExpanded(expanded); }
    if (payload.type === 'app.active') { try { appActive = !!payload.active; } catch (e) { appActive = !!payload.active; } try { placeItems(); } catch (e) {} }
  });
} catch (e) {}
const root = document.getElementById('root');
root.addEventListener('click', (e) => { if (!expanded) return; if (e.target === root) setExpanded(false); });
try { root.addEventListener('pointerdown', resetInactivityTimer); center.addEventListener('pointerdown', resetInactivityTimer); ring.addEventListener('pointerdown', resetInactivityTimer); document.getElementById('sectors').addEventListener('pointerdown', resetInactivityTimer); } catch (e) {}
