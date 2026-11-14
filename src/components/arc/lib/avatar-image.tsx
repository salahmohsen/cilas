'use client'

import { useState } from 'react'
import { ArcImage, type ArcImageProps } from './arc-provider'
import { AvatarFallback } from './avatar-fallback'

type Base = Omit<ArcImageProps, 'src' | 'alt' | 'fill' | 'width' | 'height' | 'sizes'> & {
  src?: string | null
  alt?: string
  fallbackSeed: string
}

/**
 * Either a fixed `width` and `height` (the rendered size in CSS pixels), or `sizes` for a photo that fills its
 * positioned parent. Either way the image provider can resize the photo to what the screen shows.
 */
type Props = Base &
  (
    | { width: number; height: number; sizes?: string }
    | { width?: undefined; height?: undefined; sizes: string }
  )

/** A stored photo wins; a missing or failed photo uses the same local Beam avatar. */
export function AvatarImage({
  src,
  fallbackSeed,
  alt = '',
  onError,
  width,
  height,
  sizes,
  ...props
}: Props) {
  const [failed, setFailed] = useState<string>()
  const photo = src && failed !== src
  if (!photo) {
    return (
      <AvatarFallback
        seed={fallbackSeed}
        className={props.className}
        width={width ?? '100%'}
        height={height ?? '100%'}
        style={props.style}
        aria-label={alt || undefined}
        aria-hidden={props['aria-hidden'] ?? !alt}
      />
    )
  }
  return (
    <ArcImage
      {...props}
      alt={alt}
      src={src}
      sizes={sizes}
      {...(width === undefined ? { fill: true } : { width, height })}
      onError={(event) => {
        setFailed(src)
        onError?.(event)
      }}
    />
  )
}
