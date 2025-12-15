const center = document.getElementById('center');
const ring = document.getElementById('ring');

let expanded = false;
let items = [];
const scope = 'screen.compass';
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

async function ensureDefaults() {
  const defaults = { buttons: [ { id: 'rollcall', label: '随机点名', icon: 'ri-shuffle-line', actionType: 'plugin', actionPayload: { pluginId: 'rollcall.random', fn: 'openRollcallTemplate', args: [] } } ] };
  try { await window.compassAPI.configEnsureDefaults(scope, defaults); } catch {}
  try { await window.compassAPI.configEnsureDefaults(scope, { sizeCollapsed: 60, sizeExpanded: 240, centerSize: 50, centerIcon: 'ri-compass-3-line' }); } catch {}
  try { await window.compassAPI.configEnsureDefaults(altScope, defaults); } catch {}
  try { await window.compassAPI.configEnsureDefaults(altScope, { sizeCollapsed: 60, sizeExpanded: 240, centerSize: 50, centerIcon: 'ri-compass-3-line' }); } catch {}
}

async function loadItems() {
  try { let raw = await window.compassAPI.configGet(scope, 'buttons'); const list = (raw && raw.result) ? raw.result : raw; items = Array.isArray(list) ? list : []; if (!items.length) { try { raw = await window.compassAPI.configGet(altScope, 'buttons'); const list2 = (raw && raw.result) ? raw.result : raw; items = Array.isArray(list2) ? list2 : items; } catch {} } } catch { items = []; }
  try { let t = await window.compassAPI.configGet(scope, 'theme'); let v = (t && t.result) ? t.result : t; theme = ['classic','sector','hleft','hright'].includes(v)?v:'classic'; if (!t) { try { t = await window.compassAPI.configGet(altScope, 'theme'); v = (t && t.result) ? t.result : t; theme = ['classic','sector','hleft','hright'].includes(v)?v:theme; } catch {} } } catch { theme = 'classic'; }
  try { let v = await window.compassAPI.configGet(scope, 'sizeCollapsed'); sizeCollapsed = Number((v && v.result) ? v.result : v) || 60; if (!v) { try { v = await window.compassAPI.configGet(altScope, 'sizeCollapsed'); sizeCollapsed = Number((v && v.result) ? v.result : v) || sizeCollapsed; } catch {} } } catch { sizeCollapsed = 60; }
  try { let v = await window.compassAPI.configGet(scope, 'sizeExpanded'); sizeExpanded = Number((v && v.result) ? v.result : v) || 240; if (!v) { try { v = await window.compassAPI.configGet(altScope, 'sizeExpanded'); sizeExpanded = Number((v && v.result) ? v.result : v) || sizeExpanded; } catch {} } } catch { sizeExpanded = 240; }
  try { let v = await window.compassAPI.configGet(scope, 'centerSize'); centerSize = Number((v && v.result) ? v.result : v) || 50; if (!v) { try { v = await window.compassAPI.configGet(altScope, 'centerSize'); centerSize = Number((v && v.result) ? v.result : v) || centerSize; } catch {} } } catch { centerSize = 50; }
  try { let v = await window.compassAPI.configGet(scope, 'centerIcon'); centerIcon = String((v && v.result) ? v.result : v || 'ri-compass-3-line'); if (!v) { try { v = await window.compassAPI.configGet(altScope, 'centerIcon'); const vv = (v && v.result) ? v.result : v; centerIcon = String(vv || centerIcon || 'ri-compass-3-line'); } catch {} } } catch { centerIcon = 'ri-compass-3-line'; }
  try { centerSize = Math.max(32, Math.min(160, Number(centerSize || 50))); sizeCollapsed = Math.max(40, Math.min(240, Number(sizeCollapsed || (centerSize + 10)))); centerSize = Math.max(32, Math.min(160, Number(sizeCollapsed - 10))); sizeCollapsed = Math.max(40, Math.min(240, Number(centerSize + 10))); } catch {}
}

