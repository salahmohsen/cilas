'use server'

import * as z from 'zod'
import { localeOf } from '@/i18n/routing'
import { calendarContext } from '@/lib/calendar-context'
import { byWhen } from '@/lib/meetings'
import { currentReader } from '@/lib/reader'
import type { SessionEdit } from '@/lib/session-edit'
export type { SessionEdit } from '@/lib/session-edit'

export type SessionEditLoad =
  | { ok: true; values: SessionEdit; version: string }
  | { ok: false; error: 'unauthenticated' | 'not-found' | 'failed' }

const idSchema = z.string().regex(/^\d{1,12}$/)

const statusOf = (error: unknown) => (error as { status?: number } | null)?.status

/**
 * A session's fields for the Edit form, its text in `locale` alone: an empty
 * Arabic title stays empty, never the English one, so a save writes only
 * what the person typed in that language.
 */
export async function loadSessionEdit(id: string, locale = 'en'): Promise<SessionEditLoad> {
  const user = await currentReader()
  if (!user) return { ok: false, error: 'unauthenticated' }
  if (!idSchema.safeParse(id).success) return { ok: false, error: 'not-found' }
  const { req } = await calendarContext(user, locale)
  try {
    const doc = await req.payload.findByID({
      collection: 'sessions',
      id: Number(id),
      depth: 0,
      locale: localeOf(locale),
      fallbackLocale: false,
      select: {
        title: true,
        description: true,
        cancelled: true,
        meetings: true,
        bibliography: true,
        activities: true,
        updatedAt: true,
      },
      user,
      overrideAccess: false,
      req,
    })
    return {
      ok: true,
      version: doc.updatedAt,
      values: {
        title: doc.title ?? '',
        description: doc.description ?? '',
        cancelled: Boolean(doc.cancelled),
        meetings: [...(doc.meetings ?? [])].sort(byWhen).map((m) => ({
          ...(m.id ? { id: m.id } : {}),
          date: m.date,
          start_time: m.start_time ?? '',
          end_time: m.end_time ?? '',
        })),
        bibliography: (doc.bibliography ?? []).map((m) => ({
          ...(m.id ? { id: m.id } : {}),
          type: m.type,
          title: m.title ?? '',
          href: m.href ?? '',
          note: m.note ?? '',
        })),
        activities: (doc.activities ?? []).map((a) => ({
          ...(a.id ? { id: a.id } : {}),
          kind: a.kind,
          description: a.description ?? '',
        })),
      },
    }
  } catch (error) {
    const status = statusOf(error)
    if (status === 403 || status === 404) return { ok: false, error: 'not-found' }
    console.error('session edit load failed', error)
    return { ok: false, error: 'failed' }
  }
}
