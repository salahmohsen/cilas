import type { PayloadRequest } from 'payload'

import { firstDay, lastDay, meetingsOf } from '@/lib/meetings'

/**
 * A course's `first_day` and `last_day` (ADR 0011): the first and last day
 * of its sessions' meetings, not cancelled. Stored on the course so lists
 * sort and filter by start date without reading sessions. A course not saved
 * yet has no sessions.
 */
export const courseDays = async (
  req: PayloadRequest,
  course: number | null,
): Promise<{ first_day: string | null; last_day: string | null }> => {
  const docs =
    course === null
      ? []
      : (
          await req.payload.find({
            collection: 'sessions',
            where: { course: { equals: course } },
            depth: 0,
            pagination: false,
            overrideAccess: true,
            req,
            select: { meetings: true, cancelled: true, position: true },
          })
        ).docs
  const meetings = meetingsOf(docs)
  return { first_day: firstDay(meetings), last_day: lastDay(meetings) }
}

/**
 * Writes the two days straight to the course row, after a session changes
 * outside a course save. Not `payload.update`: that would run the course's
 * review hooks and could publish a fellow's pending draft. The course's own
 * beforeChange recomputes them on every course save, so its versions carry
 * them too.
 */
export const storeCourseDays = async (req: PayloadRequest, course: number): Promise<void> => {
  await req.payload.db.updateOne({
    collection: 'courses',
    id: course,
    data: await courseDays(req, course),
    req,
    returning: false,
  })
}