function placeItems() {
  ring.innerHTML = '';
  const rootEl = document.getElementById('root');
  const sectors = document.getElementById('sectors'); sectors.innerHTML = '';
  const hTray = document.getElementById('hTray'); hTray.innerHTML = '';
  const hTrayBg = document.getElementById('hTrayBg'); if (hTrayBg) { try { while (hTrayBg.firstChild) hTrayBg.removeChild(hTrayBg.firstChild); } catch {} }
  const circleBg = document.getElementById('circleBg');
  const rootRect = (document.getElementById('root')?.getBoundingClientRect?.()) || { width: 0, height: 0 };
  const isHTheme = (theme==='hleft' || theme==='hright');
  const W = isHTheme
    ? Math.max(centerSize + 24, Math.floor(rootRect.width || window.innerWidth || document.documentElement.clientWidth || (centerSize + 24)))
    : Math.max(200, Math.floor(rootRect.width || window.innerWidth || document.documentElement.clientWidth || 240));
  const H = isHTheme
    ? Math.max(centerSize + 24, Math.floor(rootRect.height || window.innerHeight || document.documentElement.clientHeight || (centerSize + 24)))
    : Math.max(200, Math.floor(rootRect.height || window.innerHeight || document.documentElement.clientHeight || 240));
  if (W < 40 || H < 40) { try { setTimeout(placeItems, 50); } catch {} return; }
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  let R = Math.min(cx, cy) - 24; if (R < 22) R = 22;
  const N = items.length;
  try { rootEl.classList.toggle('sector', theme==='sector'); rootEl.classList.toggle('classic', theme==='classic'); } catch {}
  const centerEl = document.getElementById('center');
  const isH = (theme==='hleft' || theme==='hright');
  try { hTray.style.display = (isH && expanded) ? 'flex' : 'none'; } catch {}
  try { if (hTrayBg) hTrayBg.style.display = (isH && expanded) ? 'block' : 'none'; } catch {}
  try { if (circleBg) circleBg.style.display = isH ? 'none' : 'block'; } catch {}
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
      path.addEventListener('mouseenter', () => { if (!expanded) return; activeIndex = i; try { path.style.opacity = '1'; } catch {} });
      path.addEventListener('mouseleave', () => { if (!expanded) return; activeIndex = -1; try { path.style.opacity = '0'; } catch {} });
      path.addEventListener('click', async () => { if (!expanded) return; const it = items[i]; try { await window.compassAPI.pluginCall('screen.compass', 'performAction', [it]); } catch {} try { setExpanded(false); } catch {} });
      svg.appendChild(path);
    }
    sectors.appendChild(svg);
    try { sectors.style.pointerEvents = expanded ? 'auto' : 'none'; } catch {}
  }
  if (isH) {
    const itemWidth = 56; const gap = 8; const pad = 16; const totalW = (N>0)? (N*itemWidth + Math.max(0, N-1)*gap + pad) : pad;
    const dir = (theme==='hleft') ? -1 : 1;
    const btnTopFixed = 10;
    let centerLeft, centerTop;
    const centerX = (theme==='hleft') ? (W - 12 - Math.round(centerSize)) : (12);
    centerLeft = centerX; centerTop = btnTopFixed;
    try { centerEl.style.position = 'absolute'; centerEl.style.left = centerLeft + 'px'; centerEl.style.top = centerTop + 'px'; centerEl.style.display = 'flex'; centerEl.style.alignItems = 'center'; centerEl.style.justifyContent = 'center'; centerEl.style.zIndex = '3'; } catch {}
    const bgHeightFixed = 72;
    const bgTop = btnTopFixed + Math.round(centerSize/2) - Math.round(bgHeightFixed/2);
    let bgLeft, bgWidth, trayLeft;
    if (expanded) {
      bgWidth = centerSize + 24 + totalW;
      if (dir < 0) {
        bgLeft = 24;
        trayLeft = Math.max(0, centerLeft - (totalW + 16));
        hTray.style.left = trayLeft + 'px';
        hTray.style.top = '6px';
        hTray.style.width = totalW + 'px';
        bgWidth = Math.max(0, centerSize + 24 + totalW - 8);
        try { hTray.style.justifyContent = 'flex-end'; } catch {}
        try { hTray.style.zIndex = '2'; } catch {}
      } else {
        bgLeft = Math.max(0, centerLeft - 12);
        trayLeft = 74;
        hTray.style.left = '74px';
        hTray.style.top = '6px';
        hTray.style.width = totalW + 'px';
        try { hTray.style.justifyContent = 'flex-start'; } catch {}
        try { hTray.style.zIndex = '2'; } catch {}
      }
    } else {
      bgLeft = centerLeft;
      bgWidth = centerSize + 24;
    }
    if (hTrayBg) {
      try {
        if (expanded) {
          hTrayBg.style.display = 'block';
          if (dir < 0) {
            hTrayBg.style.left = '24px';
            hTrayBg.style.top = '6px';
          } else {
            hTrayBg.style.left = '8px';
            hTrayBg.style.top = '6px';
          }
          hTrayBg.style.width = bgWidth + 'px';
          hTrayBg.style.height = '68px';
          hTrayBg.style.background = 'rgba(20,28,40,0.52)';
          hTrayBg.style.border = '1px solid rgba(255,255,255,0.28)';
          hTrayBg.style.borderRadius = '54px';
          try { hTrayBg.style.zIndex = '1'; } catch {}
        }
      } catch {}
    }
    for (let i = 0; i < N; i++) {
      const it = items[i];
      const div = document.createElement('div');
      div.className = 'item';
      if (appActive && String(it.actionType||'')==='app') { try { div.classList.add('active'); } catch {} }
      const labelText = String(it.label || '').trim();
      const icStr = String(it.icon || '');
      const useIcon = icStr.startsWith('ri-') ? `<i class="${icStr}"></i>` : `<img src="${icStr}" style="width:20px;height:20px;object-fit:contain;border-radius:4px;" />`;
      div.innerHTML = `${useIcon}<div class="label">${labelText}</div>`;
      div.addEventListener('click', async () => {
        if (!expanded) return;
        const isApp = String(it.actionType||'')==='app';
        try {
          if (isApp && appActive) { await window.compassAPI.pluginCall('screen.compass','closeApplicationsWindow',[]); }
          else { await window.compassAPI.pluginCall('screen.compass', 'performAction', [it]); }
        } catch {}
      });
      hTray.appendChild(div);
    }
  } else {
    // reset center to default (flex center) for non-horizontal themes
    try { centerEl.style.position = ''; centerEl.style.left = ''; centerEl.style.top = ''; } catch {}
    for (let i = 0; i < N; i++) {
      const it = items[i]; const centerR = 25; let x = 0; let y = 0; { const a = (Math.PI * 2) * ((i + 0.5) / Math.max(N, 1)); const ro2 = Math.min(R + 14, Math.min(cx, cy) - 10); const ri2 = Math.max(centerR + 8, Math.round(R * 0.5)); const RB = Math.round((ro2 + ri2) / 2); x = Math.round(cx + RB * Math.cos(a)); y = Math.round(cy + RB * Math.sin(a)); }
      const div = document.createElement('div'); div.className = 'item'; div.style.position = 'absolute'; const halfW = (theme === 'classic') ? 28 : 22; const halfH = 29; x = Math.max(halfW, Math.min(W - halfW, x)); y = Math.max(halfH+1, Math.min(H - (halfH+1), y)); div.style.left = (x - halfW) + 'px'; div.style.top = (y - halfH) + 'px'; div.title = it.label || ''; const labelText = String(it.label || '').trim(); const icStr = String(it.icon || ''); const useIcon = icStr.startsWith('ri-') ? `<i class="${icStr}"></i>` : `<img src="${icStr}" style="width:20px;height:20px;object-fit:contain;border-radius:4px;" />`; if (theme === 'classic') { div.innerHTML = `<div class="dot">${useIcon}<div class="label">${labelText}</div></div>`; } else { div.innerHTML = `${useIcon}<div class="label">${labelText}</div>`; }
      if (appActive && String(it.actionType||'')==='app') { try { div.classList.add('active'); } catch {} }
      const updateWedgesOpacity = () => { try { const wedges = sectors.querySelectorAll('.wedge'); wedges.forEach((w)=>{ const idx = Number(w.dataset.index||-1); w.style.opacity = (expanded && idx===activeIndex) ? '1' : '0'; }); } catch {} };
      div.addEventListener('mouseenter', () => { activeIndex = i; updateWedgesOpacity(); });
      div.addEventListener('mouseleave', () => { activeIndex = -1; updateWedgesOpacity(); });
      div.addEventListener('click', async () => {
        if (!expanded) return;
        const isApp = String(it.actionType||'')==='app';
        try {
          if (isApp && appActive) { await window.compassAPI.pluginCall('screen.compass','closeApplicationsWindow',[]); }
          else { await window.compassAPI.pluginCall('screen.compass', 'performAction', [it]); }
        } catch {}
        try { setExpanded(false); } catch {}
      });
      ring.appendChild(div);
    }
  }
}

