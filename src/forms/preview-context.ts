import type { Payload } from 'payload'
import { isAdminUser } from '@/access'
import { localeOf } from '@/i18n/routing'
import { courseRegistration } from '@/lib/registration'
import { relId } from '@/lib/relation'
import type { User } from '@/payload-types'
import { applicationContext } from './application-context'

export async function fullFormPreview(
  payload: Payload,
  user: User | null,
  kind: string,
  id: number,
  locale: string,
) {
  if (!isAdminUser(user) || !['cycles', 'courses'].includes(kind) || !Number.isInteger(id))
    return null
  const target = await payload.findByID({
    collection: kind as 'cycles' | 'courses',
    id,
    locale: localeOf(locale),
    depth: 0,
    overrideAccess: false,
    user,
  })
  const cycleId = 'course_type' in target ? relId(target.cycle) : null
  const cycle = cycleId
    ? await payload.findByID({ collection: 'cycles', id: cycleId, depth: 0 })
    : null
  const formId =
    'course_type' in target
      ? courseRegistration(target, cycle).formId
      : relId(target.registration?.form)
  if (!formId) return null
  const form = await payload.findByID({
    collection: 'forms',
    id: formId,
    locale: localeOf(locale),
    fallbackLocale: 'en',
    depth: 1,
    overrideAccess: false,
    user,
  })
  return {
    form,
    title: target.title,
    application: await applicationContext(payload, target, localeOf(locale), user),
  }
}
