import type { Payload } from 'payload'
import type { Locale, Reader } from '@/api/articles.api'
import { isAdminUser } from '@/access'

export async function getEventPreview(payload: Payload, id: number, locale: Locale, user: Reader) {
  if (!isAdminUser(user) || !Number.isSafeInteger(id) || id < 1) return null
  return payload.findByID({
    collection: 'events',
    id,
    locale,
    fallbackLocale: locale === 'ar' ? 'en' : 'ar',
    depth: 2,
    draft: true,
    user,
    overrideAccess: false,
    disableErrors: true,
  })
}
