'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import type { CalendarLabels } from './calendar-labels'

type Host = {
  /** What the legend calls an item kind: only the host knows what its kinds are. */
  kind: CalendarLabels['kind']
  newItem: string
}

/** The calendar's words from `messages/*.json` (`CalendarUi`). */
export function useCalendarLabels({ kind, newItem }: Host): CalendarLabels {
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
      blockName: ({ title, day, time, status }) =>
        t('blockName', { title, day, time, status, hasStatus: String(status !== '') }),
      newItem,
      unsaved: t('unsaved'),
      deleted: t('deleted'),
      restore: t('restore'),
      restoreName: ({ title, day, time }) => t('restoreName', { title, day, time }),
      save: t('save'),
      saving: t('saving'),
      cancelEdits: t('cancelEdits'),
      changes: (count) => t('changes', { count }),
      saveFailed: t('saveFailed'),
      editHint: t('editHint'),
      addBlock: (day) => t('addBlock', { day }),
      placeOnDay: t('placeOnDay'),
      announce: (type, label) => t('announce', { type, label }),
    }),
    [t, kind, newItem],
  )
}
