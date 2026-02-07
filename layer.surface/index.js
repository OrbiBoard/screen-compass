const center = document.getElementById('center');
let centerSize = 48; // 默认中心按钮大小
let centerIcon = 'ri-compass-3-line'; // 默认中央图标
let isExpanded = false; // 展开状态
let currentTheme = 'sector'; // 主题标识

// 更新中心按钮图标
function updateCenterIcon() {
  try {
    // Fixed: Increase buffer to avoid shadow clipping (shadow needs ~16px at bottom)
    const totalSize = centerSize + 40; 
    try { window.compassAPI.pluginCall('screen-compass', 'resizeDragWin', [totalSize, totalSize]); } catch(e){}

    center.style.width = centerSize + 'px';
    center.style.height = centerSize + 'px';
    center.style.lineHeight = centerSize + 'px';
    const iconSize = Math.round(centerSize * 0.5) + 'px';

    let icon = centerIcon; // 拿到内存地址
    if (isExpanded) {
        if (currentTheme === 'hleft') {
            icon = 'ri-arrow-right-s-line'; // 向左收起
        } else if (currentTheme === 'hright') {
            icon = 'ri-arrow-left-s-line'; // 向右收起
        } else {
            icon = 'ri-close-line'; // 圆形模式
        }
    }

    // 兼容文件地址类型的图标
    if (icon.startsWith('ri-')) {
      center.innerHTML = `<i class="${icon}" style="font-size: ${iconSize}"></i>`;
    } else {
      center.innerHTML = `<img src="${icon}" style="width: ${iconSize}; height: ${iconSize}; object-fit: contain; border-radius: 4px;" />`;
    }

  } catch (e) { console.error(e); }
}

function updateShape() {
    try {
        // Calculate the center circle rect
        // The window is resized to totalSize = centerSize + 40
        const totalSize = centerSize + 40;
        const offset = Math.floor((totalSize - centerSize) / 2);
        const rect = { x: offset, y: offset, width: centerSize, height: centerSize };
        window.compassAPI.pluginCall('screen-compass', 'setWindowShape', ['surface', [rect]]);
    } catch (e) {}
}

try {
  window.compassAPI.subscribe('screen-compass-channel');
  // 接收插件信息
  window.compassAPI.onEvent((name, payload) => {
    if (name === 'screen-compass-channel' && payload) {
        if (payload.type === 'buttons.update') {
            if (payload.centerSize) centerSize = Math.max(32, Math.min(160, Number(payload.centerSize) || centerSize));
            if (payload.centerIcon) centerIcon = String(payload.centerIcon) || centerIcon;
            updateCenterIcon();
            updateShape();
        }
        if (payload.type === 'menu.toggle') {
            isExpanded = !!payload.expanded;
            if (payload.theme) currentTheme = payload.theme;
            updateCenterIcon();
            updateShape();
        }
    }
    if (name === 'menu-state') {
        isExpanded = !!payload.expanded;
        updateCenterIcon();
        updateShape();
    }
  });
} catch (e) {}

// Initial load
(async () => {
  try {
    const s = await window.compassAPI.configGet('screen-compass', 'centerSize');
    if (s && s.result) centerSize = Number(s.result);
    const i = await window.compassAPI.configGet('screen-compass', 'centerIcon');
    if (i && i.result) centerIcon = String(i.result);
    
    // Attempt to get theme
    try {
        let t = await window.compassAPI.configGet('screen-compass', 'theme');
        let v = (t && t.result) ? t.result : t;
        currentTheme = ['classic','sector','hleft','hright'].includes(v)?v:'classic';
    } catch(e){}

    updateCenterIcon();
    setTimeout(updateShape, 100);
  } catch(e) {}
})();
