import type { Payload } from 'payload'
import { isAdminUser } from '@/access'
import { localeOf } from '@/i18n/routing'
import { resolveApplicationTarget } from './application-target'
import { relId } from '@/lib/relation'
import type { Course, Cycle, User } from '@/payload-types'
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
  const cycleId = kind === 'courses' ? relId((target as Course).cycle) : null
  const cycle = cycleId
    ? await payload.findByID({ collection: 'cycles', id: cycleId, depth: 0 })
    : null
  const context = resolveApplicationTarget(
    kind === 'courses'
      ? { kind, target: target as Course }
      : { kind: 'cycles', target: target as Cycle },
    cycle,
  )
  const { formId } = context
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
    application: await applicationContext(payload, context, localeOf(locale), user),
  }
}
