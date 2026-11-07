import { scheduleEndDate } from '@/lib/schedule'
import { readOnly } from '@/lib/space-rules'
import type { SpaceKind } from '@/lib/spaces'

/**
 * A course space turns read-only 14 days after its last meeting (spec §11).
 * The last meeting comes from the schedule (ADR 0002) plus any session date
 * overrides — `scheduleEndDate` (src/lib/schedule.ts) is already the one
 * judge of a course's dates; this wraps it so the space layer never
 * recomputes dates by another rule.
 */
export const courseLastMeeting = (course: {
  schedule?: unknown
  sessions?: unknown
}): string | null => scheduleEndDate(course.schedule as never, course.sessions as never)

const DAY_MS = 86_400_000

export const archiveOf = (
  space: { kind: SpaceKind; reopened?: boolean | null },
  course: { schedule?: unknown; sessions?: unknown } | null | undefined,
): { archived: boolean; lastMeeting: string | null; daysSince: number | null } => {
  const lastMeeting = course ? courseLastMeeting(course) : null
  const daysSince = lastMeeting
    ? Math.floor((Date.now() - new Date(lastMeeting).getTime()) / DAY_MS)
    : null
  return { archived: readOnly(space, lastMeeting, daysSince), lastMeeting, daysSince }
}

export const archivedNow = (
  space: Parameters<typeof archiveOf>[0],
  course: Parameters<typeof archiveOf>[1],
): boolean => archiveOf(space, course).archived
