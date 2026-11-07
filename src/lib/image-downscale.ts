import { IMAGE_EDGE, IMAGE_QUALITY } from '@/lib/space-file-limits'

const SHRINKABLE = new Set(['image/jpeg', 'image/png', 'image/webp'])

const encode = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, IMAGE_QUALITY / 100))

/**
 * Shrinks a photo in the browser before upload: at most IMAGE_EDGE px on the
 * long side, turned upright, WebP (JPEG where the browser cannot write WebP)
 * at the quality the server uses. Drawing on a canvas drops EXIF and GPS data.
 * The original stays when the new file is not smaller; the server (the
 * space-files collection) is the authority and shrinks it again. Any file the
 * browser cannot decode passes through for the server to judge.
 */
const downscaleImage = async (file: File): Promise<File> => {
  if (!SHRINKABLE.has(file.type)) return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  try {
    const scale = Math.min(1, IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
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
