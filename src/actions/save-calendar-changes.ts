'use server'

import * as z from 'zod'

import type { CalendarChange, CalendarItem, CalendarSave } from '@/lib/calendar-items'
import { calendarContext } from '@/lib/calendar-context'
import { calendarErrorOf, calendarSourceOf, type CalendarSaveError } from '@/lib/calendar-sources'
import { inTransaction } from '@/lib/in-transaction'
import { currentReader } from '@/lib/reader'

export type CalendarSaveResult =
  | { ok: true; items: CalendarItem[] }
  | { ok: false; error: CalendarSaveError }

const times = {
  date: z.string(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
}

const newBlockSchema = z.object({ blockId: z.string(), ...times })

// The page is not trusted: the types say what a change is, and this checks it.
const changeSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('create-item'),
    kind: z.string(),
    blocks: z.tuple([newBlockSchema], newBlockSchema),
  }),
  z.object({
    op: z.literal('add-block'),
    itemId: z.string(),
    version: z.string(),
    blockId: z.string(),
    ...times,
  }),
  z.object({
    op: z.literal('move-block'),
    itemId: z.string(),
    version: z.string(),
    blockId: z.string(),
    ...times,
  }),
  z.object({
    op: z.literal('delete-block'),
    itemId: z.string(),
    version: z.string(),
    blockId: z.string(),
  }),
]) satisfies z.ZodType<CalendarChange>

const saveSchema = z.object({
  parent: z.object({ kind: z.string(), id: z.string() }),
  changes: z.array(changeSchema),
}) satisfies z.ZodType<CalendarSave>

const fail = (error: CalendarSaveError): CalendarSaveResult => ({ ok: false, error })

/**
 * Saves every change a calendar made, or none: one transaction, the signed-in
 * user's own access (`overrideAccess: false`), so the collections decide who
 * may edit what. A change made from an item version that is no longer current
 * fails the whole save as `stale`. On success it returns the parent's items as
 * they now are, so the page can reload.
 */
export async function saveCalendarChanges(
  save: CalendarSave,
  locale = 'en',
): Promise<CalendarSaveResult> {
  const user = await currentReader()
  if (!user) return fail({ code: 'unauthenticated' })

  const parsed = saveSchema.safeParse(save)
  if (!parsed.success) return fail({ code: 'invalid', message: 'The save is not well formed.' })
  const { parent, changes } = parsed.data
  const source = calendarSourceOf(parent.kind)
  if (!source) return fail({ code: 'invalid', message: `Nothing is saved on a “${parent.kind}”.` })

  try {
    const ctx = await calendarContext(user, locale)
    const items = await inTransaction(ctx.req, async () => {
      await source.apply(ctx, parent.id, changes)
      return source.load(ctx, parent.id)
    })
    return { ok: true, items }
  } catch (error) {
    return fail(calendarErrorOf(error))
  }
}
