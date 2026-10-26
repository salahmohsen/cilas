'use client'

import { useLocale, useTranslations } from 'next-intl'

import { fileKind, imageIssue, megabytes, typeNames, type Size } from '@/lib/image-crop'

import type { CropResult } from './cropper'

export type UploadErrorCode = 'type' | 'size' | 'decode' | 'upload'
export type UploadError = { code: UploadErrorCode; message: string }

export const DEFAULT_ACCEPT = ['image/png', 'image/jpeg', 'image/webp']
export const DEFAULT_MAX_SIZE = 5 * 1024 * 1024

/** A picked photo, decoded and upright, ready for the crop step. */
export type Picked = { file: File; url: string; bitmap: ImageBitmap; size: Size }

/** Decodes a photo, turned upright, or null when it is not one. */
export const decodePhoto = async (file: File): Promise<Picked | null> => {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return {
      file,
      url: URL.createObjectURL(file),
      bitmap,
      size: { width: bitmap.width, height: bitmap.height },
    }
  } catch {
    return null
  }
}

export const dropPicked = (picked: Picked | null) => {
  if (!picked) return
  picked.bitmap.close()
  URL.revokeObjectURL(picked.url)
}

/**
 * Draws the crop once, at `out`. A PNG stays PNG to keep its transparency;
 * anything else becomes JPEG at 92% on white.
 */
export const renderCrop = async (picked: Picked, crop: CropResult, out: Size): Promise<Blob> => {
  const canvas = document.createElement('canvas')
  canvas.width = out.width
  canvas.height = out.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  const png = picked.file.type === 'image/png'
  if (!png) {
    context.fillStyle = '#fff'
    context.fillRect(0, 0, out.width, out.height)
  }
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    picked.bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    out.width,
    out.height,
  )
  const type = png ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92))
  if (!blob) throw new Error('encode')
  return blob
}

/** The blob as a file named after the photo it came from. */
export const asFile = (blob: Blob, original: File) =>
  new File(
    [blob],
    `${original.name.replace(/\.[^.]+$/, '') || 'photo'}.${blob.type === 'image/png' ? 'png' : 'jpg'}`,
    { type: blob.type, lastModified: original.lastModified },
  )

/** The hint and every check's message, in the page's language. */
export function useUploadWords(accept: readonly string[], maxSize: number) {
  const t = useTranslations('ImageUpload')
  const locale = useLocale()
  const list = new Intl.ListFormat(locale === 'ar' ? 'ar' : 'en-GB', {
    style: 'long',
    type: 'disjunction',
  })
  const types = list.format(typeNames(accept))
  const max = t('megabytes', { n: megabytes(maxSize) })
  return {
    hint: t('hint', { types, max }),
    /** The type and size checks, before decoding; null when the file may go on. */
    check: (file: File): UploadError | null => {
      const issue = imageIssue(file, accept, maxSize)
      if (issue === 'size') {
        const size = t('megabytes', { n: megabytes(file.size) })
        return { code: 'size', message: t('errors.size', { size, max }) }
      }
      if (issue === 'type') {
        const kind = fileKind(file.name)
        return {
          code: 'type',
          message: kind ? t('errors.type', { kind, types }) : t('errors.typeUnknown', { types }),
        }
      }
      return null
    },
    decode: { code: 'decode', message: t('errors.decode') } satisfies UploadError,
    upload: { code: 'upload', message: t('errors.upload') } satisfies UploadError,
  }
}
