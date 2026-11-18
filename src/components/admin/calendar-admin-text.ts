import { createTranslator, type AbstractIntlMessages } from 'next-intl'

import { calendarLabelsFrom } from '@/components/calendar/ui/calendar-labels'
import { formatsOf } from '@/i18n/formats'
import { scheduleSaveText, type ScheduleSaveMessages } from '@/components/space/schedule-save-text'

import type en from '../../../messages/en.json'

/** The admin's language. Payload's own interface is English or Arabic. */
export type AdminLanguage = 'ar' | 'en'

/** What the server hands a client field so it can word itself in the admin's language. */
export type CalendarAdminMessages = ScheduleSaveMessages & {
  CalendarUi: (typeof en)['CalendarUi']
}

export type CalendarEditorMessages = CalendarAdminMessages &
  Pick<typeof en, 'SessionEdit' | 'Spaces' | 'Course'>

/** Every word the admin calendar shows, from `messages/*.json`. */
export const calendarAdminText = (language: AdminLanguage, messages: CalendarAdminMessages) => {
  // Untyped, as the site's hook is, so one label builder serves both.
  const all: AbstractIntlMessages = messages
  const formats = formatsOf(language)
  const ui = createTranslator({ locale: language, messages: all, namespace: 'CalendarUi', formats })
  const t = createTranslator({ locale: language, messages, namespace: 'CalendarAdmin', formats })
  const labels = calendarLabelsFrom(ui, {
    kind: () => t('session'),
    newItem: t('newSession'),
    create: t('newSession'),
    menu: {
      addNextDay: t('addMeeting'),
      copyNextWeek: t('newSessionNextWeek'),
      deleteBlock: t('deleteMeeting'),
      addedNextDay: (day) => t('addedMeeting', { day }),
      copiedNextWeek: (day) => t('madeSessionNextWeek', { day }),
    },
    // The course form has its own Save; this one names what it saves.
    save: t('saveSchedule'),
  })
  return { t, labels, save: scheduleSaveText(language, messages, labels) }
}
