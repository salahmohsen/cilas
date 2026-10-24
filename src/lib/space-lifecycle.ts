import { scheduleEndDate } from '@/lib/schedule'

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

/** Yes once 14 days pass since `last`. `reopened` holds the archive open. */
export const readOnly = (
  space: { kind: 'community' | 'cohort' | 'course'; reopened?: boolean | null },
  lastMeeting: string | null,
  daysSinceLast: number | null,
): boolean => {
  if (space.kind !== 'course') return false
  if (space.reopened) return false
  if (!lastMeeting) return false
  return (daysSinceLast ?? 0) >= 14
}

/** The archive state as of now, from the space row and its course row (null outside course spaces). */
export const archivedNow = (
  space: { kind: 'community' | 'cohort' | 'course'; reopened?: boolean | null },
  course: { schedule?: unknown; sessions?: unknown } | null | undefined,
): boolean => {
  const last = course ? courseLastMeeting(course) : null
  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000) : null
  return readOnly(space, last, days)
}
