'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { subscribeFocusRefresh } from '@/portal/needs/focus-refresh'
import { subscribeWorkRefresh } from '@/portal/needs/work-refresh'

export function RefreshOnWork() {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => router.refresh()
    const unsubscribeWork = subscribeWorkRefresh(refresh)
    const unsubscribeFocus = subscribeFocusRefresh(refresh)
    return () => {
      unsubscribeWork()
      unsubscribeFocus()
    }
  }, [router])
  return null
}
