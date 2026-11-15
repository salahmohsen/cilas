import config from '@payload-config'
import { createTranslator } from 'next-intl'
import { createLocalReq, getPayload } from 'payload'

import { formatsOf } from '@/i18n/formats'
import { localeOf } from '@/i18n/routing'
import type { CalendarContext } from '@/lib/calendar-sources'
import type { User } from '@/payload-types'

const untitledOf = async (locale: string): Promise<CalendarContext['untitled']> => {
  const lang = localeOf(locale)
  const { default: messages } = await import(`../../messages/${lang}.json`)
  const t = createTranslator({
    locale: lang,
    messages,
    namespace: 'Course',
    formats: formatsOf(lang),
  })
  return (number) => t('session', { number })
}

/**
 * What a calendar adapter needs for one request by `user`: a Payload request
 * in their language that can carry a transaction, and the words for untitled
 * items. A server action cannot read the route's language, so the host passes it.
 */
export const calendarContext = async (user: User, locale: string): Promise<CalendarContext> => {
  const payload = await getPayload({ config })
  const req = await createLocalReq({ user, locale: localeOf(locale) }, payload)
  return { req, user, untitled: await untitledOf(locale) }
}
