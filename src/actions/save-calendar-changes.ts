'use server'

import config from '@payload-config'
import { createTranslator } from 'next-intl'
import { createLocalReq, getPayload } from 'payload'
import * as z from 'zod'

import { localeOf } from '@/i18n/routing'
import type { CalendarChange, CalendarItem, CalendarSave } from '@/lib/calendar-items'
import {
  calendarSourceOf,
  CalendarSaveFailure,
  type CalendarContext,
  type CalendarSaveError,
} from '@/lib/calendar-sources'
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

// The page is not trusted: the types say what a change is, and this checks it.
const changeSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create-item'), kind: z.string(), blockId: z.string(), ...times }),
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

/** Payload's own refusals, as the typed error the page shows. */
const errorOf = (error: unknown): CalendarSaveError => {
  if (error instanceof CalendarSaveFailure) return error.error
  const { status, data } = (error ?? {}) as {
    status?: number
    data?: { errors?: { message?: string }[] }
  }
  if (status === 403) return { code: 'forbidden' }
  if (status === 400)
    return { code: 'invalid', message: data?.errors?.[0]?.message ?? 'The change is not valid.' }
  console.error('saveCalendarChanges failed', error)
  return { code: 'failed' }
}

const untitledOf = async (locale: string): Promise<CalendarContext['untitled']> => {
  const lang = localeOf(locale)
  const { default: messages } = await import(`../../messages/${lang}.json`)
  const t = createTranslator({ locale: lang, messages, namespace: 'Course' })
  return (unit, number) => t(unit, { number })
}

/**
 * Saves every change a calendar made, or none: one transaction, the signed-in
 * user's own access (`overrideAccess: false`), so the collections decide who
 * may edit what. A change made from an item version that is no longer current
 * fails the whole save as `stale`. On success it returns the parent's items as
 * they now are, so the page can reload.
 *
 * A server action cannot read the route's language, so the host passes it for
 * the titles of untitled items.
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
    const payload = await getPayload({ config })
    const req = await createLocalReq({ user, locale: localeOf(locale) }, payload)
    const ctx: CalendarContext = { req, user, untitled: await untitledOf(locale) }
    const items = await inTransaction(req, async () => {
      await source.apply(ctx, parent.id, changes)
      return source.load(ctx, parent.id)
    })
    return { ok: true, items }
  } catch (error) {
    return fail(errorOf(error))
  }
}
