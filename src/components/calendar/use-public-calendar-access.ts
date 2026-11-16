'use client'

import { useEffect, useState } from 'react'
import { publicCalendarLinks } from '@/actions/public-calendar-access'
import { useSession } from '@/components/use-session'

export function usePublicCalendarAccess(courseIds: string[], locale: string) {
  const userId = useSession()?.id
  const key = [...new Set(courseIds)].toSorted().join(',')
  const [result, setResult] = useState<{
    user: number
    key: string
    canEdit: boolean
    spaces: Record<string, string>
  } | null>(null)
  useEffect(() => {
    if (!userId) return
    let live = true
    void publicCalendarLinks(key ? key.split(',') : [], locale).then(
      (access) => {
        if (live) setResult({ ...access, user: userId, key })
      },
      () => {
        if (live) setResult(null)
      },
    )
    return () => {
      live = false
    }
  }, [userId, key, locale])
  return userId && result?.user === userId && result.key === key
    ? result
    : { canEdit: false, spaces: {} as Record<string, string> }
}
