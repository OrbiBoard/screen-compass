const grid = document.getElementById('grid');
const gridScroll = document.getElementById('gridScroll');
const arrowUp = document.getElementById('arrowUp');
const arrowDown = document.getElementById('arrowDown');

function updateArrows() {
    try {
        const canUp = gridScroll.scrollTop > 0;
        const canDown = (gridScroll.scrollTop + gridScroll.clientHeight) < gridScroll.scrollHeight - 1;
        
        arrowUp.style.opacity = canUp ? '1' : '0.3';
        arrowDown.style.opacity = canDown ? '1' : '0.3';

        if (!canUp && !canDown) {
            gridScroll.classList.add('no-scroll');
            gridScroll.classList.remove('at-top', 'at-bottom');
        } else if (!canUp) {
            gridScroll.classList.add('at-top');
            gridScroll.classList.remove('at-bottom', 'no-scroll');
        } else if (!canDown) {
            gridScroll.classList.add('at-bottom');
            gridScroll.classList.remove('at-top', 'no-scroll');
        } else {
            gridScroll.classList.remove('at-top', 'at-bottom', 'no-scroll');
        }
    } catch (e) { }
}

arrowUp.onclick = () => { try { gridScroll.scrollBy({ top: -gridScroll.clientHeight, behavior: 'smooth' }); } catch (e) { } };
arrowDown.onclick = () => { try { gridScroll.scrollBy({ top: gridScroll.clientHeight, behavior: 'smooth' }); } catch (e) { } };
gridScroll.addEventListener('scroll', updateArrows);

document.getElementById('collapse').onclick = async () => { 
    try { 
        await window.compassAPI.pluginCall('screen-compass', 'closeAppMenu', []); 
    } catch (e) { 
        window.close();
    } 
};

function iconHtml(ic) {
    const s = String(ic || '').trim();
    if (s.startsWith('ri-')) return `<div class="icon-wrap"><i class="${s}" style="font-size:28px;"></i></div>`;
    if (s) return `<div class="icon-wrap"><img src="${s}" style="width:28px;height:28px;object-fit:contain;border-radius:6px;" /></div>`;
    return `<div class="icon-wrap"><i class="ri-puzzle-line" style="font-size:28px;"></i></div>`;
}

let pins = [];

