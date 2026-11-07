import { type Locale, otherLocale } from '@/i18n/routing'
import type { Payload } from 'payload'
import type { Reader } from '@/api/articles.api'
import { isAdminUser } from '@/access'

export async function getEventPreview(payload: Payload, id: number, locale: Locale, user: Reader) {
  if (!isAdminUser(user) || !Number.isSafeInteger(id) || id < 1) return null
  return payload.findByID({
    collection: 'events',
    id,
    locale,
    fallbackLocale: otherLocale(locale),
    depth: 2,
    draft: true,
    user,
    overrideAccess: false,
    disableErrors: true,
  })
}
