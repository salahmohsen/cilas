import { createTranslator, type AbstractIntlMessages } from 'next-intl'

import { calendarLabelsFrom } from '@/components/calendar/ui/calendar-labels'
import type { CalendarSaveError } from '@/lib/calendar-sources'

import type en from '../../../messages/en.json'

/** The admin's language. Payload's own interface is English or Arabic. */
export type AdminLanguage = 'ar' | 'en'

/** What the server hands a client field so it can word itself in the admin's language. */
export type CalendarAdminMessages = {
  CalendarUi: (typeof en)['CalendarUi']
  CalendarAdmin: (typeof en)['CalendarAdmin']
}

/** Every word the admin calendar shows, from `messages/*.json`. */
export const calendarAdminText = (language: AdminLanguage, messages: CalendarAdminMessages) => {
  // Untyped, as the site's hook is, so one label builder serves both.
  const all: AbstractIntlMessages = messages
  const ui = createTranslator({ locale: language, messages: all, namespace: 'CalendarUi' })
  const t = createTranslator({ locale: language, messages, namespace: 'CalendarAdmin' })
  return {
    t,
    labels: calendarLabelsFrom(ui, {
      kind: () => t('session'),
      newItem: t('newSession'),
      menu: {
        addNextDay: t('addMeeting'),
        copyNextWeek: t('newSessionNextWeek'),
        deleteBlock: t('deleteMeeting'),
        addedNextDay: (day) => t('addedMeeting', { day }),
        copiedNextWeek: (day) => t('madeSessionNextWeek', { day }),
      },
      // The course form has its own Save; this one saves the sessions.
      save: t('saveSchedule'),
    }),
    /** A plain sentence for a save that did not happen. */
    errorText: (error: CalendarSaveError): string => {
      switch (error.code) {
        case 'unauthenticated':
          return t('errors.unauthenticated')
        case 'forbidden':
          return t('errors.forbidden')
        case 'not-found':
          return t('errors.notFound')
        case 'stale':
          return t('errors.stale')
        case 'invalid':
          return t('errors.invalid', { message: error.message })
        case 'failed':
          return t('errors.failed')
      }
    },
  }
}
