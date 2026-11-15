import type { PayloadRequest } from 'payload'

import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'
import type { AdminLanguage, CalendarAdminMessages } from './calendar-admin-text'

/** The admin's language and the calendar's words in it, for a server field to pass to its client part. */
export const calendarAdminProps = (
  req: PayloadRequest,
): { language: AdminLanguage; messages: CalendarAdminMessages } => {
  const language = req.i18n.language === 'ar' ? 'ar' : 'en'
  const { CalendarUi, CalendarAdmin, SpacePost } = language === 'ar' ? ar : en
  // Only the post write path's error words, for a publish that fails.
  const postErrors = Object.fromEntries(
    Object.entries(SpacePost).filter(([key]) => key.startsWith('saveError_')),
  )
  return { language, messages: { CalendarUi, CalendarAdmin, SpacePost: postErrors } }
}