function setExpanded(on) {
  expanded = !!on;
  try { const centerEl = document.getElementById('center'); const rootEl = document.getElementById('root'); const isH = (theme==='hleft' || theme==='hright'); if (isH) { if (!expanded) { const cr = centerEl.getBoundingClientRect(); const rr = rootEl.getBoundingClientRect(); hAnchorLeft = Math.max(0, Math.round(cr.left - rr.left)); hAnchorTop = Math.max(0, Math.round(cr.top - rr.top)); } } else { hAnchorLeft=null; hAnchorTop=null; } } catch {}
  const nodes = Array.from(ring.children);
  nodes.forEach(n => { if (expanded) { n.classList.remove('hidden'); } else { n.classList.add('hidden'); } });
  try { const hTray = document.getElementById('hTray'); const hTrayBg = document.getElementById('hTrayBg'); const isH = (theme==='hleft' || theme==='hright'); hTray.style.opacity = expanded ? '1' : '0'; hTray.style.pointerEvents = expanded ? 'auto' : 'none'; hTray.style.display = (isH && expanded) ? 'flex' : 'none'; if (hTrayBg) hTrayBg.style.display = (isH && expanded) ? 'block' : 'none'; } catch {}
}

center.addEventListener('click', () => { if (dragging || justDragged || toggleLock) return; toggleLock = true; setExpanded(!expanded); setTimeout(() => { toggleLock = false; }, 160); });

