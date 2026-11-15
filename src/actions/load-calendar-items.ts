'use server'

import * as z from 'zod'

import type { CalendarItem } from '@/lib/calendar-items'
import { calendarContext } from '@/lib/calendar-context'
import { calendarErrorOf, calendarSourceOf, type CalendarSaveError } from '@/lib/calendar-sources'
import { currentReader } from '@/lib/reader'

export type CalendarLoadResult =
  | { ok: true; items: CalendarItem[]; canEdit: boolean }
  | { ok: false; error: CalendarSaveError }

const parentSchema = z.object({ kind: z.string(), id: z.string() })

const fail = (error: CalendarSaveError): CalendarLoadResult => ({ ok: false, error })

/**
 * The items a calendar parent holds now, and whether the signed-in user may
 * edit them, read with that user's own access. A host calls it to open a
 * calendar and again to reload it after a change made elsewhere. Server
 * components use the same function. A `space` parent composes the course's
 * calendar; `invalid` with reason `no-calendar` means the host omits its tab.
 */
export async function loadCalendarItems(
  parent: { kind: string; id: string },
  locale = 'en',
): Promise<CalendarLoadResult> {
  const user = await currentReader()
  if (!user) return fail({ code: 'unauthenticated' })

  const parsed = parentSchema.safeParse(parent)
  if (!parsed.success) return fail({ code: 'invalid', message: 'The parent is not well formed.' })
  const source = calendarSourceOf(parsed.data.kind)
  if (!source)
    return fail({ code: 'invalid', message: `Nothing is shown for a “${parsed.data.kind}”.` })

  try {
    const ctx = await calendarContext(user, locale)
    const [items, canEdit] = await Promise.all([
      source.load(ctx, parsed.data.id),
      source.canEdit(ctx, parsed.data.id),
    ])
    return { ok: true, items, canEdit }
  } catch (error) {
    return fail(calendarErrorOf(error))
  }
}
