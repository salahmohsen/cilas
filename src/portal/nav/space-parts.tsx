'use client'

import Image from 'next/image'
import { useState, type CSSProperties, type ReactNode } from 'react'

import styles from './shell.module.css'

/**
 * A cover in a slot the caller sizes. With no cover, or one that fails to load,
 * the slot stays empty. `children` sit over the cover.
 */
export function SpaceCover({
  src,
  sizes,
  className,
  imageStyle,
  children,
}: {
  src: string | null
  sizes: string
  className: string
  imageStyle?: CSSProperties
  children?: ReactNode
}) {
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span className={className} aria-hidden="true">
      {src && failed !== src && (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          style={imageStyle}
          onError={() => setFailed(src)}
        />
      )}
      {children}
    </span>
  )
}

/** The red numbered circle of a space. Decorative: the caller names the count in text. */
export function UnreadCircle({ shown }: { shown: string }) {
  return (
    <span className={styles.count} aria-hidden="true" dir="ltr">
      {shown}
    </span>
  )
}
