import type { Payload } from 'payload'

import { isAdminUser, personOf } from '@/access'
import type { SOCIAL_PLATFORMS } from '@/fields/social'
import { ENROLLED } from '@/lib/list-members'
import { plainText } from '@/lib/plaintext'
import { fellowPersonIds, type CommunityAudience } from '@/lib/spaces'

/** Where to find a person: their website first, then each social profile. */
export type PersonLink = { kind: 'website' | (typeof SOCIAL_PLATFORMS)[number]; url: string }

export type SpacePersonRow = {
  accountId: number | null
  id: number
  name: string
  photo: { alt: string; url: string } | null
  slug: string
  visible: boolean
  /** Plain text in the requested language, clipped for a hover card. */
  bio: string | null
  links: PersonLink[]
}

const BIO_MAX = 220

const clip = (text: string): string | null => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  return flat.length > BIO_MAX ? `${flat.slice(0, BIO_MAX - 1).trimEnd()}…` : flat
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
    audience?: CommunityAudience | null
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
    // The same audience rule as membershipOf (src/lib/spaces.ts), as a list.
    const fellows = space.audience === 'fellows' ? await fellowPersonIds(payload) : null
    for (const u of docs) {
      if (space.audience === 'admins' && !isAdminUser(u)) continue
      const pid = personOf(u)
      if (pid && (!fellows || fellows.has(pid))) ids.add(pid)
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
export const spacePeople = async (
  payload: Payload,
  spaceId: number,
  locale: 'en' | 'ar' = 'en',
): Promise<SpacePersonRow[]> =>
  peopleRows(payload, [...(await mentionSafelist(payload, spaceId))], locale)

/** People by id, as a space shows them: name, photo, a clipped bio and links. */
export const peopleRows = async (
  payload: Payload,
  ids: number[],
  locale: 'en' | 'ar' = 'en',
): Promise<SpacePersonRow[]> => {
  if (ids.length === 0) return []

  const { docs: people } = await payload.find({
    collection: 'people',
    where: { id: { in: ids } },
    depth: 1,
    locale,
    overrideAccess: true,
    pagination: false,
    limit: 10000,
  })

  const { docs: users } = await payload.find({
    collection: 'users',
    where: { person: { in: ids } },
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
    const bio = p.bio ? clip(plainText({ data: p.bio })) : null
    const links: PersonLink[] = [
      ...(p.website ? [{ kind: 'website' as const, url: p.website }] : []),
      ...(p.social_links ?? []).map((l) => ({ kind: l.platform, url: l.url })),
    ]
    return {
      bio,
      links,
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

/** The people behind the admin accounts: they act in every space without being members of it. */
export const staffPersonIds = async (payload: Payload): Promise<number[]> => {
  const { docs } = await payload.find({
    collection: 'users',
    where: { roles: { in: ['admin', 'super_admin'] } },
    depth: 0,
    overrideAccess: true,
    pagination: false,
    limit: 1000,
    select: { person: true, roles: true },
  })
  return docs.flatMap((u) => {
    const pid = isAdminUser(u) ? personOf(u) : null
    return pid ? [pid] : []
  })
}