let inactivityTimer = null;
function resetInactivityTimer(){ try { if (theme==='hleft' || theme==='hright') return; if (inactivityTimer) clearTimeout(inactivityTimer); inactivityTimer = setTimeout(() => { if (expanded) setExpanded(false); }, 30000); } catch {} }

let dragging = false; let startScreenX = 0; let startScreenY = 0; let lastScreenX = 0; let lastScreenY = 0; let lastClientX = 0; let lastClientY = 0; let startWinX = 0; let startWinY = 0; let moved = false; let justDragged = false; let rafScheduled = false; let nextX = 0; let nextY = 0; let downClientX = 0; let downClientY = 0; let boundsReady = false;
function onPointerDown(e){ dragging = true; moved = false; boundsReady = false; startScreenX = e.screenX; startScreenY = e.screenY; lastScreenX = startScreenX; lastScreenY = startScreenY; downClientX = e.clientX; downClientY = e.clientY; lastClientX = downClientX; lastClientY = downClientY; const inputType = String(e.pointerType||'').toLowerCase(); try { e.preventDefault(); } catch {} try { center.setPointerCapture(e.pointerId); } catch {} window.compassAPI.getBounds().then((raw)=>{ const b = (raw && raw.result) ? raw.result : raw; startWinX = (b && typeof b.x==='number')? b.x:0; startWinY = (b && typeof b.y==='number')? b.y:0; boundsReady = true; const offsetX = Math.max(0, (typeof e.screenX === 'number' ? e.screenX : 0) - startWinX); const offsetY = Math.max(0, (typeof e.screenY === 'number' ? e.screenY : 0) - startWinY); try { window.compassAPI.pluginCall('screen.compass','setDragging',[true, offsetX, offsetY, inputType]); } catch {} }); }
function onPointerMove(e){ if (!dragging) return; try { const evs = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : null; if (evs && evs.length) { const le = evs[evs.length-1]; lastClientX = le.clientX; lastClientY = le.clientY; lastScreenX = le.screenX; lastScreenY = le.screenY; } else { lastClientX = e.clientX; lastClientY = e.clientY; lastScreenX = e.screenX; lastScreenY = e.screenY; } } catch { lastClientX = e.clientX; lastClientY = e.clientY; lastScreenX = e.screenX; lastScreenY = e.screenY; } if (!boundsReady) { return; } const dx = lastClientX - downClientX, dy = lastClientY - downClientY; if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true; try { e.preventDefault(); } catch {} if (dragging && boundsReady && String(e.pointerType||'').toLowerCase()==='touch') { const dx = lastClientX - downClientX; const dy = lastClientY - downClientY; try { window.compassAPI.pluginCall('screen.compass','touchDragMove',[dx, dy]); } catch {} } }
function onPointerUp(e){ try { center.releasePointerCapture(e.pointerId); } catch {} dragging=false; boundsReady=false; rafScheduled=false; if (moved) { justDragged = true; setTimeout(()=>{ justDragged=false; }, 200); } window.compassAPI.snap(); try { window.compassAPI.pluginCall('screen.compass','setDragging',[false]); } catch {} }
function onPointerCancel(e){ try { center.releasePointerCapture(e.pointerId); } catch {} dragging=false; boundsReady=false; rafScheduled=false; moved=false; }
center.addEventListener('pointerdown', onPointerDown);
center.addEventListener('pointermove', onPointerMove);
center.addEventListener('pointerup', onPointerUp);
center.addEventListener('pointercancel', onPointerCancel);

