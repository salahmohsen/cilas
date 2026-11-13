'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import type { CalendarLabels } from './calendar-labels'

/**
 * The calendar's words from `messages/*.json` (`CalendarUi`). The host passes
 * `kind`, because only the host knows what its item kinds are called.
 */
export function useCalendarLabels(kind: CalendarLabels['kind']): CalendarLabels {
  const t = useTranslations('CalendarUi')
  return useMemo(
    () => ({
      name: t('name'),
      cairoTime: t('cairoTime'),
      today: t('today'),
      previousWeek: t('previousWeek'),
      nextWeek: t('nextWeek'),
      daySwitcher: t('daySwitcher'),
      allDay: t('allDay'),
      legend: t('legend'),
      timeFormat: t('timeFormat'),
      hours24: t('hours24'),
      hours12: t('hours12'),
      cancelled: t('cancelled'),
      unscheduled: t('unscheduled'),
      kind,
      range: (from, to) => t('range', { from, to }),
      timeRange: (start, end) => t('timeRange', { start, end }),
      blockName: ({ title, day, time, cancelled }) =>
        t('blockName', { title, day, time, cancelled: String(cancelled) }),
    }),
    [t, kind],
  )
}
