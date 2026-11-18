import type { Payload } from 'payload'

import type { CalendarItem } from '@/lib/calendar-items'
import { calendarContext } from '@/lib/calendar-context'
import { calendarSourceOf } from '@/lib/calendar-sources'
import { courseLanguage } from '@/lib/course-language'
import {
  scheduleBlock,
  scheduleChanges,
  scheduleChangeText,
  type ScheduleChangeLocale,
} from '@/lib/schedule-changes'
import { scheduleLineRef, scheduleView } from '@/lib/session-refs'
import { mayAnnounce } from '@/lib/spaces-write'
import type { User } from '@/payload-types'

/**
 * One space's prefilled announcement after a schedule save (ADR 0011,
 * "Saving and telling people"). The dialog shows `text` to edit and, when
 * there is a block, `preview` with a box that adds `block` to the body.
 */
export type ScheduleOffer = {
  space: { id: number; name: string }
  /** The language of the text: the course's own. */
  language: ScheduleChangeLocale
  text: string
  /** The `::schedule[...]` token, or null when nothing changed is left to show. */
  block: string | null
  /** What the block shows now: its weeks' items, the changed ones, the day it opens on. */
  preview: { items: CalendarItem[]; marked: string[]; day: string } | null
}

/**
 * The announcements a person is offered after saving a course's schedule:
 * one for each space of the course where they may post an announcement, or
 * none when no change counts (`scheduleChanges`). The course decides the
 * language: the one its own text is written in, as the course page reads it
 * (`courseLanguage`, in the default locale), and session names are loaded
 * in it. `locale` is the page's: the space's name and the preview are read in
 * it, as the page's own calendar is. All reads use the person's own access.
 */
export const scheduleOffers = async ({
  payload,
  user,
  courseId,
  before,
  after,
  today,
  locale,
}: {
  payload: Payload
  user: User
  courseId: number
  before: readonly CalendarItem[]
  after: readonly CalendarItem[]
  today: string
  locale: string
}): Promise<ScheduleOffer[]> => {
  const changes = scheduleChanges(before, after, today)
  if (!changes.length) return []

  const { docs: spaces } = await payload.find({
    collection: 'spaces',
    where: { course: { equals: courseId } },
    depth: 0,
    pagination: false,
    // The display name is worked out from the kind and the course.
    select: { kind: true, name: true, course: true, display_name: true },
    locale: locale === 'ar' ? 'ar' : 'en',
    overrideAccess: true,
  })
  const open = (
    await Promise.all(
      spaces.map(async (space) => ((await mayAnnounce(payload, user, space.id)) ? space : null)),
    )
  ).filter((space) => space !== null)
  if (!open.length) return []

  const course = await payload.findByID({
    collection: 'courses',
    id: courseId,
    depth: 0,
    draft: true,
    select: { title: true, subtitle: true, description: true },
    user,
    overrideAccess: false,
  })
  const language = courseLanguage(course)
  const source = calendarSourceOf('course')!
  // The text is in the course's language; the preview looks as the page's calendar does.
  const [names, items] = await Promise.all([
    calendarContext(user, language).then((ctx) => source.names(ctx, String(courseId))),
    calendarContext(user, locale).then((ctx) => source.load(ctx, String(courseId))),
  ])
  const token = scheduleBlock(changes, today)
  const ref = token ? scheduleLineRef(token) : null
  const view = ref ? scheduleView(items, ref) : null
  const text = scheduleChangeText(changes, language, names)

  return open.map((space) => ({
    space: { id: space.id, name: space.display_name ?? '' },
    language,
    text,
    block: view ? token : null,
    preview: view && ref ? { items: view.items, marked: ref.ids, day: view.day } : null,
  }))
}
