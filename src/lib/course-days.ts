import type { PayloadRequest } from 'payload'

import { firstDay, lastDay, meetingsOf } from '@/lib/meetings'

/**
 * A course's `first_day` and `last_day`, from its sessions' meetings (ADR
 * 0011). Stored on the course so lists sort and filter by start date without
 * reading sessions.
 */
export const courseDays = async (
  req: PayloadRequest,
  course: number,
): Promise<{ first_day: string | null; last_day: string | null }> => {
  const { docs } = await req.payload.find({
    collection: 'sessions',
    where: { course: { equals: course } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
    select: { meetings: true, cancelled: true, position: true },
  })
  const meetings = meetingsOf(docs)
  return { first_day: firstDay(meetings), last_day: lastDay(meetings) }
}

/**
 * Writes the two days straight to the course row, after a session changes.
 * Not `payload.update`: that would run the course's review hooks and could
 * publish a fellow's pending draft. The course's own beforeChange recomputes
 * them on every course save, so its versions carry them too.
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
