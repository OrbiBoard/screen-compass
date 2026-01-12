const center = document.getElementById('center');
let centerSize = 50;
let centerIcon = 'ri-compass-3-line';

function updateCenterIcon() {
  try {
    center.style.width = centerSize + 'px';
    center.style.height = centerSize + 'px';
    center.style.lineHeight = centerSize + 'px';
    const iconSize = Math.round(centerSize * 0.44) + 'px';
    
    // Check if icon is class or image
    if (centerIcon.startsWith('ri-')) {
      center.innerHTML = `<i class="${centerIcon}" style="font-size: ${iconSize}"></i>`;
    } else {
      center.innerHTML = `<img src="${centerIcon}" style="width: ${iconSize}; height: ${iconSize}; object-fit: contain; border-radius: 4px;" />`;
    }
  } catch (e) { console.error(e); }
}

try {
  window.compassAPI.onEvent((name, payload) => {
    if (name !== 'screen-compass-channel' || !payload) return;
    if (payload.type === 'buttons.update') {
      if (payload.centerSize) centerSize = Math.max(32, Math.min(160, Number(payload.centerSize) || centerSize));
      if (payload.centerIcon) centerIcon = String(payload.centerIcon) || centerIcon;
      updateCenterIcon();
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
    updateCenterIcon();
  } catch(e) {}
})();
