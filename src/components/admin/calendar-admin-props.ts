import type { PayloadRequest } from 'payload'

import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'
import type { AdminLanguage, CalendarAdminMessages } from './calendar-admin-text'

/** The admin's language and the calendar's words in it, for a server field to pass to its client part. */
export const calendarAdminProps = (
  req: PayloadRequest,
): { language: AdminLanguage; messages: CalendarAdminMessages } => {
  const language = req.i18n.language === 'ar' ? 'ar' : 'en'
  const { CalendarUi, CalendarAdmin } = language === 'ar' ? ar : en
  return { language, messages: { CalendarUi, CalendarAdmin } }
}
