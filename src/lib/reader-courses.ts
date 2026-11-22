import type { Payload } from 'payload'

import { personOf } from '@/access'
import { ENROLLED } from '@/lib/list-members'
import { relId } from '@/lib/relation'
import type { User } from '@/payload-types'

/**
 * The ids of the courses a signed-in reader belongs to: the ones they teach
 * (a fellow, drafts included) and the ones they take (`ENROLLED`: accepted, confirmed or completed). Both reads
 * are gated, so a course the reader may not read never appears. An account
 * with no person has no course, and no query runs.
 */
export const readerCourseIds = async (payload: Payload, user: User): Promise<number[]> => {
  const person = personOf(user)
  if (person === null) return []
  const [taught, enrolled] = await Promise.all([
    payload.find({
      collection: 'courses',
      where: { fellows: { contains: person } },
      select: { fellows: true },
      depth: 0,
      pagination: false,
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'enrollments',
      where: { and: [{ person: { equals: person } }, { status: { in: [...ENROLLED] } }] },
      select: { course: true },
      depth: 0,
      pagination: false,
      user,
      overrideAccess: false,
    }),
  ])
  const ids = new Set<number>(taught.docs.map((course) => course.id))
  for (const { course } of enrolled.docs) {
    const id = relId(course)
    if (typeof id === 'number') ids.add(id)
  }
  return [...ids]
}
