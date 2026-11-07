/**
 * The maths of the photo crop step, shared by the avatar and the single image
 * upload. The frame is the crop window (a circle or a rectangle) in pixels.
 * The photo's offset is where its centre sits from the frame's centre, as a
 * fraction of the photo's shown size, so it stays right while the frame
 * resizes.
 */

export type Size = { width: number; height: number }
export type Offset = { x: number; y: number }

/** The most the photo may be zoomed past the size that just covers the frame. */
export const MAX_ZOOM = 4

/** The scale at which the photo just covers the frame. */
export const coverScale = (image: Size, frame: Size) =>
  Math.max(frame.width / image.width, frame.height / image.height)

/** The photo's shown size at a zoom, in the frame's pixels. */
export const shownSize = (image: Size, frame: Size, zoom: number): Size => {
  const scale = coverScale(image, frame) * zoom
  return { width: image.width * scale, height: image.height * scale }
}

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(1, zoom))

/** How far the photo's centre may move on each axis, as a fraction of its shown size. */
export const offsetLimit = (image: Size, frame: Size, zoom: number): Offset => {
  const shown = shownSize(image, frame, zoom)
  return {
    x: Math.max(0, (1 - frame.width / shown.width) / 2),
    y: Math.max(0, (1 - frame.height / shown.height) / 2),
  }
}

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value))

/** The offset moved back inside the frame, so the photo always covers it. */
export const clampOffset = (offset: Offset, image: Size, frame: Size, zoom: number): Offset => {
  const limit = offsetLimit(image, frame, zoom)
  return { x: clamp(offset.x, limit.x), y: clamp(offset.y, limit.y) }
}

/**
 * Past an edge the photo follows at a falling rate and never more than `max`
 * pixels: `over` is how far the pointer has gone past the edge.
 */
export const rubberBand = (over: number, max: number) =>
  max <= 0 ? 0 : Math.sign(over) * max * (1 - 1 / (1 + Math.abs(over) / max))

/**
 * One axis of a drag: the offset the pointer asks for, held inside the limit
 * with the rubber band past it. `shown` and `max` are pixels.
 */
export const dragAxis = (wanted: number, limit: number, shown: number, max: number) => {
  const past = Math.abs(wanted) - limit
  if (past <= 0) return wanted
  return Math.sign(wanted) * (limit + rubberBand(past * shown, max) / shown)
}

/**
 * The offset after zooming from `zoom` to `next` so that `point` (pixels from
 * the frame's centre) stays under the pointer.
 */
export const zoomAt = (
  offset: Offset,
  image: Size,
  frame: Size,
  zoom: number,
  next: number,
  point: Offset = { x: 0, y: 0 },
): Offset => {
  const before = shownSize(image, frame, zoom)
  const after = shownSize(image, frame, next)
  return clampOffset(
    {
      x: offset.x + point.x / after.width - point.x / before.width,
      y: offset.y + point.y / after.height - point.y / before.height,
    },
    image,
    frame,
    next,
  )
}

/** The part of the photo inside the frame, in the photo's own pixels. */
export const cropRect = (image: Size, frame: Size, zoom: number, offset: Offset) => {
  const scale = coverScale(image, frame) * zoom
  const width = frame.width / scale
  const height = frame.height / scale
  return {
    x: image.width * (0.5 - offset.x) - width / 2,
    y: image.height * (0.5 - offset.y) - height / 2,
    width,
    height,
  }
}

/** The output size for a frame ratio: `edge` is the long side, never larger than the crop itself. */
export const outputSize = (ratio: number, edge: number, crop?: Size): Size => {
  const long = Math.round(crop ? Math.min(edge, Math.max(crop.width, crop.height)) : edge)
  return ratio >= 1
    ? { width: long, height: Math.max(1, Math.round(long / ratio)) }
    : { width: Math.max(1, Math.round(long * ratio)), height: long }
}

type ImageIssue = 'type' | 'size'

/** Type and size, checked before the photo is decoded. */
export const imageIssue = (
  file: { type: string; size: number },
  accept: readonly string[],
  maxSize: number,
): ImageIssue | null => {
  if (!accept.includes(file.type)) return 'type'
  return file.size > maxSize ? 'size' : null
}

/** What a refused file is called in the message: its extension, as people know it. */
export const fileKind = (name: string): string | null => {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name)
  return match ? match[1]!.toUpperCase() : null
}

const KIND_NAMES: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/avif': 'AVIF',
}

/** The accepted types as people name them: PNG, JPG, WebP. */
export const typeNames = (accept: readonly string[]) =>
  accept.map((type) => KIND_NAMES[type] ?? type.replace(/^image\//, '').toUpperCase())

/** Megabytes for a message: whole numbers stay whole, the rest keep one place. */
export const megabytes = (bytes: number) => {
  const mb = bytes / (1024 * 1024)
  return Number.isInteger(mb) ? mb : Math.max(0.1, Math.round(mb * 10) / 10)
}
