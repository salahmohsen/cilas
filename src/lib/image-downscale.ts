import { DOWNSCALE_EDGE, DOWNSCALE_OVER } from '@/lib/space-file-limits'

const SHRINKABLE = new Set(['image/jpeg', 'image/png', 'image/webp'])

const encode = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))

/**
 * Shrinks a big photo in the browser before upload: over 2 MB, at most 2560
 * px on the long side, WebP (JPEG where the browser cannot write WebP) at
 * quality 0.85. The original stays when the new file is not smaller. GIFs and
 * other files pass through; so does any photo the browser cannot decode.
 */
export const downscaleImage = async (file: File): Promise<File> => {
  if (!SHRINKABLE.has(file.type) || file.size <= DOWNSCALE_OVER) return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  try {
    const scale = Math.min(1, DOWNSCALE_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    let blob = await encode(canvas, 'image/webp')
    if (blob?.type !== 'image/webp') {
      // JPEG has no transparency: paint white behind the picture.
      context.globalCompositeOperation = 'destination-over'
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      blob = await encode(canvas, 'image/jpeg')
    }
    if (!blob || blob.size >= file.size) return file
    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, {
      type: blob.type,
      lastModified: file.lastModified,
    })
  } finally {
    bitmap.close()
  }
}

/** Shrinks every file picked, in order. */
export const prepareFiles = (files: File[]) => Promise.all(files.map(downscaleImage))
