'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { calendarLabelsFrom, type CalendarHostLabels, type CalendarLabels } from './calendar-labels'

/** The calendar's words from `messages/*.json` (`CalendarUi`). */
export function useCalendarLabels({
  kind,
  newItem,
  create,
  menu,
  save,
  saveNote,
}: CalendarHostLabels): CalendarLabels {
  const t = useTranslations('CalendarUi')
  return useMemo(
    () => calendarLabelsFrom(t, { kind, newItem, create, menu, save, saveNote }),
    [t, kind, newItem, create, menu, save, saveNote],
  )
}
