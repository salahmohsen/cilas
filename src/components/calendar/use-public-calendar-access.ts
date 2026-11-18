'use client'

import { useEffect, useState } from 'react'
import { useScheduleActions } from '@/components/space/schedule-actions'
import { useSession } from '@/components/use-session'

export function usePublicCalendarAccess(courseIds: string[], locale: string) {
  const { publicCalendarLinks } = useScheduleActions()
  const userId = useSession()?.id
  const key = [...new Set(courseIds)].toSorted().join(',')
  const [result, setResult] = useState<{
    user: number
    locale: string
    key: string
    canEdit: boolean
    editable: string[]
    spaces: Record<string, string>
  } | null>(null)
  useEffect(() => {
    if (!userId) return
    let live = true
    void publicCalendarLinks(key ? key.split(',') : [], locale).then(
      (access) => {
        if (live) setResult({ ...access, user: userId, locale, key })
      },
      () => {
        if (live) setResult(null)
      },
    )
    return () => {
      live = false
    }
  }, [userId, key, locale, publicCalendarLinks])
  return userId && result?.user === userId && result.key === key && result.locale === locale
    ? result
    : { canEdit: false, editable: [] as string[], spaces: {} as Record<string, string> }
}
