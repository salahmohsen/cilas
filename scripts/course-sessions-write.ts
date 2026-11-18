import type { Payload, PayloadRequest } from 'payload'

import type { Locale, Localized, PlannedSession } from './course-sessions-plan'

/**
 * Writes one course's planned sessions (`course-sessions-plan.ts`) through
 * the Payload local API, English first, then Arabic where it has any. The
 * caller runs it in a transaction. Returns each session's old row ID (null
 * for an untitled one) with its new ID. Shared by the fill and the
 * production restore. Delete with the old fields.
 */

type Row = Record<string, unknown> & { id?: string }

const pick = <T>(value: Localized<T>, locale: Locale): T | null => value?.[locale] ?? null

/** A planned session's data in one language, array rows keeping their IDs. */
export const inLocale = (s: PlannedSession, locale: Locale) => ({
  title: pick(s.title, locale),
  description: pick(s.description, locale),
  bibliography: (s.bibliography as Row[]).map((r) => ({
    ...r,
    title: pick(r.title as Localized<string>, locale),
    note: pick(r.note as Localized<string>, locale),
  })),
  activities: (s.activities as Row[]).map((r) => ({
    ...r,
    description: pick(r.description as Localized<string>, locale),
  })),
})

const hasArabic = (s: PlannedSession) =>
  JSON.stringify(inLocale(s, 'ar')) !==
  JSON.stringify({ title: null, description: null, bibliography: [], activities: [] })

export const writePlannedSessions = async (
  payload: Payload,
  req: PayloadRequest,
  course: number,
  sessions: PlannedSession[],
): Promise<Array<[string | null, number]>> => {
  const ids: Array<[string | null, number]> = []
  for (const s of sessions) {
    const common = {
      course,
      delivery: s.delivery,
      cancelled: s.cancelled,
      meetings: s.meetings,
      position: s.position,
    }
    const doc = await payload.create({
      collection: 'sessions',
      locale: 'en',
      data: { ...common, ...inLocale(s, 'en') } as never,
      overrideAccess: true,
      req,
    })
    if (hasArabic(s))
      await payload.update({
        collection: 'sessions',
        id: doc.id,
        locale: 'ar',
        data: inLocale(s, 'ar') as never,
        overrideAccess: true,
        req,
      })
    ids.push([s.from, doc.id])
  }
  return ids
}
