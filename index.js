const path = require('path');
const url = require('url');
const { BrowserWindow, app, screen, nativeImage, shell, ipcMain } = require('electron');

let user32 = null;
let GetForegroundWindow = null;
let SetForegroundWindow = null;
let lastExternalWindowHandle = null;

let __dragLogs = [];
function addDragLog(msg) {
  if (__dragLogs.length > 500) __dragLogs.shift();
  __dragLogs.push(`[${new Date().toLocaleTimeString()}.${String(Date.now() % 1000).padStart(3, '0')}] ${msg}`);
}

// Helper for shortcut resolution
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;

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

let pluginApi = null;
let dragWin = null;
let menuWin = null;

function emitUpdate(target, value) { try { pluginApi.emit(state.eventChannel, { type: 'update', target, value }); } catch (e) { } }

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

function syncMenuPos() {
  try {
    if (!dragWin || dragWin.isDestroyed()) return;
    if (!menuWin || menuWin.isDestroyed()) return;

    const b = dragWin.getBounds();
    // Center of dragWin
    const cx = b.x + Math.floor(b.width / 2);
    const cy = b.y + Math.floor(b.height / 2);

    // We want to align menuWin's ANCHOR point to (cx, cy).
    // menuWin TopLeft = (cx - anchorX, cy - anchorY)

    const ax = (state.menuAnchorX !== undefined) ? state.menuAnchorX : Math.floor(state.menuWidth / 2);
    const ay = (state.menuAnchorY !== undefined) ? state.menuAnchorY : Math.floor(state.menuHeight / 2);

    const mx = cx - ax;
    const my = cy - ay;

    menuWin.setBounds({
      x: mx,
      y: my,
      width: state.menuWidth,
      height: state.menuHeight
    });
  } catch (e) { }
}

