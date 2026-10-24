'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Spec §Updates: while the tab is visible, the page checks for new posts every 30 seconds. */
export function LiveRefresh() {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, 30_000)
    return () => clearInterval(timer)
  }, [router])
  return null
}
