'use client'

import { useState, type ImgHTMLAttributes } from 'react'
import { avatarFallback } from '@/lib/avatar'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src?: string | null
  srcSet?: string
  fallbackSeed: string
}

/** A stored photo wins; a missing or failed photo uses the same local Blobatar. */
export function AvatarImage({ src, srcSet, fallbackSeed, alt = '', onError, ...props }: Props) {
  const [failed, setFailed] = useState<string>()
  const photo = src && failed !== src
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local SVG data URI and existing uploaded photos
    <img
      {...props}
      alt={alt}
      src={photo ? src : avatarFallback(fallbackSeed)}
      srcSet={photo ? srcSet : undefined}
      onError={(event) => {
        if (photo) setFailed(src)
        onError?.(event)
      }}
    />
  )
}
