import { isAdminUser } from '@/access'
import { getPayload } from 'payload'
import config from '@payload-config'

import type { Locale } from '@/i18n/routing'
import { calendarContext } from '@/lib/calendar-context'
import { calendarSourceOf } from '@/lib/calendar-sources'
import { currentReader } from '@/lib/reader'
import { relId } from '@/lib/relation'

export async function publicCalendarAccess(
  edit: boolean,
  locale: Locale,
  range: { from: string; to: string },
) {
  if (!edit) return { mode: 'view' as const, canEdit: false }
  const user = await currentReader()
  if (!isAdminUser(user)) return { mode: 'view' as const, canEdit: false }
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'sessions',
    where: {
      and: [
        { 'meetings.date': { greater_than_equal: range.from } },
        { 'meetings.date': { less_than_equal: range.to } },
      ],
    },
    depth: 0,
    pagination: false,
    select: { course: true, meetings: true },
    user,
    overrideAccess: false,
  })
  const courses = [
    ...new Set(
      docs
        .filter((session) =>
          session.meetings?.some(
            (meeting) => meeting.date >= range.from && meeting.date <= range.to,
          ),
        )
        .map((session) => String(relId(session.course))),
    ),
  ]
  const parent = { kind: 'public', id: courses.join(',') }
  const ctx = await calendarContext(user!, locale)
  return {
    mode: 'edit' as const,
    canEdit: true as const,
    parent,
    items: await calendarSourceOf('public')!.load(ctx, parent.id),
  }
}
