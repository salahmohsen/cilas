import Image from 'next/image'
import type { ComponentProps, CSSProperties } from 'react'

import { focalPointStyle, type FocalPoint } from '@/lib/media-image'

/** The cover's width on course and Bridge pages: the main column beside the side card. */
export const COVER_SIZES =
  '(min-width: 90rem) 61.5rem, (min-width: 64rem) calc(100vw - 28.5rem), (min-width: 40rem) calc(100vw - 3rem), calc(100vw - 2rem)'

type CoverImageProps = Omit<ComponentProps<typeof Image>, 'width' | 'height' | 'fill' | 'style'> & {
  width: number
  height: number
  focal?: FocalPoint | null
}

/**
 * A page's cover, shown whole at its own proportions. The box takes the
 * column's width and stops at a height cap, so a tall poster narrows instead
 * of being cropped or letterboxed. The width comes from the image's ratio, not
 * from the file's pixels: a source smaller than the srcset entry the browser
 * picks would otherwise show at a fraction of the column.
 */
export function CoverImage({ alt, width, height, focal, className, ...props }: CoverImageProps) {
  return (
    <Image
      {...props}
      alt={alt}
      className={className ? `cover-image ${className}` : 'cover-image'}
      height={height}
      style={
        { ...focalPointStyle(focal), '--cover-ratio': `${width} / ${height}` } as CSSProperties
      }
      width={width}
    />
  )
}
