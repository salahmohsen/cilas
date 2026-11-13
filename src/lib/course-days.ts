import type { PayloadRequest } from 'payload'

import { courseTiming, meetingsOf, type Announced } from '@/lib/meetings'

/**
 * A course's `first_day` and `last_day` (ADR 0011): from its sessions'
 * meetings, else from its announced timing (`courseTiming`). Stored on the
 * course so lists sort and filter by start date without reading sessions.
 * A course not saved yet has no sessions.
 */
export const courseDays = async (
  req: PayloadRequest,
  course: number | null,
  announced: Announced | null | undefined,
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
  const { first, last } = courseTiming(meetingsOf(docs), announced)
  return { first_day: first, last_day: last }
}

/**
 * Writes the two days straight to the course row, after a session or the
 * course's announced timing changes outside a course save. Not
 * `payload.update`: that would run the course's review hooks and could
 * publish a fellow's pending draft. The course's own beforeChange recomputes
 * them on every course save, so its versions carry them too.
 */
export const storeCourseDays = async (req: PayloadRequest, course: number): Promise<void> => {
  const { announced } = await req.payload.findByID({
    collection: 'courses',
    id: course,
    depth: 0,
    draft: false,
    overrideAccess: true,
    req,
    select: { announced: true },
  })
  await req.payload.db.updateOne({
    collection: 'courses',
    id: course,
    data: await courseDays(req, course, announced),
    req,
    returning: false,
  })
}
