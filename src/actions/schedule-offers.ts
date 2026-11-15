'use server'

import config from '@payload-config'
import { getPayload } from 'payload'
import * as z from 'zod'

import { cairoDay } from '@/lib/cairo-day'
import { CALENDAR_TONES, type CalendarItem } from '@/lib/calendar-items'
import { currentReader } from '@/lib/reader'
import { scheduleOffers as offersFor, type ScheduleOffer } from '@/lib/schedule-offer'

const itemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  tone: z.enum(CALENDAR_TONES),
  cancelled: z.boolean(),
  version: z.string(),
  blocks: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      start_time: z.string().nullable(),
      end_time: z.string().nullable(),
    }),
  ),
}) satisfies z.ZodType<CalendarItem>

const offerSchema = z.object({
  courseId: z.string().regex(/^\d+$/),
  before: z.array(itemSchema),
  after: z.array(itemSchema),
})

/**
 * The prefilled announcements for a schedule save: the course's items before
 * and after it, as the page holds them, give the changes; the rest is read
 * now with the signed-in person's access. Empty for no one signed in, or
 * when nothing is to be offered. `locale` is the page's language.
 */
export async function scheduleOffers(
  input: z.input<typeof offerSchema>,
  locale = 'en',
): Promise<ScheduleOffer[]> {
  const user = await currentReader()
  if (!user) return []
  const { courseId, before, after } = offerSchema.parse(input)
  return offersFor({
    payload: await getPayload({ config }),
    user,
    courseId: Number(courseId),
    before,
    after,
    today: cairoDay(new Date())!,
    locale,
  })
}
