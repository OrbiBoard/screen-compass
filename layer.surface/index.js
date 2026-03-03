
// Combined JS for Single Layer Screen Compass
const center = document.getElementById('center');
const ring = document.getElementById('ring');
const sectors = document.getElementById('sectors');
const hTray = document.getElementById('hTray');
const hTrayBg = document.getElementById('hTrayBg');
const circleBg = document.getElementById('circleBg');
const root = document.getElementById('root');
const dragHint = document.getElementById('drag-hint');

// State
let isExpanded = false;
let isDragging = false;
let items = [];
let theme = 'classic';
let centerSize = 50;
let centerIcon = 'ri-compass-3-line';
let activeIndex = -1;
let appActive = false;

// Config
const scope = 'screen-compass';
const altScope = 'screen-compass';

// --- UI Logic (from layer.application) ---

function updateCenterIcon() {
    try {
        center.style.width = centerSize + 'px';
        center.style.height = centerSize + 'px';
        center.style.lineHeight = centerSize + 'px';
        const iconSize = Math.round(centerSize * 0.5) + 'px'; // slightly larger icon
        
        let icon = centerIcon;
        // Show collapse icon when expanded
        if (isExpanded) {
             if (theme === 'hleft') icon = 'ri-arrow-right-s-line';
             else if (theme === 'hright') icon = 'ri-arrow-left-s-line';
             else icon = 'ri-close-line';
        }

        if (String(icon || '').startsWith('ri-')) {
            center.innerHTML = `<i class="${icon}" style="font-size: ${iconSize}"></i>`;
        } else {
            center.innerHTML = `<img src="${icon}" style="width: ${iconSize}; height: ${iconSize}; object-fit: contain; border-radius: 4px;" />`;
        }
        
        // H-Theme positioning is handled in placeItems, but reset here if needed
        if (theme !== 'hleft' && theme !== 'hright') {
            center.style.position = ''; center.style.left = ''; center.style.top = '';
        }
    } catch (e) { console.error(e); }
}

function __fadeSet(el, v) { try { if (el) { el.style.opacity = String(v); if(v==0) el.style.pointerEvents='none'; else el.style.pointerEvents='auto'; } } catch(e){} }

function updateVisibility() {
    // Center button is always visible
    __fadeSet(center, 1);
    
    // Others depend on expanded state
    const opacity = isExpanded ? 1 : 0;
    
    const isH = (theme === 'hleft' || theme === 'hright');
    
    __fadeSet(ring, (isExpanded && !isH) ? 1 : 0);
    __fadeSet(sectors, (isExpanded && !isH) ? 1 : 0);
    __fadeSet(circleBg, (isExpanded && !isH && theme === 'sector') ? 1 : 0);
    
    __fadeSet(hTray, (isExpanded && isH) ? 1 : 0);
    __fadeSet(hTrayBg, (isExpanded && isH) ? 1 : 0);
    
    if (isH && isExpanded) {
        // H-Theme animation/positioning
        const dir = (theme === 'hleft') ? -1 : 1;
        // Animation logic could go here
    }
    
    // Drag hint visibility
    if (dragHint) {
         if (isExpanded) dragHint.style.display = 'none'; // hide hint when expanded
         else dragHint.style.display = 'block';
         dragHint.style.opacity = '0'; // Hidden by default, shown on drag attempt
    }
}

