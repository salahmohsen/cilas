'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { subscribeWorkRefresh } from './work-refresh'

export function RefreshOnWork() {
  const router = useRouter()
  useEffect(() => subscribeWorkRefresh(() => router.refresh()), [router])
  return null
}