function updateCenterIcon(){ try { center.style.width = centerSize + 'px'; center.style.height = centerSize + 'px'; center.style.lineHeight = centerSize + 'px'; center.style.display = 'flex'; center.style.alignItems = 'center'; center.style.justifyContent = 'center'; const iconSize = Math.round(centerSize * 0.44) + 'px'; const isH = (theme==='hleft' || theme==='hright'); const collapseIcon = isH ? (theme==='hleft' ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line') : 'ri-close-line'; const v = expanded ? collapseIcon : centerIcon; const nowHasImg = !!center.querySelector('img'); const nowHasI = !!center.querySelector('i'); if (String(v||'').startsWith('ri-')) { if (!nowHasI) { center.innerHTML = '<i class="ri-compass-3-line"></i>'; } const iEl = center.querySelector('i'); iEl.className = v; iEl.style.fontSize = iconSize; } else { if (!nowHasImg) { center.innerHTML = '<img />'; } const img = center.querySelector('img'); img.src = String(v||''); img.style.width = iconSize; img.style.height = iconSize; img.style.objectFit = 'contain'; img.style.borderRadius = '4px'; } } catch {} }
const __origSetExpanded = setExpanded;
function __fadeSet(el, v){ try { if (!el) return; el.style.transition = 'opacity .16s ease'; el.style.opacity = String(v); } catch {} }
function __fadeOutAll(){ try { const r=document.getElementById('ring'); const s=document.getElementById('sectors'); const ht=document.getElementById('hTray'); const hb=document.getElementById('hTrayBg'); const cb=document.getElementById('circleBg'); __fadeSet(r, 0); __fadeSet(s, 0); __fadeSet(ht, 0); __fadeSet(hb, 0); __fadeSet(cb, 0); } catch {} }
function __fadeInAll(){ try { const isH = (theme==='hleft' || theme==='hright'); const r=document.getElementById('ring'); const s=document.getElementById('sectors'); const ht=document.getElementById('hTray'); const hb=document.getElementById('hTrayBg'); const cb=document.getElementById('circleBg'); __fadeSet(r, expanded ? 1 : 0); __fadeSet(s, expanded ? 1 : 0); if (isH) { __fadeSet(ht, expanded ? 1 : 0); __fadeSet(hb, expanded ? 1 : 0); __fadeSet(cb, 0); if (expanded && hb) { hb.style.background='rgba(20,28,40,0.62)'; hb.style.border='1px solid rgba(255,255,255,0.30)'; } } else { __fadeSet(ht, 0); __fadeSet(hb, 0); __fadeSet(cb, 1); if (cb) { if (expanded) { cb.style.background='rgba(20,28,40,0.44)'; cb.style.border='1px solid rgba(255,255,255,0.24)'; } else { cb.style.background='rgba(20,28,40,0.28)'; cb.style.border='1px solid rgba(255,255,255,0.18)'; } } } } catch {} }
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
      useH = on ? Math.max(centerSize + 24, 58 + 12) : (centerSize + 24);
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
      } catch {}
    }
    setTimeout(()=>{ try { window.compassAPI.pluginCall('screen.compass','setExpandedWindow',[!!on, useW, useH]); } catch {} }, 120);
  } catch {}
  let done = false;
  const run = () => {
    if (done) return; done = true;
    try {
      __origSetExpanded(on); placeItems(); updateCenterIcon();
      __fadeInAll();
      if (expanded && !(theme==='hleft' || theme==='hright')) resetInactivityTimer(); else { try { if (inactivityTimer) clearTimeout(inactivityTimer); } catch {} }
      const isH = (theme==='hleft' || theme==='hright');
      if (isH && preCenterX!=null && preCenterY!=null) {
        setTimeout(()=>{ try {
          window.compassAPI.getBounds().then((raw)=>{
            const b2 = (raw && raw.result) ? raw.result : raw;
            const dir = (theme==='hleft') ? -1 : 1;
            const centerLeftNew = (dir<0 ? (useW - 12 - Math.round(centerSize)) : 12);
            const centerTopNew = 10;
            let nx = Math.round(preCenterX - centerLeftNew);
            let ny = Math.round(preCenterY - centerTopNew);
            const availW = Math.max(0, Number(window.screen?.availWidth || window.innerWidth || document.documentElement.clientWidth || 0));
            const availH = Math.max(0, Number(window.screen?.availHeight || window.innerHeight || document.documentElement.clientHeight || 0));
            if (nx < 0) nx = 0;
            if (ny < 0) ny = 0;
            if (nx + useW > availW) nx = Math.max(0, availW - useW);
            if (ny + useH > availH) ny = Math.max(0, availH - useH);
            try { window.compassAPI.moveTo(nx, ny); } catch {}
          });
        } catch {} }, 60);
      }
    } catch {}
  };
  const onResize = () => { try { window.removeEventListener('resize', onResize); } catch {} run(); };
  try { window.addEventListener('resize', onResize); } catch {}
  setTimeout(() => { if (!done) { try { window.removeEventListener('resize', onResize); } catch {} run(); } }, 140);
};

