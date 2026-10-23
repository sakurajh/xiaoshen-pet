const PET_ANCHOR = { x: 640, y: 590 };
const PANEL = { x: 18, y: 26, width: 392, height: 748 };
const PET_PAD = 28;
const PANEL_PAD = 16;

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function petScreenPoint(bounds, anchor = PET_ANCHOR) {
  return { x: bounds.x + anchor.x, y: bounds.y + anchor.y };
}

function keepPetVisible(bounds, workArea, anchor = PET_ANCHOR, pad = PET_PAD) {
  const point = petScreenPoint(bounds, anchor);
  const target = {
    x: clamp(point.x, workArea.x + pad, workArea.x + workArea.width - pad),
    y: clamp(point.y, workArea.y + pad, workArea.y + workArea.height - pad)
  };
  return {
    ...bounds,
    x: Math.round(bounds.x + (target.x - point.x)),
    y: Math.round(bounds.y + (target.y - point.y))
  };
}

function keepPanelVisible(bounds, workArea, panel = PANEL, pad = PANEL_PAD) {
  const minX = workArea.x + pad - panel.x;
  const maxX = workArea.x + workArea.width - pad - panel.x - panel.width;
  const minY = workArea.y + pad - panel.y;
  const maxY = workArea.y + workArea.height - pad - panel.y - panel.height;
  return {
    ...bounds,
    x: Math.round(clamp(bounds.x, minX, maxX)),
    y: Math.round(clamp(bounds.y, minY, maxY))
  };
}

module.exports = { PET_ANCHOR, PANEL, keepPetVisible, keepPanelVisible, petScreenPoint };
