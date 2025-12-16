const path = require('path');
const url = require('url');
const { BrowserWindow, app, screen, nativeImage, shell } = require('electron');

let __dragTracker = { timer: null };
function startDragTracking() {
  try {
    stopDragTracking();
    __dragTracker.timer = setInterval(() => {
      try {
        const pt = screen.getCursorScreenPoint ? screen.getCursorScreenPoint() : { x: 0, y: 0 };
        const nx = Math.floor(pt.x - state.dragOffsetX);
        const ny = Math.floor(pt.y - state.dragOffsetY);
        functions.moveTo(nx, ny);
      } catch {}
    }, 16);
  } catch {}
}
function stopDragTracking() {
  try { if (__dragTracker.timer) clearInterval(__dragTracker.timer); __dragTracker.timer = null; } catch {}
}
function lockWindowSize(w, h) {
  try {
    if (!compassWin || compassWin.isDestroyed()) return;
    const W = Math.max(1, Math.floor(Number(w || 0)));
    const H = Math.max(1, Math.floor(Number(h || 0)));
    try { compassWin.setResizable(false); } catch {}
    try { compassWin.setMinimumSize(W, H); } catch {}
    try { compassWin.setMaximumSize(W, H); } catch {}
    try { compassWin.setContentSize(W, H); } catch {}
  } catch {}
}
function unlockWindowSize() {
  try {
    if (!compassWin || compassWin.isDestroyed()) return;
    try { compassWin.setResizable(true); } catch {}
    try { compassWin.setMinimumSize(1, 1); } catch {}
    try { compassWin.setMaximumSize(9999, 9999); } catch {}
  } catch {}
}

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
  } catch { return '';
  }
}

let __appsCache = { ts: 0, list: [], building: false };
async function buildAppsCache() {
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
    const pushApp = (p) => { try { const key = String(p||'').toLowerCase(); if (!key) return; if (seen.has(key)) return; seen.add(key); const nm = path.basename(p, path.extname(p)); out.push({ name: nm, path: p }); } catch {} };
    const walk = async (dir, depth) => {
      try {
        const ents = await fsp.readdir(dir, { withFileTypes: true });
        for (const d of ents) {
          const p1 = path.join(dir, d.name);
          if (d.isFile() && (isExe(p1) || isLnk(p1))) { pushApp(p1); continue; }
          if (d.isDirectory() && depth < 2) { await walk(p1, depth + 1); }
        }
      } catch {}
    };
    for (const r of roots) { await walk(r, 0); }
    __appsCache.list = out.slice(0, 800);
    __appsCache.ts = Date.now();
  } catch { __appsCache.list = []; __appsCache.ts = Date.now(); }
}
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;

let pluginApi = null;
let compassWin = null;
let appWin = null;
function emitUpdate(target, value){ try { pluginApi.emit(state.eventChannel, { type: 'update', target, value }); } catch {} }

const state = {
  eventChannel: 'screen.compass.channel',
  dragging: false,
  draggingDisplayId: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
  dragStartWinX: 0,
  dragStartWinY: 0,
  dragInputType: 'mouse',
  lockWidth: 0,
  lockHeight: 0,
  sizing: false,
  mode: 'collapsed'
};