try { window.addEventListener('resize', () => { placeItems(); const nodes = Array.from(ring.children); nodes.forEach(n => { if (expanded) n.classList.remove('hidden'); else n.classList.add('hidden'); }); updateCenterIcon(); }); } catch {}
(async function init(){ await ensureDefaults(); await loadItems(); placeItems(); setExpanded(false); })();

try { window.compassAPI.subscribe('screen.compass.channel'); } catch {}
try {
  window.compassAPI.onEvent(async (name, payload) => {
    if (name !== 'screen.compass.channel' || !payload) return;
    if (payload.type === 'buttons.update') {
      try { if (Array.isArray(payload.buttons)) { items = payload.buttons; } else { await loadItems(); } if (payload.theme) { const t = String(payload.theme); theme = ['classic','sector','hleft','hright'].includes(t)?t:theme; } if (payload.centerSize) { centerSize = Math.max(32, Math.min(160, Number(payload.centerSize) || centerSize)); sizeCollapsed = Math.max(40, Math.min(240, centerSize + 10)); } else if (payload.sizeCollapsed) { sizeCollapsed = Math.max(40, Math.min(240, Number(payload.sizeCollapsed) || sizeCollapsed)); centerSize = Math.max(32, Math.min(160, sizeCollapsed - 10)); } if (payload.sizeExpanded) sizeExpanded = Number(payload.sizeExpanded) || sizeExpanded; if (payload.centerIcon) centerIcon = String(payload.centerIcon) || centerIcon; } catch {} placeItems(); setExpanded(expanded); }
    if (payload.type === 'app.active') { try { appActive = !!payload.active; } catch { appActive = !!payload.active; } try { placeItems(); } catch {} }
  });
} catch {}
const root = document.getElementById('root');
root.addEventListener('click', (e) => { if (!expanded) return; if (e.target === root) setExpanded(false); });
try { root.addEventListener('pointerdown', resetInactivityTimer); center.addEventListener('pointerdown', resetInactivityTimer); ring.addEventListener('pointerdown', resetInactivityTimer); document.getElementById('sectors').addEventListener('pointerdown', resetInactivityTimer); } catch {}