function createWindows() {
  try {
    if (dragWin && !dragWin.isDestroyed()) return;

    const pt = screen.getCursorScreenPoint ? screen.getCursorScreenPoint() : { x: 0, y: 0 };
    const d = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint(pt) : screen.getPrimaryDisplay();
    const b = d.bounds;

    // --- Drag Window (Button) ---
    // User Request 5: Default size 48px -> Fixed: 80px to avoid clipping
    const w = 80, h = 80, mr = 24, mb = 32;
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

    dragWin.loadFile(path.join(__dirname, 'layer.surface', 'index.html'));

    try { dragWin.setAlwaysOnTop(true, 'screen-saver'); } catch (e) { }
    try { dragWin.setVisibleOnAllWorkspaces(true); } catch (e) { }

    // 应用层
    menuWin = new BrowserWindow({
      width: state.menuWidth || 240,
      height: state.menuHeight || 240,
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

    menuWin.loadFile(path.join(__dirname, 'layer.application', 'index.html'));

    // 层级调整
    const maintainZOrder = () => {
      try {
        if (menuWin && !menuWin.isDestroyed()) {
          menuWin.setAlwaysOnTop(true, 'screen-saver');
        }
        if (dragWin && !dragWin.isDestroyed()) {
          dragWin.setAlwaysOnTop(true, 'screen-saver');
        }
      } catch (e) { }
    };
    maintainZOrder();

    // --- Event Handling ---

    let focusStartPos = null;
    let focusMoved = false;

    // 1. Drag Window Move Event
    dragWin.on('move', () => {
      focusMoved = true;
      state.lastMoveTs = Date.now();
      syncMenuPos();
    });

    // 2. Focus Logic (Smart Click)
    // User Request 6: "When dragWin gets focus... if drag position is small determine as open... immediately let app layer focus"

    let lastToggleTime = 0;

    dragWin.on('focus', () => {
      try {
        if (!dragWin || dragWin.isDestroyed()) return;

        const now = Date.now();
        if (now - lastToggleTime < 300) return; // Debounce

        focusStartPos = dragWin.getBounds();
        focusMoved = false;

        // Wait to distinguish click from drag start
        setTimeout(async () => {
          if (!dragWin || dragWin.isDestroyed()) return;

          // If moved flag was set by 'move' handler, treat as drag, not click
          if (focusMoved) return;

          // Double check position just in case
          const currentPos = dragWin.getBounds();
          const dx = Math.abs(currentPos.x - focusStartPos.x);
          const dy = Math.abs(currentPos.y - focusStartPos.y);

          if (dx < 8 && dy < 8) { // Increased threshold slightly
            // It's a click
            lastToggleTime = Date.now();
            const opened = await functions.toggleMenu();

            // If opened (or was open), focus app layer
            if (opened && menuWin && menuWin.isVisible()) {
              menuWin.focus();
              // dragWin will naturally lose focus to menuWin
            } else {
              // If CLOSED, we MUST force dragWin to lose focus so next click triggers 'focus' again.
              if (SetForegroundWindow && lastExternalWindowHandle) {
                SetForegroundWindow(lastExternalWindowHandle);
              } else {
                dragWin.blur();
                createDummyFocusStealer();
              }
            }
          }
        }, 150);
      } catch (e) { }
    });

    const createDummyFocusStealer = () => {
      try {
        let dummy = new BrowserWindow({
          width: 1, height: 1,
          x: -100, y: -100,
          show: false,
          frame: false,
          skipTaskbar: true,
          focusable: true
        });
        dummy.show();
        dummy.focus();
        setTimeout(() => {
          dummy.close();
          dummy = null;
        }, 50);
      } catch (e) { }
    };

    // Ensure dragWin stays on top when menuWin gets focus
    menuWin.on('focus', () => {
      try { if (dragWin && !dragWin.isDestroyed()) dragWin.moveTop(); } catch (e) { }
    });

    // Initial sync
    setTimeout(syncMenuPos, 100);

    dragWin.on('closed', () => { dragWin = null; if (menuWin) menuWin.close(); });
    menuWin.on('closed', () => { menuWin = null; });

  } catch (e) { console.error(e); }
}

const functions = {
  createWindows,

  setSize: async (w, h, ax, ay) => {
    state.menuWidth = w;
    state.menuHeight = h;
    // Store Anchor Points (relative to menuWin top-left)
    state.menuAnchorX = (ax !== undefined) ? ax : Math.floor(w / 2);
    state.menuAnchorY = (ay !== undefined) ? ay : Math.floor(h / 2);

    if (menuWin && !menuWin.isDestroyed()) {
      menuWin.setSize(w, h);
      syncMenuPos();
    }
  },

  resizeDragWin: async (w, h) => {
    try {
      if (dragWin && !dragWin.isDestroyed()) {
        state.dragWinSize = w; // Approximate, as w includes shadow
        // Keep center position
        const b = dragWin.getBounds();
        const cx = b.x + Math.floor(b.width / 2);
        const cy = b.y + Math.floor(b.height / 2);
        const nx = cx - Math.floor(w / 2);
        const ny = cy - Math.floor(h / 2);
        dragWin.setBounds({ x: nx, y: ny, width: w, height: h });
        syncMenuPos();
        return true;
      }
    } catch (e) { }
    return false;
  },

  toggleMenu: async () => {
    try {
      if (!menuWin || menuWin.isDestroyed()) return functions.createWindows();
      if (menuWin.isVisible()) {
        return await functions.closeMenu();
      } else {
        return await functions.openMenu();
      }
    } catch (e) { return false; }
  },

  openMenu: async () => {
    try {
      if (!menuWin || menuWin.isDestroyed()) return;
      if (!dragWin || dragWin.isDestroyed()) return;

      syncMenuPos();

      menuWin.show();
      menuWin.focus(); // Focus application layer

      // Do NOT hide dragWin, keep it as the center button
      try { dragWin.moveTop(); } catch (e) { }

      pluginApi.emit(state.eventChannel, { type: 'menu.toggle', expanded: true, theme: state.lastTheme || 'classic' });
      return true;
    } catch (e) { return false; }
  },

  closeMenu: async () => {
    try {
      if (!menuWin || menuWin.isDestroyed()) return;
      menuWin.hide();

      // Show dragWin (if it was hidden, though we don't hide it now)
      if (dragWin && !dragWin.isDestroyed()) {
        dragWin.show();
        setTimeout(() => { try { dragWin.moveTop(); } catch (e) { } }, 50);
      }

      pluginApi.emit(state.eventChannel, { type: 'menu.toggle', expanded: false, theme: state.lastTheme || 'classic' });

      // Restore focus to external window
      if (SetForegroundWindow && lastExternalWindowHandle) {
        try { SetForegroundWindow(lastExternalWindowHandle); } catch (e) { }
      }

      return true;
    } catch (e) { return false; }
  },


  updateTheme: async (t) => {
    state.lastTheme = t;
  },

  getDragWinPos: async () => {
    try {
      if (dragWin && !dragWin.isDestroyed()) {
        const b = dragWin.getBounds();
        return { x: b.x, y: b.y };
      }
    } catch (e) { }
    return null;
  },

  moveDragWin: async (x, y) => {
    try {
      if (dragWin && !dragWin.isDestroyed()) {
        dragWin.setPosition(Math.round(x), Math.round(y));
        return true;
      }
    } catch (e) { }
    return false;
  },

  setWindowShape: async (type, rects) => {
    try {
      if (process.platform !== 'win32') return true;
      let win = null;
      if (type === 'surface') win = dragWin;
      else if (type === 'application') win = menuWin;

      if (win && !win.isDestroyed()) {
        if (!Array.isArray(rects) || rects.length === 0) {
          win.setShape([]);
        } else {
          // Ensure integers
          const safeRects = rects.map(r => ({
            x: Math.round(r.x), y: Math.round(r.y),
            width: Math.round(r.width), height: Math.round(r.height)
          }));
          win.setShape(safeRects);
        }
        return true;
      }
    } catch (e) { }
    return false;
  },

  openCompass: async () => { return functions.createWindows(); },

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

  // ... Keep existing helpers like performAction, listPlugins etc.
  performAction: async (button) => {
    // ... (Keep existing implementation)
    try {
      const b = (button && button.result) ? button.result : button;
      if (!b || typeof b !== 'object') return false;
      const type = String(b.actionType || '').trim();
      const payload = b.actionPayload || {};
      if (type === 'app') {
        try {
          if (pluginApi && pluginApi.launcher) {
            // Pass current dragWin bounds to the launcher for positioning
            let bounds = null;
            if (dragWin && !dragWin.isDestroyed()) {
              bounds = dragWin.getBounds();
            }
            pluginApi.launcher.open({ bounds, type: 'compass' });
            return true;
          }
          return false;
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

  // (Removed openApplicationsWindow, closeApplicationsWindow, listInstalledApps)
  // Keep getFileIconDataUrl if used by layer.application?
  // layer.application might show icons too?
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

  // Legacy / IPC handlers
  setDragging: (flag, offsetX, offsetY, inputType) => {
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

  // Snapshot/Snap helpers (simplified)
  snap: () => { },
  logSnapshot: () => { },
  setExpandedWindow: () => { } // Deprecated as we handle it internally now
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
    
    // Initialize Native Utils via Plugin API (to avoid require('koffi') failure)
    if (pluginApi.native && pluginApi.native.koffi) {
        const koffi = pluginApi.native.koffi;
        try {
            user32 = koffi.load('user32.dll');
            GetForegroundWindow = user32.func('void *GetForegroundWindow()');
            SetForegroundWindow = user32.func('bool SetForegroundWindow(void *hwnd)');
            
            // Track focus
            setInterval(() => {
              try {
                if (!GetForegroundWindow) return;
                const hwnd = GetForegroundWindow();
                if (!hwnd) return;
                
                // Check if it is our window
                let isOurs = false;
                const check = (win) => {
                  if (win && !win.isDestroyed()) {
                    const h = win.getNativeWindowHandle();
                    // Compare addresses (BigInt)
                    if (koffi.address(hwnd) === koffi.address(h)) return true;
                  }
                  return false;
                };
                
                if (check(dragWin) || check(menuWin)) isOurs = true;
                
                if (!isOurs) {
                  lastExternalWindowHandle = hwnd;
                }
              } catch (e) { }
            }, 250);
            
        } catch (e) { 
            pluginApi.log('Native Init Failed: ' + e.message);
        }
    }
    
  } catch (e) { }
  const ready = () => { functions.createWindows(); };
  if (app.isReady()) ready(); else app.once('ready', ready);
};

module.exports = { name: '屏幕罗盘', version: '0.2.0', init, functions };
