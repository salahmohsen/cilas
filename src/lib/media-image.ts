import type { Media } from '@/payload-types'

export type FocalPoint = Pick<Media, 'focalX' | 'focalY'>
export type MediaImage = FocalPoint & { src: string; alt: string }

export const mediaImage = (
  media: Pick<Media, 'url' | 'alt' | 'focalX' | 'focalY'> | null | undefined,
): MediaImage | undefined =>
  media?.url
    ? { src: media.url, alt: media.alt ?? '', focalX: media.focalX, focalY: media.focalY }
    : undefined

const percent = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50

export const focalPointStyle = (point?: FocalPoint | null) => ({
  objectPosition: `${percent(point?.focalX)}% ${percent(point?.focalY)}%`,
})

export const mediaPopulate = {
  url: true,
  alt: true,
  focalX: true,
  focalY: true,
  filename: true,
  prefix: true,
} as const

export const mediaThumbnail = (media: Media | null | undefined): string | undefined =>
  media?.sizes?.thumbnail?.url ?? media?.url ?? undefined

export const mediaCover = (media: Media | null | undefined, fallbackAlt = '') => {
  const image = mediaImage(media)
  return image
    ? { url: image.src, alt: media?.alt ?? fallbackAlt, focalX: image.focalX, focalY: image.focalY }
    : undefined
}

export const mediaStudyImage = (media: Media | null | undefined) => ({
  image: media?.url ?? undefined,
  imageAlt: media?.alt ?? undefined,
  imageFocalPoint: media ? { focalX: media.focalX, focalY: media.focalY } : undefined,
})