async function load() {
    try {
        const res = await window.compassAPI.pluginCall('screen-compass', 'listPlugins');
        const list = (res && res.result) ? res.result : res;
        const plugins = Array.isArray(list) ? list : [];
        
        try { 
            const raw = await window.compassAPI.configGet('app-launcher', 'appPins'); 
            pins = Array.isArray(raw) ? raw : []; 
        } catch (e) { pins = []; }
        
        grid.innerHTML = '';
        
        const visiblePlugins = plugins.filter(p => 
            p.enabled !== false && 
            String(p.type||'').toLowerCase() !== 'component' && 
            Array.isArray(p.actions) && 
            p.actions.length > 0
        );
        
        const sortPlugins = visiblePlugins.slice().sort((a, b) => { 
            const ap = pins.includes(a.id) ? 1 : 0; 
            const bp = pins.includes(b.id) ? 1 : 0; 
            if (ap !== bp) return bp - ap; 
            return String(a.name || a.id).localeCompare(String(b.name || b.id)); 
        });
        
        sortPlugins.forEach((p) => {
            const acts = Array.isArray(p.actions) ? p.actions : [];
            const cell = document.createElement('div');
            cell.className = 'cell';
            const nm = String(p.name || p.id || '').trim();
            const ic = String(p.icon || '').trim();
            cell.innerHTML = `${iconHtml(ic)}<div class="name">${nm}</div>`;
            const isPinned = pins.includes(p.id);
            if (isPinned) {
                try { cell.classList.add('pinned'); } catch (e) { }
                const pin = document.createElement('div'); 
                pin.className = 'pin'; 
                pin.innerHTML = `<i class="ri-pushpin-fill" style="font-size:12px;"></i>`;
                cell.appendChild(pin);
            }
            
            let pressTimer = null; 
            let longPressed = false;
            
            const clearPress = () => { 
                try { if (pressTimer) clearTimeout(pressTimer); pressTimer = null; } catch (e) { } 
            };
            
            const getActions = () => { 
                try { const acts = Array.isArray(p.actions) ? p.actions : []; return acts; } catch (e) { return [] } 
            };
            
            const callActionByIndex = async (idx) => {
                try {
                    const acts = getActions();
                    const a = acts[idx];
                    const fn = String(a?.target || a?.id || '').trim();
                    const pid = String(p.id || '').trim();
                    if (!pid || !fn) return;
                    await window.compassAPI.pluginCall(pid, fn, []);
                } catch (e) { }
            };
            
            const showActionsOverlay = () => {
                try {
                    const acts = getActions();
                    const overlay = document.createElement('div');
                    overlay.style.position = 'fixed'; 
                    overlay.style.inset = '0'; 
                    overlay.style.background = 'rgba(0,0,0,0.5)'; 
                    overlay.style.backdropFilter = 'blur(6px)'; 
                    overlay.style.zIndex = '9999'; 
                    overlay.style.padding = '12px'; 
                    overlay.style.boxSizing = 'border-box';
                    
                    const panel = document.createElement('div'); 
                    panel.style.maxHeight = '70vh'; 
                    panel.style.overflow = 'hidden'; 
                    panel.style.border = '1px solid var(--border)'; 
                    panel.style.borderRadius = '8px'; 
                    panel.style.background = 'var(--panel)'; 
                    panel.style.padding = '12px'; 
                    panel.style.width = 'min(480px, 92vw)'; 
                    panel.style.margin = '0 auto'; 
                    panel.style.boxSizing = 'border-box'; 
                    panel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
                    
                    const title = document.createElement('div'); 
                    title.innerHTML = `<span style="color:var(--fg);font-weight:600;">${nm}</span>`; 
                    title.style.marginTop = '8px';
                    
                    if (p.description) {
                        const desc = document.createElement('div');
                        desc.style.color = 'var(--muted)'; 
                        desc.style.fontSize = '12px'; 
                        desc.style.margin = '4px 0 12px 0';
                        desc.style.lineHeight = '1.4';
                        desc.innerText = p.description;
                        panel.appendChild(desc);
                    } else if (!acts.length) {
                        const desc = document.createElement('div');
                        desc.style.color = 'var(--muted)'; 
                        desc.style.fontSize = '12px'; 
                        desc.style.margin = '8px 0';
                        desc.innerText = '暂无可用动作';
                        panel.appendChild(desc);
                    }

                    const close = document.createElement('div'); 
                    close.style.textAlign = 'right'; 
                    close.innerHTML = '<button class="btn"><i class="ri-close-line"></i><span>关闭</span></button>';
                    
                    const listEl = document.createElement('div'); 
                    listEl.style.display = 'flex'; 
                    listEl.style.flexDirection = 'column'; 
                    listEl.style.gap = '8px'; 
                    listEl.style.marginTop = '8px';
                    
                    const pinRow = document.createElement('button'); 
                    pinRow.className = 'btn'; 
                    pinRow.style.justifyContent = 'space-between'; 
                    pinRow.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><i class="${isPinned ? 'ri-pushpin-fill' : 'ri-pushpin-line'}"></i>${isPinned ? '取消置顶' : '置顶'}</span><i class="ri-arrow-right-s-line"></i>`;
                    
                    pinRow.onclick = async () => { 
                        try { 
                            const now = pins.includes(p.id); 
                            if (now) pins = pins.filter(id => id !== p.id); 
                            else pins = [...new Set([...(pins || []), p.id])]; 
                            await window.compassAPI.configSet('app-launcher', 'appPins', pins); 
                            document.body.removeChild(overlay); 
                            load(); 
                        } catch (e) { } 
                    };
                    
                    listEl.appendChild(pinRow);
                    
                    acts.forEach((a, idx) => {
                        const row = document.createElement('button'); 
                        row.className = 'btn'; 
                        row.style.justifyContent = 'space-between';
                        const txt = String(a?.text || a?.id || a?.target || '').trim();
                        const ic2 = String(a?.icon || '').trim();
                        row.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><i class="${ic2 || 'ri-play-line'}"></i>${txt}</span><i class="ri-arrow-right-s-line"></i>`;
                        row.onclick = async () => { 
                            try { 
                                await callActionByIndex(idx); 
                                document.body.removeChild(overlay); 
                                try { 
                                    await window.compassAPI.pluginCall('screen-compass', 'closeAppMenu', []); 
                                } catch (e) { } 
                            } catch (e) { } 
                        };
                        listEl.appendChild(row);
                    });
                    
                    panel.appendChild(close); 
                    panel.appendChild(title); 
                    panel.appendChild(listEl);
                    overlay.appendChild(panel);
                    document.body.appendChild(overlay);
                    close.onclick = () => { try { document.body.removeChild(overlay) } catch (e) { } };
                } catch (e) { }
            };
            
            cell.addEventListener('mousedown', (e) => { 
                if (e.button !== 0) return;
                longPressed = false; 
                clearPress(); 
                pressTimer = setTimeout(() => { longPressed = true; showActionsOverlay(); }, 600); 
            });
            
            cell.addEventListener('mouseup', async (e) => { 
                if (e.button !== 0) return;
                const wasLong = longPressed; 
                clearPress(); 
                if (!wasLong) { 
                    if (acts.length > 0) {
                        await callActionByIndex(0); 
                        try { 
                            await window.compassAPI.pluginCall('screen-compass', 'closeAppMenu', []); 
                        } catch (e) { } 
                    } else {
                        showActionsOverlay();
                    }
                } 
            });
            
            cell.addEventListener('mouseleave', () => { clearPress(); });
            cell.addEventListener('contextmenu', (e) => { try { e.preventDefault(); } catch (e) { } showActionsOverlay(); });
            grid.appendChild(cell);
        });

        updateArrows();
    } catch (e) { 
        console.error('Failed to load plugins:', e);
    }
}

load();