function createCompassWindow() {
  try {
    if (compassWin && !compassWin.isDestroyed()) return compassWin;
    const pt = screen.getCursorScreenPoint ? screen.getCursorScreenPoint() : { x: 0, y: 0 };
    const d = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint(pt) : screen.getPrimaryDisplay();
    const b = d.bounds;
    const w = 96, h = 96, mr = 24, mb = 32;
    const isLinux = process.platform === 'linux';
    compassWin = new BrowserWindow({
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
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      type: isLinux ? 'toolbar' : undefined,
      focusable: isLinux ? false : true,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    compassWin.loadFile(path.join(__dirname, 'float', 'compass.html'));
    try { compassWin.on('will-resize', (e) => { try { e.preventDefault(); } catch {} }); } catch {}
    try { const bInit = compassWin.getBounds(); lockWindowSize(bInit.width, bInit.height); } catch {}
    try { const b0 = compassWin.getBounds(); state.lockWidth = b0.width; state.lockHeight = b0.height; } catch {}
    try { compassWin.on('resize', () => { try { const b = compassWin.getBounds(); if (state.lockWidth && state.lockHeight && (b.width !== state.lockWidth || b.height !== state.lockHeight)) { compassWin.setBounds({ x: b.x, y: b.y, width: state.lockWidth, height: state.lockHeight }); } } catch {} }); } catch {}
    try { compassWin.setAlwaysOnTop(true); } catch {}
    try { compassWin.setAlwaysOnTop(true, 'screen-saver'); } catch {}
    try { if (isLinux) compassWin.setAlwaysOnTop(true, 'pop-up-menu'); } catch {}
    try { if (isLinux) compassWin.setAlwaysOnTop(true, 'status'); } catch {}
    try { compassWin.setVisibleOnAllWorkspaces(true); } catch {}
    try { compassWin.setSkipTaskbar(true); } catch {}
    compassWin.on('closed', () => { compassWin = null; });
    let snapTimer = null;
    const snap = () => {
      try {
        if (!compassWin || compassWin.isDestroyed()) return;
        const d = screen.getPrimaryDisplay();
        const wb = compassWin.getBounds();
        const sb = d.bounds;
        const th = 24;
        let x = wb.x, y = wb.y;
        if (Math.abs(wb.x - sb.x) <= th) x = sb.x;
        if (Math.abs((wb.x + wb.width) - (sb.x + sb.width)) <= th) x = sb.x + sb.width - wb.width;
        if (Math.abs(wb.y - sb.y) <= th) y = sb.y;
        if (Math.abs((wb.y + wb.height) - (sb.y + sb.height)) <= th) y = sb.y + sb.height - wb.height;
        if (x !== wb.x || y !== wb.y) compassWin.setPosition(x, y);
      } catch {}
    };
    const scheduleSnap = () => { try { if (state.dragging) return; if (state.sizing) return; if (snapTimer) clearTimeout(snapTimer); snapTimer = setTimeout(snap, 120); } catch {} };
    try { compassWin.on('move', scheduleSnap); } catch {}
    try { compassWin.on('moved', scheduleSnap); } catch {}
    return compassWin;
  } catch { return null; }
}

const functions = {
  openCompass: async () => { try { createCompassWindow(); return true; } catch (e) { return { ok: false, error: e?.message || String(e) }; } },
  openCompassSettings: async () => {
    try {
      const bgFile = path.join(__dirname, 'background', 'settings.html');
      const backgroundUrl = url.pathToFileURL(bgFile).href + `?channel=${encodeURIComponent(state.eventChannel)}&caller=${encodeURIComponent('screen.compass')}`;
      const params = {
        title: '屏幕罗盘设置',
        eventChannel: state.eventChannel,
        subscribeTopics: [state.eventChannel],
        callerPluginId: 'screen.compass',
        unique: true,
        id: 'screen.compass.settings',
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
      const res = await pluginApi.call('ui.lowbar', 'openTemplate', [params]);
      if (res && res.ok) return true;
      // fallback: open direct BrowserWindow with lowbar preload
      try {
        const d = screen.getPrimaryDisplay();
        const b = d.bounds;
        const w = 920, h = 640;
        const win = new BrowserWindow({
          x: b.x + Math.floor((b.width - w) / 2),
          y: b.y + Math.floor((b.height - h) / 2),
          width: w,
          height: h,
          frame: true,
          backgroundColor: '#101820',
          show: true,
          resizable: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(app.getAppPath(), 'src', 'plugins', 'ui-lowbar', 'preload.js')
          }
        });
        win.loadFile(path.join(__dirname, 'background', 'settings.html'));
      } catch {}
      return true;
    } catch (e) { return { ok: false, error: e?.message || String(e) }; }
  },
  touchDragMoveAbs: (ax, ay) => {
    try {
      if (!compassWin || compassWin.isDestroyed()) return false;
      if (!state.dragging || state.dragInputType !== 'touch') return false;
      const sx = Math.floor(Number(ax||0));
      const sy = Math.floor(Number(ay||0));
      const nx = Math.floor(sx - state.dragOffsetX);
      const ny = Math.floor(sy - state.dragOffsetY);
      return functions.moveTo(nx, ny);
    } catch { return false; }
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
      const urlStr = url.pathToFileURL(floatingFile).href + `?channel=${encodeURIComponent(state.eventChannel)}&caller=${encodeURIComponent('screen.compass')}&index=${encodeURIComponent(String(index||0))}`;
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
  performAction: async (button) => {
    try {
      const b = (button && button.result) ? button.result : button;
      if (!b || typeof b !== 'object') return false;
      const type = String(b.actionType || '').trim();
      const payload = b.actionPayload || {};
      if (type === 'app') {
        try {
          const opened = await functions.openApplicationsWindow();
          return !!opened;
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
        try {
          const child = spawn(p, args, { detached: true, stdio: 'ignore' });
          child.unref();
          return true;
        } catch (e) {
          return { ok: false, error: e?.message || String(e) };
        }
      }
      if (type === 'openApp') {
        const p = String(payload.path || '').trim();
        const args = Array.isArray(payload.args) ? payload.args : [];
        if (!p) return false;
        try {
          if (p.toLowerCase().endsWith('.lnk')) {
            try { await shell.openPath(p); return true; } catch {}
          }
          const child = spawn(p, args, { detached: true, stdio: 'ignore' }); child.unref(); return true;
        } catch (e) { return { ok: false, error: e?.message || String(e) }; }
      }
      if (type === 'command') {
        const cmd = String(payload.cmd || '').trim();
        if (!cmd) return false;
        try {
          if (process.platform === 'win32') {
            const child = spawn('cmd', ['/c', cmd], { windowsHide: true, detached: true, stdio: 'ignore' });
            child.unref();
          } else {
            const sh = spawn('bash', ['-lc', cmd], { detached: true, stdio: 'ignore' });
            sh.on('error', () => {
              try { const sh2 = spawn('sh', ['-c', cmd], { detached: true, stdio: 'ignore' }); sh2.unref(); } catch {}
            });
            sh.unref();
          }
          return true;
        } catch (e) {
          return { ok: false, error: e?.message || String(e) };
        }
      }
      if (type === 'cmd') {
        const cmd = String(payload.cmd || '').trim();
        if (!cmd) return false;
        try {
          if (process.platform === 'win32') {
            const child = spawn('cmd', ['/c', cmd], { windowsHide: true, detached: true, stdio: 'ignore' }); child.unref();
          } else {
            const sh = spawn('bash', ['-lc', cmd], { detached: true, stdio: 'ignore' });
            sh.on('error', () => { try { const sh2 = spawn('sh', ['-c', cmd], { detached: true, stdio: 'ignore' }); sh2.unref(); } catch {} });
            sh.unref();
          }
          return true;
        } catch (e) { return { ok: false, error: e?.message || String(e) }; }
      }
      if (type === 'power') {
        const op = String(payload.op || 'shutdown').trim();
        try {
          if (process.platform === 'win32') {
            let c = '';
            if (op === 'shutdown') c = 'shutdown -s -t 0';
            else if (op === 'restart') c = 'shutdown -r -t 0';
            else if (op === 'logoff') c = 'shutdown -l';
            if (!c) return false;
            const child = spawn('cmd', ['/c', c], { windowsHide: true, detached: true, stdio: 'ignore' }); child.unref();
          } else {
            let c = '';
            if (op === 'shutdown') c = 'systemctl poweroff';
            else if (op === 'restart') c = 'systemctl reboot';
            else if (op === 'logoff') c = 'loginctl terminate-user "$USER"';
            if (!c) return false;
            const sh = spawn('bash', ['-lc', c], { detached: true, stdio: 'ignore' });
            sh.on('error', () => { try { const sh2 = spawn('sh', ['-c', c], { detached: true, stdio: 'ignore' }); sh2.unref(); } catch {} });
            sh.unref();
          }
          return true;
        } catch (e) { return { ok: false, error: e?.message || String(e) }; }
      }
      return false;
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  },
  listPlugins: () => {
    try {
      const pm = require(path.join(app.getAppPath(), 'src', 'main', 'pluginManager.js'));
      const list = pm.getPlugins();
      return list;
    } catch (e) { return []; }
  },
  listAutomationEvents: (pluginId) => {
    try {
      const pm = require(path.join(app.getAppPath(), 'src', 'main', 'pluginManager.js'));
      const res = pm.listAutomationEvents(pluginId);
      if (res && res.ok && Array.isArray(res.events)) return res.events;
      return [];
    } catch (e) { return []; }
  },
  listInstalledApps: () => {
    try {
      if (process.platform !== 'win32') return [];
      const now = Date.now();
      if (__appsCache.list.length && (now - __appsCache.ts) < 600000) return __appsCache.list.slice(0, 300);
      if (!__appsCache.building) { __appsCache.building = true; buildAppsCache().finally(() => { __appsCache.building = false; }); }
      const roots = [
        path.join(String(process.env['ProgramData']||''), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
        path.join(String(process.env['AppData']||''), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
      ].filter(p => p && fs.existsSync(p));
      const out = [];
      const seen = new Set();
      const isExe = (p) => String(p||'').toLowerCase().endsWith('.exe');
      const isLnk = (p) => String(p||'').toLowerCase().endsWith('.lnk');
      const pushApp = (p) => { try { const key = String(p||'').toLowerCase(); if (!key) return; if (seen.has(key)) return; seen.add(key); const nm = path.basename(p, path.extname(p)); out.push({ name: nm, path: p }); } catch {} };
      roots.forEach((root) => {
        try {
          const dirs = fs.readdirSync(root, { withFileTypes: true });
          dirs.forEach((d) => {
            const p1 = path.join(root, d.name);
            try { if (d.isFile() && (isExe(p1) || isLnk(p1))) { pushApp(p1); return; } } catch {}
            if (d.isDirectory()) {
              try {
                const files = fs.readdirSync(p1, { withFileTypes: true });
                files.forEach((f) => { try { const p2 = path.join(p1, f.name); if (f.isFile() && (isExe(p2) || isLnk(p2))) pushApp(p2); } catch {} });
              } catch {}
            }
          });
        } catch {}
      });
      return out.slice(0, 120);
    } catch { return []; }
  },
  getFileIconDataUrl: async (p) => {
    try {
      const fp = String(p||''); if (!fp) return '';
      let usePath = fp;
      try { const target = resolveShortcutTarget(fp); if (target) usePath = target; } catch {}
      const img = await app.getFileIcon(usePath, { size: 'normal' });
      if (!img || img.isEmpty()) return '';
      return img.toDataURL();
    } catch { return ''; }
  },
  setExpandedWindow: (on, wOpt, hOpt) => {
    try {
      if (!compassWin || compassWin.isDestroyed()) return false;
      const wb = compassWin.getBounds();
      const cx = wb.x + Math.floor(wb.width / 2);
      const cy = wb.y + Math.floor(wb.height / 2);
      const display = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint({ x: cx, y: cy }) : screen.getPrimaryDisplay();
      const sb = display.bounds;
      const expanded = !!on;
      const dw = Number(wOpt); const dh = Number(hOpt);
      const size = expanded
        ? { width: (Number.isFinite(dw) && dw > 0 ? dw : 240), height: (Number.isFinite(dh) && dh > 0 ? dh : 240) }
        : { width: (Number.isFinite(dw) && dw > 0 ? dw : 60), height: (Number.isFinite(dh) && dh > 0 ? dh : 60) };
      state.mode = expanded ? 'expanded' : 'collapsed';
      state.sizing = true;
      let nx = cx - Math.floor(size.width / 2);
      let ny = cy - Math.floor(size.height / 2);
      if (nx < sb.x) nx = sb.x;
      if (ny < sb.y) ny = sb.y;
      if (nx + size.width > sb.x + sb.width) nx = sb.x + sb.width - size.width;
      if (ny + size.height > sb.y + sb.height) ny = sb.y + sb.height - size.height;
      try { unlockWindowSize(); } catch {}
      try { compassWin.setContentSize(size.width, size.height); } catch {}
      try { compassWin.setBounds({ x: nx, y: ny, width: size.width, height: size.height }); } catch {}
      try { lockWindowSize(size.width, size.height); } catch {}
      try { state.lockWidth = size.width; state.lockHeight = size.height; } catch {}
      try { setTimeout(() => { state.sizing = false; }, 60); } catch {}
      try {
        if (appWin && !appWin.isDestroyed()) {
          const awb = appWin.getBounds();
          const ax = nx + Math.floor(size.width / 2) - Math.floor(awb.width / 2);
          let ay = ny - awb.height - 8;
          const display2 = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint({ x: ax + Math.floor(awb.width/2), y: ay + Math.floor(awb.height/2) }) : screen.getPrimaryDisplay();
          const sb2 = display2.bounds;
          if (ax < sb2.x) ax = sb2.x;
          if (ay < sb2.y) ay = sb2.y;
          if (ax + awb.width > sb2.x + sb2.width) ax = sb2.x + sb2.width - awb.width;
          if (ay + awb.height > sb2.y + sb2.height) ay = sb2.y + sb2.height - awb.height;
          try { appWin.setBounds({ x: Math.floor(ax), y: Math.floor(ay), width: awb.width, height: awb.height }); } catch {}
        }
      } catch {}
      return true;
    } catch { return false; }
  },
  openApplicationsWindow: () => {
    try {
      const targetW = 420;
      const targetH = 520;
      const computePos = () => {
        let nx = 0; let ny = 0;
        let useW = targetW; let useH = targetH;
        try {
          if (compassWin && !compassWin.isDestroyed()) {
            const wb = compassWin.getBounds();
            nx = wb.x + Math.floor((wb.width - useW) / 2);
            ny = wb.y - useH - 8;
            const display = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint({ x: nx + Math.floor(useW / 2), y: ny + Math.floor(useH / 2) }) : screen.getPrimaryDisplay();
            const sb = display.bounds;
            if (nx < sb.x) nx = sb.x;
            if (ny < sb.y) ny = sb.y;
            if (nx + useW > sb.x + sb.width) nx = sb.x + sb.width - useW;
            if (ny + useH > sb.y + sb.height) ny = sb.y + sb.height - useH;
            return { x: nx, y: ny, width: useW, height: useH };
          }
        } catch {}
        const d = screen.getPrimaryDisplay();
        const b = d.bounds;
        return { x: b.x + Math.floor((b.width - useW) / 2), y: b.y + Math.floor((b.height - useH) / 2), width: useW, height: useH };
      };
      if (appWin && !appWin.isDestroyed()) { try { appWin.show(); appWin.focus(); } catch {} return true; }
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
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        }
      });
      appWin.loadFile(path.join(__dirname, 'background', 'app-window.html'));
      try { appWin.on('closed', () => { appWin = null; }); } catch {}
      try { pluginApi.emit(state.eventChannel, { type: 'app.active', active: true }); } catch {}
      return true;
    } catch { return false; }
  },
  closeApplicationsWindow: () => {
    try {
      const had = !!(appWin && !appWin.isDestroyed());
      if (had) { try { appWin.close(); } catch {} appWin = null; }
      try { pluginApi.emit(state.eventChannel, { type: 'app.active', active: false }); } catch {}
      return had;
    } catch { return false; }
  },
  openMainProgram: async () => {
    try {
      const exe = process.execPath;
      const child = spawn(exe, [], { detached: true, stdio: 'ignore' });
      child.unref();
      return true;
    } catch (e) { return { ok: false, error: e?.message || String(e) }; }
  },
  setDragging: (flag, offsetX, offsetY, inputType) => {
    try {
      state.dragging = !!flag;
      if (state.dragging) {
        if (compassWin && !compassWin.isDestroyed()) {
          const wb = compassWin.getBounds();
          try { lockWindowSize(wb.width, wb.height); } catch {}
          try { state.lockWidth = wb.width; state.lockHeight = wb.height; } catch {}
          state.dragStartWinX = wb.x;
          state.dragStartWinY = wb.y;
          const cx = wb.x + Math.floor(wb.width / 2);
          const cy = wb.y + Math.floor(wb.height / 2);
          const display = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint({ x: cx, y: cy }) : screen.getPrimaryDisplay();
          state.draggingDisplayId = display && typeof display.id === 'number' ? display.id : null;
          try {
            const pt = screen.getCursorScreenPoint ? screen.getCursorScreenPoint() : { x: 0, y: 0 };
            const useX = (typeof offsetX === 'number') ? offsetX : Math.max(0, pt.x - wb.x);
            const useY = (typeof offsetY === 'number') ? offsetY : Math.max(0, pt.y - wb.y);
            state.dragOffsetX = useX;
            state.dragOffsetY = useY;
          } catch { state.dragOffsetX = 0; state.dragOffsetY = 0; }
          state.dragInputType = (String(inputType||'').toLowerCase()==='touch') ? 'touch' : 'mouse';
          if (state.dragInputType === 'mouse') {
            try { startDragTracking(); } catch {}
          } else {
            try { stopDragTracking(); } catch {}
          }
        } else {
          state.draggingDisplayId = null;
        }
      } else {
        state.draggingDisplayId = null;
        state.dragInputType = 'mouse';
        try { stopDragTracking(); } catch {}
        try { const b = compassWin && !compassWin.isDestroyed() ? compassWin.getBounds() : null; if (b) { lockWindowSize(b.width, b.height); state.lockWidth = b.width; state.lockHeight = b.height; } } catch {}
      }
      return true;
    } catch { return false; }
  },
  touchDragMove: (dx, dy) => {
    try {
      if (!compassWin || compassWin.isDestroyed()) return false;
      if (!state.dragging || state.dragInputType !== 'touch') return false;
      const nx = Math.floor(state.dragStartWinX + Number(dx||0));
      const ny = Math.floor(state.dragStartWinY + Number(dy||0));
      return functions.moveTo(nx, ny);
    } catch { return false; }
  },
  getBounds: () => { try { if (!compassWin || compassWin.isDestroyed()) return null; return compassWin.getBounds(); } catch { return null; } },
  moveTo: (x, y) => {
    try {
      if (!compassWin || compassWin.isDestroyed()) return false;
      const wb = compassWin.getBounds();
      let sb = null;
      if (state.dragging && state.draggingDisplayId != null) {
        const displays = screen.getAllDisplays ? screen.getAllDisplays() : [screen.getPrimaryDisplay()];
        const d = (displays || []).find(v => v && v.id === state.draggingDisplayId);
        sb = (d && d.bounds) ? d.bounds : null;
      }
      if (!sb) {
        const cx = Math.floor(x + wb.width / 2);
        const cy = Math.floor(y + wb.height / 2);
        const display = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint({ x: cx, y: cy }) : screen.getPrimaryDisplay();
        sb = display.bounds;
      }
      const nx = Math.max(sb.x, Math.min(x, sb.x + sb.width - (state.lockWidth || wb.width)));
      const ny = Math.max(sb.y, Math.min(y, sb.y + sb.height - (state.lockHeight || wb.height)));
      const W = state.lockWidth || wb.width;
      const H = state.lockHeight || wb.height;
      compassWin.setBounds({ x: Math.floor(nx), y: Math.floor(ny), width: W, height: H });
      try {
        if (appWin && !appWin.isDestroyed()) {
          const awb = appWin.getBounds();
          let ax = nx + Math.floor(W / 2) - Math.floor(awb.width / 2);
          let ay = ny - awb.height - 8;
          if (ax < sb.x) ax = sb.x;
          if (ay < sb.y) ay = sb.y;
          if (ax + awb.width > sb.x + sb.width) ax = sb.x + sb.width - awb.width;
          if (ay + awb.height > sb.y + sb.height) ay = sb.y + sb.height - awb.height;
          appWin.setBounds({ x: Math.floor(ax), y: Math.floor(ay), width: awb.width, height: awb.height });
        }
      } catch {}
      return true;
    } catch { return false; }
  },
  snap: () => {
    try {
      if (!compassWin || compassWin.isDestroyed()) return false;
      const wb = compassWin.getBounds();
      let b = null;
      if (state.dragging && state.draggingDisplayId != null) {
        const displays = screen.getAllDisplays ? screen.getAllDisplays() : [screen.getPrimaryDisplay()];
        const d = (displays || []).find(v => v && v.id === state.draggingDisplayId);
        b = (d && d.bounds) ? d.bounds : null;
      }
      if (!b) {
        const cx = wb.x + Math.floor(wb.width / 2);
        const cy = wb.y + Math.floor(wb.height / 2);
        const display = screen.getDisplayNearestPoint ? screen.getDisplayNearestPoint({ x: cx, y: cy }) : screen.getPrimaryDisplay();
        b = display.bounds;
      }
      const th = 24;
      let x = wb.x, y = wb.y;
      if (Math.abs(wb.x - b.x) <= th) x = b.x;
      if (Math.abs((wb.x + wb.width) - (b.x + b.width)) <= th) x = b.x + b.width - wb.width;
      if (Math.abs(wb.y - b.y) <= th) y = b.y;
      if (Math.abs((wb.y + wb.height) - (b.y + b.height)) <= th) y = b.y + b.height - wb.height;
      if (x !== wb.x || y !== wb.y) compassWin.setPosition(x, y);
      try {
        if (appWin && !appWin.isDestroyed()) {
          const awb = appWin.getBounds();
          let ax = x + Math.floor(wb.width / 2) - Math.floor(awb.width / 2);
          let ay = y - awb.height - 8;
          if (ax < b.x) ax = b.x;
          if (ay < b.y) ay = b.y;
          if (ax + awb.width > b.x + b.width) ax = b.x + b.width - awb.width;
          if (ay + awb.height > b.y + b.height) ay = b.y + b.height - awb.height;
          appWin.setBounds({ x: Math.floor(ax), y: Math.floor(ay), width: awb.width, height: awb.height });
        }
      } catch {}
      return true;
    } catch { return false; }
  }
};

const init = async (api) => {
  pluginApi = api;
  const ready = () => { createCompassWindow(); };
  if (app.isReady()) ready(); else app.once('ready', ready);
};

module.exports = { name: '屏幕罗盘', version: '0.1.0', init, functions };
