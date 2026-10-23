'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

/** One listener, one threshold: past 12px of scroll the header is told to fold (spec §2). */
const FOLD_AT = 12

/**
 * Marks the header root `folded` so its module can slim to the first row.
 * The page-header core stays server-rendered; folding is only this class.
 */
export function Fold({ children, className }: { children: ReactNode; className?: string }) {
  const [folded, setFolded] = useState(false)
  useEffect(() => {
    const onScroll = () => setFolded(window.scrollY >= FOLD_AT)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className={className} data-folded={folded}>
      {children}
    </div>
  )
}
