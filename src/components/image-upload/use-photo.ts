'use client'

import { useEffect, useState } from 'react'

/**
 * The photo to show: a new address waits until it has loaded, so a stored
 * photo replacing a local one never flashes empty. A broken one is dropped.
 */
export function useLoadedSrc(src: string | null) {
  const [loaded, setLoaded] = useState(src)
  useEffect(() => {
    if (!src) return
    let live = true
    const image = new Image()
    image.src = src
    image
      .decode()
      .then(() => live && setLoaded(src))
      .catch(() => live && setLoaded(null))
    return () => {
      live = false
    }
  }, [src])
  return src ? loaded : null
}
