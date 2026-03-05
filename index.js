const path = require('path');
const url = require('url');
const { BrowserWindow, app, screen, nativeImage, shell, ipcMain } = require('electron');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;

// --- Helper Functions ---
function resolveShortcutTarget(p) {
  try {
    const fp = String(p || ''); if (!fp || process.platform !== 'win32') return '';
    if (String(fp).toLowerCase().endsWith('.lnk')) {
      const cmd = `(New-Object -COM WScript.Shell).CreateShortcut('${fp.replace(/'/g, "''")}').TargetPath`;
      const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { encoding: 'utf8' });
      const target = String(out || '').trim();
      return target || '';
    }
    return '';
  } catch (e) { return ''; }
}

let __appsCache = { ts: 0, list: [], building: false };
async function buildAppsCache() {
  try {
    if (process.platform !== 'win32') { __appsCache.list = []; __appsCache.ts = Date.now(); return; }
    const roots = [
      path.join(String(process.env['ProgramData'] || ''), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(String(process.env['AppData'] || ''), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
    ].filter(p => p && fs.existsSync(p));
    const out = [];
    const seen = new Set();
    const isExe = (p) => String(p || '').toLowerCase().endsWith('.exe');
    const isLnk = (p) => String(p || '').toLowerCase().endsWith('.lnk');
    const pushApp = (p) => { try { const key = String(p || '').toLowerCase(); if (!key) return; if (seen.has(key)) return; seen.add(key); const nm = path.basename(p, path.extname(p)); out.push({ name: nm, path: p }); } catch (e) { } };
    const walk = async (dir, depth) => {
      try {
        const ents = await fsp.readdir(dir, { withFileTypes: true });
        for (const d of ents) {
          const p1 = path.join(dir, d.name);
          if (d.isFile() && (isExe(p1) || isLnk(p1))) { pushApp(p1); continue; }
          if (d.isDirectory() && depth < 2) { await walk(p1, depth + 1); }
        }
      } catch (e) { }
    };
    for (const r of roots) { await walk(r, 0); }
    __appsCache.list = out.slice(0, 800);
    __appsCache.ts = Date.now();
  } catch (e) { __appsCache.list = []; __appsCache.ts = Date.now(); }
}

// --- Plugin State & Service ---
const SERVICE_ID = 'service-toplayer';
let pluginApi = null;
let appWin = null; // Independent launcher window

const state = {
  eventChannel: 'screen-compass-channel',
  widgetId: 'screen-compass-main', // Unified widget ID
  menuWidth: 240,
  menuHeight: 240,
  menuExpanded: false,
  dragWinSize: 120, // Button size (Default increased to avoid clipping)
  lastTheme: 'classic',
  dragStartPos: null, // To detect click vs drag
  lastWidgetPos: { x: 0, y: 0 }, // Cache for positioning
  anchor: { x: 60, y: 60 } // Anchor point (center of button relative to window)
};

function emitUpdate(target, value) { try { pluginApi.emit(state.eventChannel, { type: 'update', target, value }); } catch (e) { } }

// --- Widget Management ---

async function initWidgets() {
  try {
    // 1. Calculate Initial Position
    const pt = screen.getCursorScreenPoint ? screen.getCursorScreenPoint() : { x: 0, y: 0 };
    const d = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint(pt) : screen.getPrimaryDisplay();
    const b = d.bounds;

    const w = state.dragWinSize, h = state.dragWinSize, mr = 24, mb = 32;
    state.anchor = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
    const dragX = b.x + b.width - w - mr;
    const dragY = b.y + b.height - h - mb;
    state.lastWidgetPos = { x: dragX, y: dragY };

    // 2. Add Unified Widget (Application Layer + Surface Button)
    // Initially Collapsed (Button size)
    // Wrap options in array to ensure correct argument passing
    
    // Check if widget already exists to avoid duplication (which might cause multiple 'not enabled' prompts if it fails and retries)
    // But we don't have an easy way to check existence without calling getWidget which might throw.
    
    // We should try/catch the addWidget call specifically.
    try {
        await pluginApi.call(SERVICE_ID, 'addWidget', [{
          id: state.widgetId,
          url: url.pathToFileURL(path.join(__dirname, 'layer.application', 'index.html')).href,
          x: dragX, y: dragY, width: w, height: h,
          preload: path.join(__dirname, 'preload.js')
        }]);
    } catch (e) {
        // If service.toplayer is not enabled, this throws.
        // We should suppress the error if it's just "not enabled" to avoid spamming user?
        // But the user said "prompt 3 times".
        // If initWidgets is called multiple times, or if addWidget retries.
        
        // Actually, if service.toplayer is not enabled, `pluginApi.call` might show a prompt if it's designed to do so?
        // Or the error is propagated and logged.
        
        // Let's just log it quietly.
        console.warn('[ScreenCompass] addWidget failed:', e.message);
    }

    // Notify initial state
    pluginApi.emit(state.eventChannel, { type: 'menu.toggle', expanded: false, theme: state.lastTheme || 'classic' });

  } catch (e) { 
    console.error('[ScreenCompass] initWidgets failed:', e);
    if (pluginApi && pluginApi.logWrite) {
      pluginApi.logWrite('error', '[ScreenCompass] initWidgets failed: ' + (e.message || JSON.stringify(e)));
    }
  }
}

async function updateWidgetSize() {
    try {
        const isExpanded = state.menuExpanded;
        const w = isExpanded ? state.menuWidth : state.dragWinSize;
        const h = isExpanded ? state.menuHeight : state.dragWinSize;
        
        // Use cached bounds as base
        // lastWidgetPos is top-left of CURRENT state.
        // We need to find the "Anchor Point" (Center Button) in Screen Coords.
        
        let anchorScreenX, anchorScreenY;
        
        // If transitioning FROM Expanded TO Collapsed:
        // Current state is Expanded.
        // Anchor relative to window is state.anchor (set by setSize).
        // If we are currently expanded, we rely on the LAST anchor set by setSize.
        // But if we are collapsed, anchor is center.
        
        // Wait, we don't know the previous state easily here unless we track it.
        // BUT, `updateWidgetSize` is called after `state.menuExpanded` changes.
        // So we know the TARGET state.
        // We need to know the SOURCE state to find the anchor.
        
        // Actually, let's just calculate the anchor based on CURRENT widget bounds.
        // If current size matches `dragWinSize`, we are Collapsed.
        // If current size matches `menuWidth/Height`, we are Expanded.
        
        const res = await pluginApi.call(SERVICE_ID, 'getWidget', [state.widgetId]);
        const current = res?.result;
        if (!current || !current.bounds) return;
        
        const curW = current.bounds.width;
        const curH = current.bounds.height;
        const curX = current.bounds.x;
        const curY = current.bounds.y;
        
        // Determine current anchor relative to window
        let curAnchorX, curAnchorY;
        
        // Heuristic: If size is small (< 150), assume collapsed (centered anchor)
        if (curW < 150) {
            curAnchorX = Math.floor(curW / 2);
            curAnchorY = Math.floor(curH / 2);
        } else {
            // Assume expanded. Use the last known anchor from setSize?
            // Or if we don't have it, center?
            // Ideally `setSize` is called before expansion.
            curAnchorX = state.anchor.x;
            curAnchorY = state.anchor.y;
        }
        
        // Calculate Screen Anchor
        anchorScreenX = curX + curAnchorX;
        anchorScreenY = curY + curAnchorY;
        
        // Calculate New Top-Left
        let newX, newY;
        
        if (isExpanded) {
            // Target: Expanded
            // We use state.anchor (which should be set by setSize for the expanded state)
            newX = anchorScreenX - state.anchor.x;
            newY = anchorScreenY - state.anchor.y;
        } else {
            // Target: Collapsed
            // Anchor is center of dragWinSize
            newX = anchorScreenX - Math.floor(state.dragWinSize / 2);
            newY = anchorScreenY - Math.floor(state.dragWinSize / 2);
        }
        
        state.lastWidgetPos = { x: newX, y: newY };
        
        await pluginApi.call(SERVICE_ID, 'updateWidget', [
            state.widgetId,
            { x: newX, y: newY, width: w, height: h }
        ]);
        
    } catch (e) { 
        // Suppress error 
    }
}

const functions = {
  // Renamed from createWindows but kept for compatibility if called externally
  createWindows: initWidgets, 
  initWidgets,

  setSize: async (w, h, ax, ay) => {
    state.menuWidth = w;
    state.menuHeight = h;
    if (ax !== undefined && ay !== undefined) {
        state.anchor = { x: ax, y: ay };
    }
    if (state.menuExpanded) {
        await updateWidgetSize();
    }
  },

  setWindowShape: async (type, rects) => {
      // Function stub to prevent errors from frontend
      // Service.toplayer currently does not support per-widget shape setting via API
      return true;
  },

  resizeDragWin: async (w, h) => {
    state.dragWinSize = w;
    if (!state.menuExpanded) {
        await updateWidgetSize();
    }
  },

  toggleMenu: async () => {
    state.menuExpanded = !state.menuExpanded;
    await updateWidgetSize();
    pluginApi.emit(state.eventChannel, { type: 'menu.toggle', expanded: state.menuExpanded, theme: state.lastTheme || 'classic' });
    return true;
  },

  openMenu: async () => {
    if (state.menuExpanded) return true;
    state.menuExpanded = true;
    await updateWidgetSize();
    pluginApi.emit(state.eventChannel, { type: 'menu.toggle', expanded: true, theme: state.lastTheme || 'classic' });
    return true;
  },

  closeMenu: async () => {
    if (!state.menuExpanded) return true;
    state.menuExpanded = false;
    await updateWidgetSize();
    pluginApi.emit(state.eventChannel, { type: 'menu.toggle', expanded: false, theme: state.lastTheme || 'classic' });
    return true;
  },

  setMenuState: async (expanded) => {
    const newState = !!expanded;
    if (state.menuExpanded === newState) return true;
    state.menuExpanded = newState;
    await updateWidgetSize();
    pluginApi.emit(state.eventChannel, { type: 'menu.toggle', expanded: state.menuExpanded, theme: state.lastTheme || 'classic' });
    return true;
  },

  updateTheme: async (t) => {
    state.lastTheme = t;
  },

  getDragWinPos: async () => {
    return state.lastWidgetPos;
  },

  moveDragWin: async (x, y) => {
    try {
        if (x === undefined || y === undefined) return;
        state.lastWidgetPos = { x, y };
        const w = state.menuExpanded ? state.menuWidth : state.dragWinSize;
        const h = state.menuExpanded ? state.menuHeight : state.dragWinSize;
        // Don't await - fire and forget for better responsiveness
        pluginApi.call(SERVICE_ID, 'updateWidget', [
            state.widgetId,
            { x, y, width: w, height: h }
        ]);
    } catch (e) { 
        // Suppress error
    }
  },

  // Called by renderer via IPC
  handleDrag: async (options) => {
    try {
        // Store start pos
        const res = await pluginApi.call(SERVICE_ID, 'getWidget', [state.widgetId]);
        if (res && res.result && res.result.bounds) {
            state.dragStartPos = { x: res.result.bounds.x, y: res.result.bounds.y };
        }
        // Start Drag - pass isTouch to determine drag mode
        await pluginApi.call(SERVICE_ID, 'startDrag', [{ 
            id: state.widgetId,
            isTouch: options?.isTouch || false
        }]);
        // Show overlay
        pluginApi.call(SERVICE_ID, 'showOverlay', ['点击空白区域取消拖动']);
    } catch (e) { console.error(e); }
  },

  // Called by frontend when drag ends
  endDragFromFrontend: async (x, y) => {
    try {
        // Update cached pos
        if (x !== undefined && y !== undefined) {
            state.lastWidgetPos = { x, y };
        }
        
        // Hide overlay first
        pluginApi.call(SERVICE_ID, 'hideOverlay', []);
        
        // End drag in toplayer - this restores shape
        await pluginApi.call(SERVICE_ID, 'endDrag', [{ id: state.widgetId, x, y }]);
        
        // Sync menu state - ensure backend knows menu is collapsed after drag
        if (state.menuExpanded) {
            state.menuExpanded = false;
            pluginApi.emit(state.eventChannel, { type: 'menu.toggle', expanded: false, theme: state.lastTheme || 'classic' });
        }
        
        // Emit event for any listeners
        if (pluginApi) {
            pluginApi.emit('widget.drag.end', { id: state.widgetId, x, y });
        }
        
        state.dragStartPos = null;
    } catch (e) { console.error(e); }
  },

  // Called by renderer (optional) - for backward compatibility with widget.drag.end event
  endDrag: async (x, y) => {
      try {
          // Update cached pos
          if (x !== undefined && y !== undefined) {
            state.lastWidgetPos = { x, y };
          }
          
          // Check for click
          if (state.dragStartPos) {
              const dx = Math.abs((x || state.lastWidgetPos.x) - state.dragStartPos.x);
              const dy = Math.abs((y || state.lastWidgetPos.y) - state.dragStartPos.y);
              
              if (dx < 8 && dy < 8) {
                  // Treat as click - toggle menu
                  await functions.toggleMenu();
              } else {
                  // Drag ended - just ensure state is synced
                  // No need to toggle
              }
              state.dragStartPos = null;
          }
      } catch (e) { console.error(e); }
  },



  openCompass: async () => { return functions.initWidgets(); },

  openCompassSettings: async () => {
    // ... (Same as before)
    try {
      const bgFile = path.join(__dirname, 'window.settings', 'pages', 'settings.html');
      const backgroundUrl = url.pathToFileURL(bgFile).href + `?channel=${encodeURIComponent(state.eventChannel)}&caller=${encodeURIComponent('screen-compass')}`;
      const params = {
        title: '屏幕罗盘设置',
        eventChannel: state.eventChannel,
        subscribeTopics: [state.eventChannel],
        callerPluginId: 'screen-compass',
        unique: true,
        id: 'screen-compass-settings',
        backgroundUrl,
        floatingUrl: null,
        centerItems: [
          { id: 'view-project', text: '项目', icon: 'ri-list-check', active: true },
          { id: 'view-theme', text: '主题', icon: 'ri-pantone-line', active: false }
        ],
        leftItems: [
          { id: 'save', text: '保存设置', icon: 'ri-save-3-line' },
          { id: 'add', text: '新增按钮', icon: 'ri-add-line' }
        ]
      };
      const res = await pluginApi.call('ui-lowbar', 'openTemplate', [params]);
      if (res && res.ok) return true;
      // fallback
      try {
        const d = screen.getPrimaryDisplay();
        const b = d.bounds;
        const w = 920, h = 640;
        const win = new BrowserWindow({
          x: b.x + Math.floor((b.width - w) / 2),
          y: b.y + Math.floor((b.height - h) / 2),
          width: w, height: h, frame: true, backgroundColor: '#101820', show: true, resizable: true,
          webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
        });
        win.loadFile(path.join(__dirname, 'window.settings', 'pages', 'settings.html'));
      } catch (e) { }
      return true;
    } catch (e) { return { ok: false, error: e?.message || String(e) }; }
  },

  performAction: async (button) => {
    try {
      const b = (button && button.result) ? button.result : button;
      if (!b || typeof b !== 'object') return false;
      const type = String(b.actionType || '').trim();
      const payload = b.actionPayload || {};
      if (type === 'app') {
        try { 
          const wb = { x: state.lastWidgetPos.x, y: state.lastWidgetPos.y, width: state.dragWinSize, height: state.dragWinSize };
          // Use main program's launcher API
          if (pluginApi.launcher && pluginApi.launcher.toggle) {
            pluginApi.launcher.toggle({ type: 'compass', bounds: wb });
          } else {
            // Fallback: open applications window directly
            await functions.openApplicationsWindow();
          }
          return true; 
        } catch (e) { return { ok: false, error: e?.message || String(e) }; }
      }
      if (type === 'plugin') {
        const pid = String(payload.pluginId || '').trim();
        const fn = String(payload.fn || '').trim();
        const args = Array.isArray(payload.args) ? payload.args : [];
        if (!pid || !fn) return false;
        await pluginApi.call(pid, fn, args);
        return true;
      }
      if (type === 'pluginEvent') {
        const pid = String(payload.pluginId || '').trim();
        const evt = String(payload.event || '').trim();
        const args = Array.isArray(payload.args) ? payload.args : [];
        if (!pid || !evt) return false;
        await pluginApi.call(pid, evt, args);
        return true;
      }
      if (type === 'program') {
        const p = String(payload.path || '').trim();
        const args = Array.isArray(payload.args) ? payload.args : [];
        if (!p) return false;
        try { const child = spawn(p, args, { detached: true, stdio: 'ignore' }); child.unref(); return true; } catch (e) { return { ok: false, error: e?.message || String(e) }; }
      }
      if (type === 'openApp') {
        const p = String(payload.path || '').trim();
        const args = Array.isArray(payload.args) ? payload.args : [];
        if (!p) return false;
        try { if (p.toLowerCase().endsWith('.lnk')) { try { await shell.openPath(p); return true; } catch (e) { } } const child = spawn(p, args, { detached: true, stdio: 'ignore' }); child.unref(); return true; } catch (e) { return { ok: false, error: e?.message || String(e) }; }
      }
      if (type === 'command') {
        const cmd = String(payload.cmd || '').trim();
        if (!cmd) return false;
        try {
          if (process.platform === 'win32') { const child = spawn('cmd', ['/c', cmd], { windowsHide: true, detached: true, stdio: 'ignore' }); child.unref(); }
          else { const sh = spawn('bash', ['-lc', cmd], { detached: true, stdio: 'ignore' }); sh.unref(); }
          return true;
        } catch (e) { return { ok: false, error: e?.message || String(e) }; }
      }
      if (type === 'cmd') {
        const cmd = String(payload.cmd || '').trim();
        if (!cmd) return false;
        try {
          if (process.platform === 'win32') { const child = spawn('cmd', ['/c', cmd], { windowsHide: true, detached: true, stdio: 'ignore' }); child.unref(); }
          else { const sh = spawn('bash', ['-lc', cmd], { detached: true, stdio: 'ignore' }); sh.unref(); }
          return true;
        } catch (e) { return { ok: false, error: e?.message || String(e) }; }
      }
      if (type === 'power') {
        const op = String(payload.op || 'shutdown').trim();
        try {
          if (process.platform === 'win32') {
            let c = ''; if (op === 'shutdown') c = 'shutdown -s -t 0'; else if (op === 'restart') c = 'shutdown -r -t 0'; else if (op === 'logoff') c = 'shutdown -l';
            if (!c) return false; const child = spawn('cmd', ['/c', c], { windowsHide: true, detached: true, stdio: 'ignore' }); child.unref();
          } else {
            // ...
          }
          return true;
        } catch (e) { return { ok: false, error: e?.message || String(e) }; }
      }
      return false;
    } catch (e) { return { ok: false, error: e?.message || String(e) }; }
  },

  openApplicationsWindow: () => {
    try {
      const targetW = 420;
      const targetH = 520;
      const computePos = () => {
        let nx = 0; let ny = 0;
        let useW = targetW; let useH = targetH;
        try {
           // Use cached widget pos
           const wb = { x: state.lastWidgetPos.x, y: state.lastWidgetPos.y, width: state.dragWinSize, height: state.dragWinSize };
           nx = wb.x + Math.floor((wb.width - useW) / 2);
           ny = wb.y - useH - 8;
            
           const display = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint({ x: nx + Math.floor(useW / 2), y: ny + Math.floor(useH / 2) }) : screen.getPrimaryDisplay();
           const sb = display.bounds;
           if (nx < sb.x) nx = sb.x;
           if (ny < sb.y) ny = sb.y;
           if (nx + useW > sb.x + sb.width) nx = sb.x + sb.width - useW;
           if (ny + useH > sb.y + sb.height) ny = sb.y + sb.height - useH;
           return { x: nx, y: ny, width: useW, height: useH };
        } catch (e) { }
        const d = screen.getPrimaryDisplay();
        const b = d.bounds;
        return { x: b.x + Math.floor((b.width - useW) / 2), y: b.y + Math.floor((b.height - useH) / 2), width: useW, height: useH };
      };
      if (appWin && !appWin.isDestroyed()) { try { appWin.show(); appWin.focus(); } catch (e) { } return true; }
      const pos = computePos();
      const isLinux = process.platform === 'linux';
      appWin = new BrowserWindow({
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        useContentSize: true,
        frame: false,
        transparent: false,
        backgroundColor: '#101820',
        show: true,
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        type: isLinux ? 'toolbar' : undefined,
        focusable: true,
        hasShadow: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
      });
      appWin.loadFile(path.join(__dirname, 'layer.appMenu', 'index.html'));
      try { appWin.on('closed', () => { appWin = null; }); } catch (e) { }

      // Auto-close on blur
      try {
        appWin.on('blur', () => {
          setTimeout(() => {
            try {
              if (appWin && !appWin.isDestroyed() && !appWin.isFocused()) {
                functions.closeApplicationsWindow();
              }
            } catch (e) { }
          }, 150);
        });
      } catch (e) { }

      try { pluginApi.emit(state.eventChannel, { type: 'app.active', active: true }); } catch (e) { }
      return true;
    } catch (e) { return false; }
  },

  closeApplicationsWindow: () => {
    try {
      const had = !!(appWin && !appWin.isDestroyed());
      if (had) { try { appWin.close(); } catch (e) { } appWin = null; }
      try { pluginApi.emit(state.eventChannel, { type: 'app.active', active: false }); } catch (e) { }
      return had;
    } catch (e) { return false; }
  },

  listPlugins: () => { 
    try { 
      let pmPath = path.join(app.getAppPath(), 'src', 'main', 'Manager', 'Plugins', 'Main.js');
      if (!fs.existsSync(pmPath)) {
          pmPath = path.join(app.getAppPath(), 'src', 'main', 'pluginManager.js');
      }
      const pm = require(pmPath); 
      return pm.getPlugins(); 
    } catch (e) { return []; } 
  },
  listAutomationEvents: (pluginId) => { 
    try { 
      let pmPath = path.join(app.getAppPath(), 'src', 'main', 'Manager', 'Plugins', 'Main.js');
      if (!fs.existsSync(pmPath)) pmPath = path.join(app.getAppPath(), 'src', 'main', 'pluginManager.js');
      const pm = require(pmPath); 
      const res = pm.listAutomationEvents(pluginId); 
      return (res && res.ok && Array.isArray(res.events)) ? res.events : []; 
    } catch (e) { return []; } 
  },
  listInstalledApps: async () => {
    try {
      if (process.platform !== 'win32') return [];
      const now = Date.now();
      if (__appsCache.list.length && (now - __appsCache.ts) < 600000) return __appsCache.list.slice(0, 300);
      if (!__appsCache.list.length) { await buildAppsCache(); } else if (!__appsCache.building) { __appsCache.building = true; buildAppsCache().finally(() => { __appsCache.building = false; }); }
      return __appsCache.list.slice(0, 120);
    } catch (e) { return []; }
  },
  getFileIconDataUrl: async (p) => {
    try {
      const fp = String(p || ''); if (!fp) return '';
      let usePath = fp;
      try { const target = resolveShortcutTarget(fp); if (target) usePath = target; } catch (e) { }
      const img = await app.getFileIcon(usePath, { size: 'normal' });
      if (!img || img.isEmpty()) return '';
      return img.toDataURL();
    } catch (e) { return ''; }
  },
  setDragging: (flag, offsetX, offsetY, inputType) => { return true; },
  onLowbarEvent: async (payload = {}) => {
    try {
      if (payload?.type === 'left.click') {
        if (payload.id === 'save') emitUpdate('apply.save', true);
        if (payload.id === 'add') emitUpdate('apply.add', true);
      } else if (payload?.type === 'click') {
        if (payload.id === 'view-project') {
          emitUpdate('centerItems', [
            { id: 'view-project', text: '项目', icon: 'ri-list-check', active: true },
            { id: 'view-theme', text: '主题', icon: 'ri-pantone-line', active: false }
          ]);
          emitUpdate('switch.page', 'project');
        }
        if (payload.id === 'view-theme') {
          emitUpdate('centerItems', [
            { id: 'view-project', text: '项目', icon: 'ri-list-check', active: false },
            { id: 'view-theme', text: '主题', icon: 'ri-pantone-line', active: true }
          ]);
          emitUpdate('switch.page', 'theme');
        }
      }
      return true;
    } catch (e) { return { ok: false, error: e?.message || String(e) }; }
  },
  openItemEditor: async (index) => {
    try {
      const floatingFile = path.join(__dirname, 'window.settings', 'pages', 'editor.html');
      const urlStr = url.pathToFileURL(floatingFile).href + `?channel=${encodeURIComponent(state.eventChannel)}&caller=${encodeURIComponent('screen-compass')}&index=${encodeURIComponent(String(index || 0))}`;
      emitUpdate('floatingUrl', urlStr);
      return true;
    } catch (e) { return { ok: false, error: e?.message || String(e) }; }
  },
  closeItemEditor: async () => { try { emitUpdate('floatingUrl', null); return true; } catch (e) { return { ok: false, error: e?.message || String(e) }; } },
  broadcastButtons: async (payload = {}) => {
    try {
      emitUpdate('buttons.update', payload);
      return true;
    } catch (e) { return { ok: false, error: e?.message || String(e) }; }
  },
  snap: () => { },
  logSnapshot: () => { },
  setExpandedWindow: () => { }
};

const init = async (api) => {
  pluginApi = api;
  try {
    if (!pluginApi.logWrite) {
      pluginApi.logWrite = (level, ...args) => { try { console.log(...args); } catch (e) { } };
    }
    if (!pluginApi.log) {
      pluginApi.log = (msg) => { try { pluginApi.logWrite('info', String(msg || '')); } catch (e) { } };
    }
  } catch (e) { }

  const ready = () => { functions.initWidgets(); };
  if (app.isReady()) ready(); else app.once('ready', ready);
};

module.exports = { name: '屏幕罗盘', version: '0.2.0', init, functions };