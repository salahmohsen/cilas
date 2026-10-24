import type { Payload } from 'payload'

import { personOf } from '@/access'
import { ENROLLED } from '@/lib/list-members'

export type SpacePersonRow = {
  accountId: number | null
  id: number
  name: string
  photo: { alt: string; url: string } | null
  slug: string
  visible: boolean
}

/**
 * The person ids that may be mentioned inside one space (spec §5). Enumerating
 * members is the one place it is allowed, for validation — never for display.
 */
export const mentionSafelist = async (payload: Payload, spaceId: number): Promise<Set<number>> => {
  const space = (await payload.findByID({
    collection: 'spaces',
    id: spaceId,
    depth: 0,
    overrideAccess: true,
  })) as {
    kind: 'community' | 'cohort' | 'course'
    course?: number | { id: number } | null
    programme?: number | { id: number } | null
  }
  const ids = new Set<number>()

  if (space.kind === 'community') {
    const { docs } = await payload.find({
      collection: 'users',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      limit: 10000,
    })
    for (const u of docs) {
      const pid = personOf(u)
      if (pid) ids.add(pid)
    }
    return ids
  }

  if (space.kind === 'course') {
    const courseId = typeof space.course === 'object' ? space.course?.id : space.course
    if (courseId) {
      const course = (await payload.findByID({
        collection: 'courses',
        id: courseId,
        depth: 0,
        overrideAccess: true,
        select: { fellows: true },
      })) as {
        fellows?: Array<number | { id: number }>
      }
      for (const f of course.fellows ?? []) ids.add(typeof f === 'object' ? f.id : f)
      const { docs: enrollments } = await payload.find({
        collection: 'enrollments',
        where: { and: [{ course: { equals: courseId } }, { status: { in: [...ENROLLED] } }] },
        depth: 0,
        overrideAccess: true,
        pagination: false,
        limit: 10000,
      })
      for (const e of enrollments) {
        const pid = personOf(e as { person?: unknown })
        if (pid) ids.add(pid)
      }
    }
    return ids
  }

  if (space.kind === 'cohort') {
    const programmeId = typeof space.programme === 'object' ? space.programme?.id : space.programme
    if (programmeId) {
      const { docs: memberships } = await payload.find({
        collection: 'memberships',
        where: { programme: { equals: programmeId } },
        depth: 0,
        overrideAccess: true,
        pagination: false,
        limit: 10000,
      })
      for (const m of memberships) {
        const pid = personOf(m as { person?: unknown })
        if (pid) ids.add(pid)
      }
    }
    return ids
  }

  return ids
}

/**
 * One enumeration helper for every shape the space needs: the person rows
 * (id, name, slug, visible, photo) plus the account id where the person-user
 * join exists. Used by the roster, the mention suggestions and the
 * announcement recipients.
 */
export const spacePeople = async (payload: Payload, spaceId: number): Promise<SpacePersonRow[]> => {
  const memberIds = await mentionSafelist(payload, spaceId)
  if (memberIds.size === 0) return []

  const { docs: people } = await payload.find({
    collection: 'people',
    where: { id: { in: [...memberIds] } },
    depth: 1,
    overrideAccess: true,
    pagination: false,
    limit: 10000,
  })

  const { docs: users } = await payload.find({
    collection: 'users',
    depth: 0,
    overrideAccess: true,
    pagination: false,
    limit: 10000,
  })
  const accountByPerson = new Map<number, number>()
  for (const u of users) {
    const pid = personOf(u)
    if (pid && typeof (u as { id?: number }).id === 'number')
      accountByPerson.set(pid, (u as { id: number }).id)
  }

  return people.map((p) => {
    const photo = (p as { photo?: { url?: string; alt?: string } | number | null }).photo
    return {
      accountId: accountByPerson.get((p as { id: number }).id) ?? null,
      id: (p as { id: number }).id,
      name: (p as { name?: string }).name ?? '',
      photo:
        photo && typeof photo === 'object' && photo.url
          ? { alt: photo.alt ?? '', url: photo.url }
          : null,
      slug: (p as { slug?: string }).slug ?? '',
      visible: (p as { visible?: boolean }).visible ?? false,
    }
  })
}
