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
