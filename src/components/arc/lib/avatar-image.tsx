'use client'

import { useState, type ImgHTMLAttributes } from 'react'
import { AvatarFallback } from './avatar-fallback'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src?: string | null
  srcSet?: string
  fallbackSeed: string
}

/** A stored photo wins; a missing or failed photo uses the same local Beam avatar. */
export function AvatarImage({ src, srcSet, fallbackSeed, alt = '', onError, ...props }: Props) {
  const [failed, setFailed] = useState<string>()
  const photo = src && failed !== src
  if (!photo) {
    return (
      <AvatarFallback
        seed={fallbackSeed}
        className={props.className}
        width={props.width ?? '100%'}
        height={props.height ?? '100%'}
        style={props.style}
        aria-label={alt || undefined}
        aria-hidden={props['aria-hidden'] ?? !alt}
      />
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- existing uploaded photos
    <img
      {...props}
      alt={alt}
      src={src}
      srcSet={srcSet}
      onError={(event) => {
        if (photo) setFailed(src)
        onError?.(event)
      }}
    />
  )
}
