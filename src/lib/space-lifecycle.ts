import { readOnly } from '@/lib/space-rules'
import type { SpaceKind } from '@/lib/spaces'

/**
 * A course space turns read-only 14 days after its last meeting (spec §11).
 * The last meeting is the course's `last_day`, kept from its sessions'
 * meetings (`lib/course-days.ts`, ADR 0011), so the space layer never
 * recomputes dates by another rule. Read it from the course row, not a draft
 * version: sessions have no drafts, and only the row follows their changes.
 */
export const courseLastMeeting = (course: { last_day?: string | null }): string | null =>
  course.last_day || null

const DAY_MS = 86_400_000

export const archiveOf = (
  space: { kind: SpaceKind; reopened?: boolean | null },
  course: { last_day?: string | null } | null | undefined,
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
