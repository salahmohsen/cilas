'use server'

import * as z from 'zod'

import { ACTIVITY_KINDS } from '@/fields/activities'
import { MATERIAL_TYPES } from '@/fields/bibliography'
import { localeOf } from '@/i18n/routing'
import { calendarContext } from '@/lib/calendar-context'
import type { CalendarItem } from '@/lib/calendar-items'
import {
  calendarErrorOf,
  calendarSourceOf,
  CalendarSaveFailure,
  refusalOf,
  type CalendarSaveError,
} from '@/lib/calendar-sources'
import { inTransaction } from '@/lib/in-transaction'
import { byWhen } from '@/lib/meetings'
import { currentReader } from '@/lib/reader'
import { relId } from '@/lib/relation'

/** A stored array row keeps its id, so its other language and its meeting's identity stay. */
const rowId = z.string().min(1).optional()

const editSchema = z.object({
  title: z.string(),
  /** Markdown. */
  description: z.string(),
  cancelled: z.boolean(),
  /** Cairo day and wall-clock times; both times empty is all day. */
  meetings: z.array(
    z.object({ id: rowId, date: z.string(), start_time: z.string(), end_time: z.string() }),
  ),
  bibliography: z.array(
    z.object({
      id: rowId,
      type: z.enum(MATERIAL_TYPES),
      title: z.string(),
      href: z.string(),
      note: z.string(),
    }),
  ),
  activities: z.array(
    z.object({ id: rowId, kind: z.enum(ACTIVITY_KINDS), description: z.string() }),
  ),
})

/** What the session drawer's Edit form holds: a session's own fields, its text in one language. */
export type SessionEdit = z.infer<typeof editSchema>

export type SessionEditLoad =
  | { ok: true; values: SessionEdit; version: string }
  | { ok: false; error: 'unauthenticated' | 'not-found' | 'failed' }

export type SessionEditResult =
  | { ok: true; courseId: string; before: CalendarItem[]; after: CalendarItem[] }
  | { ok: false; error: CalendarSaveError }

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

const orNull = (value: string) => value.trim() || null

/**
 * Saves the Edit form: one Payload update with the person's own access
 * (`overrideAccess: false`), so the sessions collection decides who may and
 * its fields check the values (`meetingProblem` among them). The text goes
 * into `locale` alone. A session saved by someone else since `version` fails
 * as `stale` and nothing is written. On success it returns the course's items
 * before and after, for the announcement offer (`useScheduleOffer`).
 */
export async function saveSessionEdit(
  input: { id: string; version: string; values: SessionEdit },
  locale = 'en',
): Promise<SessionEditResult> {
  const user = await currentReader()
  if (!user) return { ok: false, error: { code: 'unauthenticated' } }
  const parsed = z
    .object({ id: idSchema, version: z.string(), values: editSchema })
    .safeParse(input)
  if (!parsed.success)
    return { ok: false, error: { code: 'invalid', message: 'The save is not well formed.' } }
  const { id, version, values } = parsed.data

  const ctx = await calendarContext(user, locale)
  const { req } = ctx
  const access = { user, overrideAccess: false, req } as const
  const source = calendarSourceOf('course')!
  let courseId: string | null = null
  try {
    return await inTransaction(req, async () => {
      const current = await req.payload.findByID({
        collection: 'sessions',
        id: Number(id),
        depth: 0,
        select: { course: true, updatedAt: true },
        ...access,
      })
      courseId = String(relId(current.course))
      if (current.updatedAt !== version)
        throw new CalendarSaveFailure({ code: 'stale', itemId: id })
      const before = await source.load(ctx, courseId)
      await req.payload.update({
        collection: 'sessions',
        id: Number(id),
        locale: localeOf(locale),
        data: {
          title: orNull(values.title),
          description: orNull(values.description),
          cancelled: values.cancelled,
          meetings: values.meetings.map(({ start_time, end_time, ...m }) => ({
            ...m,
            start_time: start_time || null,
            end_time: end_time || null,
          })),
          bibliography: values.bibliography.map(({ title, href, note, ...m }) => ({
            ...m,
            title: orNull(title),
            href: orNull(href),
            note: orNull(note),
          })),
          activities: values.activities.map(({ description, ...a }) => ({
            ...a,
            description: orNull(description),
          })),
        },
        ...access,
      })
      return { ok: true as const, courseId, before, after: await source.load(ctx, courseId) }
    })
  } catch (error) {
    if (statusOf(error) === 404) return { ok: false, error: { code: 'not-found', itemId: id } }
    // Only a read that found the session can be stale; a refusal before it has no course to name it in.
    const course = courseId as string | null
    return {
      ok: false,
      error: course ? await refusalOf(ctx, source, course, error) : calendarErrorOf(error),
    }
  }
}