function placeItems() {
    ring.innerHTML = '';
    sectors.innerHTML = '';
    hTray.innerHTML = '';
    if (hTrayBg) hTrayBg.innerHTML = '';
    
    const rootRect = root.getBoundingClientRect();
    const W = rootRect.width || window.innerWidth;
    const H = rootRect.height || window.innerHeight;
    
    // If window is too small (collapsed state), we don't render items effectively, 
    // BUT we need to prepare them for expansion. 
    // However, in Single Layer mode, the window might resize.
    // If we are collapsed, W/H might be 80x80.
    // If we are expanded, W/H might be 240x240.
    // We should render based on 'Expanded Size' logic even if currently small?
    // No, placeItems is called AFTER resize usually.
    
    if (isExpanded && W < 100) {
        // Wait for resize?
        return; 
    }
    
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
    let R = Math.min(cx, cy) - 24; if (R < 22) R = 22;
    const N = items.length;
    
    root.className = 'root ' + theme;
    
    const isH = (theme === 'hleft' || theme === 'hright');
    
    if (isH) {
        // Horizontal Layout
        // ... (Logic from layer.application)
        const itemWidth = 56; const gap = 8; const pad = 16;
        const totalW = (N>0)? (N*itemWidth + Math.max(0, N-1)*gap + pad) : pad;
        const centerBaseX = (theme==='hleft') ? (W - 18 - Math.round(centerSize)) : 18; 
        const centerX = centerBaseX + 5;
        const btnTopFixed = 12; // Or center vertically if we prefer
        
        // Let's center vertically in the expanded window
        const centerY = Math.floor(H/2);
        const centerTop = centerY - Math.round(centerSize/2);
        
        center.style.position = 'absolute';
        center.style.left = centerX + 'px';
        center.style.top = centerTop + 'px';
        
        const trayHeight = Math.max(Math.round(centerSize) + 8, 48);
        const bgHeight = Math.max(Math.round(centerSize) + 18, 56);
        const bgTop = centerY - Math.round(bgHeight/2);
        const trayTop = centerY - Math.round(trayHeight/2);
        
        let bgLeft, bgWidth, trayLeft;
        const bgPadH = 8;
        bgWidth = centerSize + 24 + totalW + bgPadH * 2;
        
        if (theme === 'hleft') {
           trayLeft = centerX - 12 - totalW;
           bgLeft = trayLeft - bgPadH - 12;
           hTray.style.justifyContent = 'flex-end';
           hTray.style.paddingRight = '8px'; hTray.style.paddingLeft = '0px';
        } else {
           trayLeft = centerX + centerSize + 12;
           bgLeft = centerX - 12 - bgPadH - 12; 
           hTray.style.justifyContent = 'flex-start';
           hTray.style.paddingLeft = '8px'; hTray.style.paddingRight = '0px';
        }
        
        hTray.style.left = (trayLeft + 3) + 'px';
        hTray.style.top = (trayTop + 1) + 'px';
        hTray.style.width = totalW + 'px';
        hTray.style.height = trayHeight + 'px';
        hTray.style.display = 'flex';
        
        if (hTrayBg) {
            hTrayBg.style.left = bgLeft + 'px';
            hTrayBg.style.top = bgTop + 'px';
            hTrayBg.style.width = bgWidth + 'px';
            hTrayBg.style.height = bgHeight + 'px';
            hTrayBg.style.borderRadius = Math.round(bgHeight/2) + 'px';
        }
        
        // Render Items
        for (let i = 0; i < N; i++) {
            const it = items[i];
            const div = document.createElement('div');
            div.className = 'item';
            if (appActive && String(it.actionType||'')==='app') div.classList.add('active');
            const labelText = String(it.label || '').trim();
            const icStr = String(it.icon || '');
            const useIcon = icStr.startsWith('ri-') ? `<i class="${icStr}"></i>` : `<img src="${icStr}" style="width:20px;height:20px;object-fit:contain;border-radius:4px;" />`;
            div.innerHTML = `${useIcon}<div class="label">${labelText}</div>`;
            div.addEventListener('click', (e) => { e.stopPropagation(); performAction(it); });
            hTray.appendChild(div);
        }
        
    } else {
        // Radial Layout
        // Reset Center Pos
        center.style.position = ''; center.style.left = ''; center.style.top = '';
        
        if (theme === 'sector' && N > 0) {
            // Render SVG Sectors
            const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); 
            svg.setAttribute('width','100%'); svg.setAttribute('height','100%'); 
            svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
            
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
                path.setAttribute('d', d); 
                path.setAttribute('fill','rgba(64,128,255,0.18)'); 
                path.setAttribute('stroke','rgba(64,128,255,0.32)'); 
                path.setAttribute('stroke-width','1'); 
                path.style.opacity = '0'; // default hidden
                path.setAttribute('class','wedge'); 
                path.dataset.index = String(i);
                
                path.addEventListener('mouseenter', () => { if(isExpanded) path.style.opacity = '1'; });
                path.addEventListener('mouseleave', () => { if(isExpanded) path.style.opacity = '0'; });
                path.addEventListener('click', (e) => { e.stopPropagation(); performAction(items[i]); });
                
                svg.appendChild(path);
            }
            sectors.appendChild(svg);
        }
        
        // Render Items (Radial)
        for (let i = 0; i < N; i++) {
            const it = items[i]; 
            const centerR = 25; 
            let x = 0; let y = 0; 
            const a = (Math.PI * 2) * ((i + 0.5) / Math.max(N, 1)); 
            const ro2 = Math.min(R + 14, Math.min(cx, cy) - 10); 
            const ri2 = Math.max(centerR + 8, Math.round(R * 0.5)); 
            const RB = Math.round((ro2 + ri2) / 2); 
            x = Math.round(cx + RB * Math.cos(a)); 
            y = Math.round(cy + RB * Math.sin(a)); 
            
            const div = document.createElement('div'); 
            div.className = 'item'; 
            div.style.position = 'absolute'; 
            const halfW = (theme === 'classic') ? 28 : 22; 
            const halfH = 29; 
            x = Math.max(halfW, Math.min(W - halfW, x)); 
            y = Math.max(halfH+1, Math.min(H - (halfH+1), y)); 
            div.style.left = (x - halfW) + 'px'; 
            div.style.top = (y - halfH) + 'px'; 
            div.title = it.label || ''; 
            
            const labelText = String(it.label || '').trim(); 
            const icStr = String(it.icon || ''); 
            const useIcon = icStr.startsWith('ri-') ? `<i class="${icStr}"></i>` : `<img src="${icStr}" style="width:20px;height:20px;object-fit:contain;border-radius:4px;" />`; 
            
            if (theme === 'classic') { div.innerHTML = `<div class="dot">${useIcon}<div class="label">${labelText}</div></div>`; } 
            else { div.innerHTML = `${useIcon}<div class="label">${labelText}</div>`; }
            
            if (appActive && String(it.actionType||'')==='app') div.classList.add('active');
            
            // Hover effect for sector wedges
            const updateWedgesOpacity = (show) => { 
                if(theme!=='sector') return;
                const wedges = sectors.querySelectorAll('.wedge'); 
                wedges.forEach((w)=>{ if(Number(w.dataset.index)==i) w.style.opacity = show ? '1' : '0'; }); 
            };
            
            div.addEventListener('mouseenter', () => { if(isExpanded) updateWedgesOpacity(true); });
            div.addEventListener('mouseleave', () => { if(isExpanded) updateWedgesOpacity(false); });
            div.addEventListener('click', (e) => { e.stopPropagation(); performAction(it); });
            
            ring.appendChild(div);
        }
    }
}

