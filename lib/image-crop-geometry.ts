export interface CropPosition { zoom: number; offsetX: number; offsetY: number }
export interface CropSize { width: number; height: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function overflow(image: CropSize, viewport: CropSize, zoom: number) {
  const scale = Math.max(viewport.width / image.width, viewport.height / image.height) * zoom;
  return { x: Math.max(0, image.width * scale - viewport.width), y: Math.max(0, image.height * scale - viewport.height) };
}

export function panCrop(position: CropPosition, image: CropSize, viewport: CropSize, dx: number, dy: number): CropPosition {
  const extra = overflow(image, viewport, position.zoom);
  return { ...position, offsetX: extra.x > 0 ? clamp(position.offsetX + 2 * dx / extra.x, -1, 1) : 0,
    offsetY: extra.y > 0 ? clamp(position.offsetY + 2 * dy / extra.y, -1, 1) : 0 };
}

// Keep the point beneath the cursor/fingers fixed when zooming, unless an edge is reached.
export function zoomCrop(position: CropPosition, image: CropSize, viewport: CropSize, requestedZoom: number, anchorX: number, anchorY: number): CropPosition {
  const zoom = clamp(requestedZoom, 1, 3);
  const ratio = zoom / position.zoom;
  const before = overflow(image, viewport, position.zoom);
  const after = overflow(image, viewport, zoom);
  const x = ratio * position.offsetX * before.x / 2 + (1 - ratio) * (anchorX - viewport.width / 2);
  const y = ratio * position.offsetY * before.y / 2 + (1 - ratio) * (anchorY - viewport.height / 2);
  return { zoom, offsetX: after.x > 0 ? clamp(2 * x / after.x, -1, 1) : 0,
    offsetY: after.y > 0 ? clamp(2 * y / after.y, -1, 1) : 0 };
}

export function cropSourceRect(image: CropSize, position: CropPosition) {
  const scale = Math.max(1200 / image.width, 900 / image.height) * position.zoom;
  const width = 1200 / scale;
  const height = 900 / scale;
  return { x: Math.max(0, image.width - width) * (1 - position.offsetX) / 2,
    y: Math.max(0, image.height - height) * (1 - position.offsetY) / 2, width, height };
}
