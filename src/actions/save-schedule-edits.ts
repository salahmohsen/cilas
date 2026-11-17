'use server'

import { calendarContext } from '@/lib/calendar-context'
import type { CalendarItem } from '@/lib/calendar-items'
import {
  calendarSourceOf,
  calendarErrorOf,
  refusalOf,
  type CalendarSaveError,
} from '@/lib/calendar-sources'
import { inTransaction } from '@/lib/in-transaction'
import { currentReader } from '@/lib/reader'
import { relId } from '@/lib/relation'
import { expirePublicLists } from '@/lib/revalidate'
import { scheduleEditsSchema, type ScheduleEdits } from '@/lib/schedule-edits'

export type ScheduleEditsResult =
  | { ok: true; items: CalendarItem[]; before: CalendarItem[]; after: CalendarItem[] }
  | { ok: false; error: CalendarSaveError }

export async function saveScheduleEdits(
  input: ScheduleEdits,
  locale = 'en',
): Promise<ScheduleEditsResult> {
  const user = await currentReader()
  if (!user) return { ok: false, error: { code: 'unauthenticated' } }
  const parsed = scheduleEditsSchema.safeParse(input)
  if (!parsed.success)
    return { ok: false, error: { code: 'invalid', message: 'The save is not well formed.' } }
  const { calendar, details } = parsed.data
  const ctx = await calendarContext(user, locale)
  let parent = calendar?.parent
  try {
    const result = await inTransaction(ctx.req, async () => {
      if (!parent) {
        if (details.length !== 1 || !/^\d{1,12}$/.test(details[0]!.id))
          return {
            ok: false as const,
            error: { code: 'invalid' as const, message: 'Choose one session.' },
          }
        const session = await ctx.req.payload.findByID({
          collection: 'sessions',
          id: Number(details[0]!.id),
          depth: 0,
          select: { course: true },
          req: ctx.req,
          user,
          overrideAccess: false,
        })
        parent = { kind: 'course', id: String(relId(session.course)) }
      }
      const source = calendarSourceOf(parent.kind)
      if (!source)
        return {
          ok: false as const,
          error: { code: 'invalid' as const, message: 'This calendar cannot save.' },
        }
      const before = await source.load(ctx, parent.id)
      await source.apply(ctx, parent.id, calendar?.changes ?? [], details)
      const items = await source.load(ctx, parent.id)
      return { ok: true as const, items, before, after: items }
    })
    if (result.ok) expirePublicLists()
    return result
  } catch (error) {
    const source = parent && calendarSourceOf(parent.kind)
    return {
      ok: false,
      error:
        source && parent ? await refusalOf(ctx, source, parent.id, error) : calendarErrorOf(error),
    }
  }
}
