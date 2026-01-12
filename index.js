const path = require('path');
const url = require('url');
const { BrowserWindow, app, screen, nativeImage, shell, ipcMain } = require('electron');

let __dragLogs = [];
function addDragLog(msg) {
  if (__dragLogs.length > 500) __dragLogs.shift();
  __dragLogs.push(`[${new Date().toLocaleTimeString()}.${String(Date.now()%1000).padStart(3,'0')}] ${msg}`);
}

// Helper for shortcut resolution
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;

function resolveShortcutTarget(p) {
  try {
    const fp = String(p||''); if (!fp || process.platform !== 'win32') return '';
    if (String(fp).toLowerCase().endsWith('.lnk')) {
      const cmd = `(New-Object -COM WScript.Shell).CreateShortcut('${fp.replace(/'/g, "''")}').TargetPath`;
      const out = execFileSync('powershell', ['-NoProfile','-ExecutionPolicy','Bypass','-Command', cmd], { encoding: 'utf8' });
      const target = String(out||'').trim();
      return target || '';
    }
    return '';
  } catch (e) { return ''; }
}

let __appsCache = { ts: 0, list: [], building: false };
async function buildAppsCache() {
  // ... (Keep existing implementation)
  try {
    if (process.platform !== 'win32') { __appsCache.list = []; __appsCache.ts = Date.now(); return; }
    const roots = [
      path.join(String(process.env['ProgramData']||''), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(String(process.env['AppData']||''), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
    ].filter(p => p && fs.existsSync(p));
    const out = [];
    const seen = new Set();
    const isExe = (p) => String(p||'').toLowerCase().endsWith('.exe');
    const isLnk = (p) => String(p||'').toLowerCase().endsWith('.lnk');
    const pushApp = (p) => { try { const key = String(p||'').toLowerCase(); if (!key) return; if (seen.has(key)) return; seen.add(key); const nm = path.basename(p, path.extname(p)); out.push({ name: nm, path: p }); } catch (e) {} };
    const walk = async (dir, depth) => {
      try {
        const ents = await fsp.readdir(dir, { withFileTypes: true });
        for (const d of ents) {
          const p1 = path.join(dir, d.name);
          if (d.isFile() && (isExe(p1) || isLnk(p1))) { pushApp(p1); continue; }
          if (d.isDirectory() && depth < 2) { await walk(p1, depth + 1); }
        }
      } catch (e) {}
    };
    for (const r of roots) { await walk(r, 0); }
    __appsCache.list = out.slice(0, 800);
    __appsCache.ts = Date.now();
  } catch (e) { __appsCache.list = []; __appsCache.ts = Date.now(); }
}

let pluginApi = null;
let dragWin = null;
let menuWin = null;
let appWin = null;

function emitUpdate(target, value){ try { pluginApi.emit(state.eventChannel, { type: 'update', target, value }); } catch (e) {} }

const state = {
  eventChannel: 'screen-compass-channel',
  dragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  dragStartWinX: 0,
  dragStartWinY: 0,
  dragInputType: 'mouse',
  menuExpanded: false,
  menuWidth: 240,
  menuHeight: 240,
  menuCenterX: 120, // Offset of center from top-left
  menuCenterY: 120,
  dragWinSize: 50,
  touchLogLastTs: 0,
  lastMoveTs: Date.now(),
  isStartup: true // Flag to ignore initial focus
};

function createWindows() {
  try {
    if (dragWin && !dragWin.isDestroyed()) return;

    const pt = screen.getCursorScreenPoint ? screen.getCursorScreenPoint() : { x: 0, y: 0 };
    const d = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint(pt) : screen.getPrimaryDisplay();
    const b = d.bounds;
    
    // --- Drag Window (Button) ---
    const w = 50, h = 50, mr = 24, mb = 32;
    state.dragWinSize = w;
    const isLinux = process.platform === 'linux';
    
    dragWin = new BrowserWindow({
      x: b.x + b.width - w - mr,
      y: b.y + b.height - h - mb,
      width: w,
      height: h,
      useContentSize: true,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      show: true,
      resizable: false,
      movable: true, // Native drag allowed
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    
    dragWin.loadFile(path.join(__dirname, 'float', 'drag.html'));
    
    try { dragWin.setAlwaysOnTop(true, 'screen-saver'); } catch (e) {}
    try { dragWin.setVisibleOnAllWorkspaces(true); } catch (e) {}
    
    // --- Menu Window (Application Layer) ---
    // Initially hidden or transparent. We keep it shown but handle visibility via content/opacity to avoid flicker?
    // User says "automatically focuses the application layer... judged as opening compass operation"
    // Let's create it initially hidden to be safe.
    menuWin = new BrowserWindow({
      width: 240,
      height: 240,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      show: false, // Hidden initially
      resizable: false,
      movable: false, // Moved by code
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      alwaysOnTop: true, // Below dragWin ideally. 
      focusable: true,
      hasShadow: false,
      type: 'toolbar', // Use toolbar type to help with Z-order
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    
    menuWin.loadFile(path.join(__dirname, 'float', 'menu.html'));
    
    // Ensure dragWin is on top of menuWin
    const maintainZOrder = () => {
        try {
            if (menuWin && !menuWin.isDestroyed()) {
                menuWin.setAlwaysOnTop(true, 'screen-saver');
            }
            if (dragWin && !dragWin.isDestroyed()) {
                dragWin.setAlwaysOnTop(true, 'screen-saver');
            }
        } catch(e) {}
    };
    maintainZOrder();

    // --- Event Handling ---
    
    // Sync positions
    const syncMenuPos = () => {
        if (!dragWin || dragWin.isDestroyed()) return;
        if (!menuWin || menuWin.isDestroyed()) return;
        
        const db = dragWin.getBounds();
        const mb = menuWin.getBounds();
        
        // Center menuWin on dragWin based on current menuCenter offsets
        const cx = db.x + Math.floor(db.width / 2);
        const cy = db.y + Math.floor(db.height / 2);
        
        const mx = cx - (state.menuCenterX || Math.floor(mb.width / 2));
        const my = cy - (state.menuCenterY || Math.floor(mb.height / 2));
        
        menuWin.setBounds({ x: mx, y: my, width: mb.width, height: mb.height });
        
        // Also sync AppWin if exists
        if (appWin && !appWin.isDestroyed()) {
             const awb = appWin.getBounds();
             const ax = cx - Math.floor(awb.width / 2);
             const ay = my - awb.height - 8; // Position above menu? Or relative to center.
             // Original logic was relative to menu bottom.
             appWin.setPosition(ax, ay);
        }
        
        // Reinforce Z-order during moves
        try { dragWin.moveTop(); } catch(e) {}
    };

    // 1. Drag Window Move Event
    dragWin.on('move', () => {
        state.lastMoveTs = Date.now();
        syncMenuPos();
    });
    
    // 2. Focus/Open Logic
    let focusTimer = null;
    dragWin.on('focus', () => {
        // Ignore initial focus on startup
        if (state.isStartup) {
            state.isStartup = false;
            return;
        }

        // When dragWin gains focus, start a timer.
        // If no move occurs within threshold, open menu.
        if (focusTimer) clearTimeout(focusTimer);
        const checkTs = Date.now();
        focusTimer = setTimeout(() => {
            const now = Date.now();
            // If we moved recently (since focus start), ignore
            if (now - state.lastMoveTs < 200) {
                // Moved recently, do nothing (drag operation)
            } else {
                // No move, open compass
                functions.openMenu();
            }
        }, 200); // Short time
    });
    
    // Ensure dragWin stays on top when menuWin gets focus
    menuWin.on('focus', () => {
        try { if(dragWin && !dragWin.isDestroyed()) dragWin.moveTop(); } catch(e){}
    });
    
    // Initial sync
    setTimeout(syncMenuPos, 100);
    
    dragWin.on('closed', () => { dragWin = null; if(menuWin) menuWin.close(); });
    menuWin.on('closed', () => { menuWin = null; });

  } catch (e) { console.error(e); }
}

const functions = {
  createWindows,
  
  openMenu: async () => {
    try {
        if (!menuWin || menuWin.isDestroyed()) return;
        if (!dragWin || dragWin.isDestroyed()) return;
        
        // Sync position first
        const db = dragWin.getBounds();
        const mw = 240, mh = 240; // Default expanded size
        const cx = db.x + Math.floor(db.width / 2);
        const cy = db.y + Math.floor(db.height / 2);
        const mx = cx - Math.floor(mw / 2);
        const my = cy - Math.floor(mh / 2);
        
        menuWin.setBounds({ x: mx, y: my, width: mw, height: mh });
        menuWin.show();
        menuWin.focus(); // Focus application layer
        
        // Hide dragWin when menu is expanded
        try { dragWin.hide(); } catch(e){}
        
        pluginApi.emit(state.eventChannel, { type: 'menu.toggle', expanded: true });
        return true;
    } catch(e) { return false; }
  },
  
  closeMenu: async () => {
      try {
          if (!menuWin || menuWin.isDestroyed()) return;
          menuWin.hide();
          
          // Show dragWin when menu is collapsed
          if (dragWin && !dragWin.isDestroyed()) {
              dragWin.show();
              // Small delay to ensure it's on top and visible
              setTimeout(() => { try { dragWin.moveTop(); } catch(e){} }, 50);
          }

          pluginApi.emit(state.eventChannel, { type: 'menu.toggle', expanded: false });
          return true;
      } catch(e) { return false; }
  },

  openCompass: async () => { return functions.createWindows(); },
  
  openCompassSettings: async () => {
      // ... (Same as before)
      try {
      const bgFile = path.join(__dirname, 'background', 'settings.html');
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
        win.loadFile(path.join(__dirname, 'background', 'settings.html'));
      } catch (e) {}
      return true;
    } catch (e) { return { ok: false, error: e?.message || String(e) }; }
  },
  
  // ... Keep existing helpers like performAction, listPlugins etc.
  performAction: async (button) => {
    // ... (Keep existing implementation)
    try {
      const b = (button && button.result) ? button.result : button;
      if (!b || typeof b !== 'object') return false;
      const type = String(b.actionType || '').trim();
      const payload = b.actionPayload || {};
      if (type === 'app') {
        try { const opened = await functions.openApplicationsWindow(); return !!opened; } catch (e) { return { ok: false, error: e?.message || String(e) }; }
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
        try { if (p.toLowerCase().endsWith('.lnk')) { try { await shell.openPath(p); return true; } catch (e) {} } const child = spawn(p, args, { detached: true, stdio: 'ignore' }); child.unref(); return true; } catch (e) { return { ok: false, error: e?.message || String(e) }; }
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
    // ... (Keep mostly same, adapt positioning)
    try {
      const targetW = 420;
      const targetH = 520;
      const computePos = () => {
        let nx = 0; let ny = 0;
        let useW = targetW; let useH = targetH;
        try {
          if (dragWin && !dragWin.isDestroyed()) {
            const wb = dragWin.getBounds();
            nx = wb.x + Math.floor((wb.width - useW) / 2);
            ny = wb.y - useH - 8;
            // ... boundary checks ...
             const display = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint({ x: nx + Math.floor(useW / 2), y: ny + Math.floor(useH / 2) }) : screen.getPrimaryDisplay();
            const sb = display.bounds;
            if (nx < sb.x) nx = sb.x;
            if (ny < sb.y) ny = sb.y;
            if (nx + useW > sb.x + sb.width) nx = sb.x + sb.width - useW;
            if (ny + useH > sb.y + sb.height) ny = sb.y + sb.height - useH;
            return { x: nx, y: ny, width: useW, height: useH };
          }
        } catch (e) {}
        const d = screen.getPrimaryDisplay();
        const b = d.bounds;
        return { x: b.x + Math.floor((b.width - useW) / 2), y: b.y + Math.floor((b.height - useH) / 2), width: useW, height: useH };
      };
      if (appWin && !appWin.isDestroyed()) { try { appWin.show(); appWin.focus(); } catch (e) {} return true; }
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
      appWin.loadFile(path.join(__dirname, 'background', 'app-window.html'));
      try { appWin.on('closed', () => { appWin = null; }); } catch (e) {}
      try { pluginApi.emit(state.eventChannel, { type: 'app.active', active: true }); } catch (e) {}
      return true;
    } catch (e) { return false; }
  },
  
  closeApplicationsWindow: () => {
    try {
      const had = !!(appWin && !appWin.isDestroyed());
      if (had) { try { appWin.close(); } catch (e) {} appWin = null; }
      try { pluginApi.emit(state.eventChannel, { type: 'app.active', active: false }); } catch (e) {}
      return had;
    } catch (e) { return false; }
  },
  
  // Keep required exports
  listPlugins: () => { try { const pm = require(path.join(app.getAppPath(), 'src', 'main', 'pluginManager.js')); return pm.getPlugins(); } catch(e){return [];} },
  listAutomationEvents: (pluginId) => { try { const pm = require(path.join(app.getAppPath(), 'src', 'main', 'pluginManager.js')); const res = pm.listAutomationEvents(pluginId); return (res&&res.ok&&Array.isArray(res.events)) ? res.events : []; } catch(e){return [];} },
  listInstalledApps: () => {
      // (Copy existing implementation or minimal version)
      try {
        if (process.platform !== 'win32') return [];
        const now = Date.now();
        if (__appsCache.list.length && (now - __appsCache.ts) < 600000) return __appsCache.list.slice(0, 300);
        if (!__appsCache.building) { __appsCache.building = true; buildAppsCache().finally(() => { __appsCache.building = false; }); }
        return __appsCache.list.slice(0, 120);
      } catch (e) { return []; }
  },
  getFileIconDataUrl: async (p) => {
    try {
      const fp = String(p||''); if (!fp) return '';
      let usePath = fp;
      try { const target = resolveShortcutTarget(fp); if (target) usePath = target; } catch (e) {}
      const img = await app.getFileIcon(usePath, { size: 'normal' });
      if (!img || img.isEmpty()) return '';
      return img.toDataURL();
    } catch (e) { return ''; }
  },
  
  // Legacy / IPC handlers
  setDragging: (flag, offsetX, offsetY, inputType) => {
      // This might be called from old code or drag.js if we keep manual drag.
      // But if we use native drag, this might not be needed or only for updates.
      return true;
  },
  
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
      const floatingFile = path.join(__dirname, 'background', 'editor.html');
      const urlStr = url.pathToFileURL(floatingFile).href + `?channel=${encodeURIComponent(state.eventChannel)}&caller=${encodeURIComponent('screen-compass')}&index=${encodeURIComponent(String(index||0))}`;
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
  
  // Snapshot/Snap helpers (simplified)
  snap: () => {},
  logSnapshot: () => {},
  setExpandedWindow: () => {} // Deprecated as we handle it internally now
};

const init = async (api) => {
  pluginApi = api;
  try {
    if (!pluginApi.logWrite) {
      pluginApi.logWrite = (level, ...args) => { try { console.log(...args); } catch (e) {} };
    }
    if (!pluginApi.log) {
      pluginApi.log = (msg) => { try { pluginApi.logWrite('info', String(msg||'')); } catch (e) {} };
    }
  } catch (e) {}
  const ready = () => { functions.createWindows(); };
  if (app.isReady()) ready(); else app.once('ready', ready);
};

module.exports = { name: '屏幕罗盘', version: '0.2.0', init, functions };