async function performAction(item) {
    if (!item) return;
    try {
        await window.compassAPI.pluginCall('screen-compass', 'performAction', [item]);
        // Auto close after action
        setExpanded(false);
    } catch(e) { console.error(e); }
}

function updateWindowShape() {
    // Notify Service TopLayer about which areas are interactive
    // If collapsed: only center button
    // If expanded: center button + items/ring/tray
    
    // We can use a simple rect strategy for now.
    // Ideally, we send a list of rects.
    
    const rects = [];
    
    // 1. Center Button
    const cRect = center.getBoundingClientRect();
    rects.push({ x: cRect.left, y: cRect.top, width: cRect.width, height: cRect.height });
    
    if (isExpanded) {
        if (theme === 'hleft' || theme === 'hright') {
            const hRect = hTrayBg ? hTrayBg.getBoundingClientRect() : null;
            if (hRect) rects.push({ x: hRect.left, y: hRect.top, width: hRect.width, height: hRect.height });
        } else {
            // Classic/Sector: Ring items
            const rItems = ring.children;
            for (let i=0; i<rItems.length; i++) {
                const r = rItems[i].getBoundingClientRect();
                rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
            }
        }
    }
    
    try {
        window.compassAPI.pluginCall('screen-compass', 'setWindowShape', ['surface', rects]);
    } catch(e) {}
}


// --- Drag & Toggle Logic ---

let startScreenX = 0, startScreenY = 0;
let initialWinPos = null;
const DRAG_THRESHOLD = 5;
let toplayerDragActive = false;

// Cleanup function to ensure all listeners are removed
function cleanupDragListeners() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('mouseleave', onMouseUp);
    isDragging = false;
    toplayerDragActive = false;
    initialWinPos = null;
}

// Toggle Menu: The core function
async function setExpanded(expanded) {
    if (isExpanded === expanded) return;
    isExpanded = expanded;
    
    // 1. Update UI immediately (animations start)
    updateCenterIcon();
    updateVisibility();
    
    // 2. Notify Backend to Resize Widget
    try {
        // We pass the expanded state. Backend calculates size.
        // Or we pass the desired size?
        // Let's pass the state.
        await window.compassAPI.pluginCall('screen-compass', 'setMenuState', [isExpanded]);
        
        // 3. After resize (async), we might need to re-place items if size changed significantly
        setTimeout(() => {
             placeItems(); 
             updateWindowShape();
        }, 100);
    } catch(e) { console.error(e); }
}

// Drag Logic on Center Button - frontend controls everything, toplayer just manages shape
center.addEventListener('mousedown', async (e) => {
    if (e.button !== 0) return;
    // If expanded, clicking center usually means close.
    // If collapsed, it could be click (open) or drag.
    
    // Clean up any previous drag state first
    cleanupDragListeners();
    
    isDragging = false;
    toplayerDragActive = false;
    startScreenX = e.screenX;
    startScreenY = e.screenY;
    
    try {
        const res = await window.compassAPI.pluginCall('screen-compass', 'getDragWinPos');
        if (res && res.result) initialWinPos = res.result;
        else initialWinPos = null;
    } catch (e) { initialWinPos = null; }

    // Use window to capture events even when mouse leaves the element
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseleave', onMouseUp);
});

