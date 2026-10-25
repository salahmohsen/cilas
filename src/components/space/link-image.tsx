'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A link preview's image from another site. If it fails to load, or failed
 * before this component hydrated, it leaves no box behind: the fallback shows, or nothing.
 */
export function LinkImage({
  src,
  className,
  fallback = null,
}: {
  src: string
  className?: string
  fallback?: ReactNode
}) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const img = ref.current
    if (img?.complete && img.naturalWidth === 0) setFailed(true)
  }, [])
  if (failed) return fallback
  return (
    // The image lives on another site; next/image would need every host allowed in advance.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
