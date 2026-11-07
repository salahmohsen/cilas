'use client'

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'

import { fileKind, imageIssue, megabytes, typeNames, type Size } from '@/lib/image-crop'

import type { CropResult } from './cropper'

/** A picked photo, decoded and upright, ready for the crop step. */
type Picked = { file: File; url: string; bitmap: ImageBitmap; size: Size }

/** Decodes a photo, turned upright, or null when it is not one. */
const decodePhoto = async (file: File): Promise<Picked | null> => {
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

const dropPicked = (picked: Picked | null) => {
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
function useUploadWords(accept: readonly string[], maxSize: number) {
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
    check: (file: File): string | null => {
      const issue = imageIssue(file, accept, maxSize)
      if (issue === 'size') {
        const size = t('megabytes', { n: megabytes(file.size) })
        return t('errors.size', { size, max })
      }
      if (issue === 'type') {
        const kind = fileKind(file.name)
        return kind ? t('errors.type', { kind, types }) : t('errors.typeUnknown', { types })
      }
      return null
    },
    decode: t('errors.decode'),
    upload: t('errors.upload'),
  }
}

/**
 * Picking a photo for both uploaders: the file input, the drop target, the
 * type and size checks and the decode. `onPicked` gets the decoded photo for
 * the crop step; `onError` gets the message of a refused file. Nothing is
 * taken while `locked`.
 */
export function useImagePick({
  accept,
  maxSize,
  locked,
  onPicked,
  onError,
}: {
  accept: readonly string[]
  maxSize: number
  locked: boolean
  onPicked: () => void
  onError: (message: string) => void
}) {
  const words = useUploadWords(accept, maxSize)
  const input = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [over, setOver] = useState(false)

  useEffect(() => () => dropPicked(picked), [picked])

  const take = async (file: File) => {
    if (locked) return
    const issue = words.check(file)
    if (issue) return onError(issue)
    const next = await decodePhoto(file)
    if (!next) return onError(words.decode)
    setPicked(next)
    onPicked()
  }

  return {
    words,
    picked,
    /** Lets the picked photo go, when the crop is saved or cancelled. */
    clear: () => setPicked(null),
    /** Shows the file picker. */
    open: () => input.current?.click(),
    over,
    /** Spread on the hidden file input. */
    inputProps: {
      ref: input,
      type: 'file' as const,
      hidden: true,
      accept: accept.join(','),
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (file) void take(file)
      },
    },
    /** Spread on whatever takes a dropped photo. */
    dropProps: {
      onDragOver: (event: DragEvent) => {
        if (locked) return
        event.preventDefault()
        setOver(true)
      },
      onDragLeave: () => setOver(false),
      onDrop: (event: DragEvent) => {
        event.preventDefault()
        setOver(false)
        const file = event.dataTransfer.files[0]
        if (file) void take(file)
      },
    },
  }
}