function onMouseMove(e) {
    // Safety check: if we're not dragging, ignore
    if (!isDragging && startScreenX === 0 && startScreenY === 0) {
        return;
    }
    
    const dx = e.screenX - startScreenX;
    const dy = e.screenY - startScreenY;
    
    if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        isDragging = true;
        // If dragging started, ensure we are collapsed?
        if (isExpanded) setExpanded(false);
        
        // Notify toplayer to set fullscreen shape (enables mouse events outside widget)
        (async () => {
            try {
                await window.compassAPI.pluginCall('screen-compass', 'handleDrag', []);
                toplayerDragActive = true;
            } catch(err) {
                console.warn('[ScreenCompass Surface] handleDrag failed:', err);
            }
        })();
    }
    
    // We handle the movement ourselves
    if (isDragging && initialWinPos) {
        const newX = initialWinPos.x + dx;
        const newY = initialWinPos.y + dy;
        window.compassAPI.pluginCall('screen-compass', 'moveDragWin', [newX, newY]);
    }
}

function onMouseUp(e) {
    // Always remove listeners first
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('mouseleave', onMouseUp);
    
    if (!isDragging) {
        // Clicked!
        setExpanded(!isExpanded);
    } else if (toplayerDragActive) {
        // Notify toplayer to end drag and restore shape
        const dx = e.screenX - startScreenX;
        const dy = e.screenY - startScreenY;
        const finalX = initialWinPos ? initialWinPos.x + dx : undefined;
        const finalY = initialWinPos ? initialWinPos.y + dy : undefined;
        (async () => {
            try { 
                await window.compassAPI.pluginCall('screen-compass', 'endDragFromFrontend', [finalX, finalY]); 
            } catch(e) {}
        })();
    }
    
    // Reset all state
    isDragging = false;
    toplayerDragActive = false;
    initialWinPos = null;
    startScreenX = 0;
    startScreenY = 0;
}

// Drag Hint Logic
let hintTimer = null;
function showDragHint() {
    if (isExpanded || !dragHint) return;
    dragHint.style.opacity = '1';
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { dragHint.style.opacity = '0'; }, 2000);
}

// Global Drag (on root) to move? Only if not expanded?
// If we are in toplayer, root is transparent.
// We only capture events on center button (when collapsed).
// So global drag on root is impossible when collapsed (events fall through).
// When expanded, we capture events on root? No, we want click-through on empty space?
// Actually, if we want to detect "Click outside to close", we need to capture events on root.
// But if we capture on root, we block interaction with windows below.
// So:
// - Collapsed: Root ignores events. Center captures.
// - Expanded: Root ignores events? Or Root captures click to close?
//   If Root captures, we block underlying windows.
//   Ideally: Click outside (on desktop) should close menu.
//   But we can't detect click on desktop easily from here.
//   We can use 'blur' event of the window/widget?
//   Service TopLayer widget is a webview.
//   Let's rely on 'blur' or explicit close button (center button).

// Init
async function init() {
    try {
        await window.compassAPI.configEnsureDefaults(scope, { buttons: [{id:'rollcall', label:'随机点名', icon:'ri-shuffle-line', actionType:'plugin', actionPayload:{pluginId:'rollcall-random', fn:'openRollcallTemplate', args:[]}}] });
        
        // Load Config
        const [cItems, cTheme, cSize] = await Promise.all([
            window.compassAPI.configGet(scope, 'buttons'),
            window.compassAPI.configGet(scope, 'theme'),
            window.compassAPI.configGet(scope, 'centerSize')
        ]);
        
        if (cItems && cItems.result) items = Array.isArray(cItems.result) ? cItems.result : [];
        if (cTheme && cTheme.result) theme = String(cTheme.result);
        if (cSize && cSize.result) centerSize = Number(cSize.result) || 50;
        
        updateCenterIcon();
        placeItems();
        updateVisibility();
        
        // Subscribe
        window.compassAPI.subscribe('screen-compass-channel');
        window.compassAPI.onEvent((name, payload) => {
             if (name === 'screen-compass-channel' && payload) {
                 if (payload.type === 'buttons.update') {
                     // Reload items?
                     init(); // Simplistic reload
                 }
                 if (payload.type === 'menu.toggle') {
                     // Sync state from backend (if triggered externally)
                     if (payload.expanded !== undefined) {
                         isExpanded = !!payload.expanded;
                         updateCenterIcon();
                         updateVisibility();
                         setTimeout(() => { placeItems(); updateWindowShape(); }, 50);
                     }
                 }
             }
        });
        
    } catch(e) { console.error(e); }
}

init();

// Resize observer
window.addEventListener('resize', () => {
    placeItems();
    updateWindowShape();
});
