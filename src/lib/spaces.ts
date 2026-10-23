import type { Access, Payload, Where } from 'payload'

import { cache } from 'react'

import { isAdminUser, personOf } from '@/access'
import { ENROLLED } from '@/lib/list-members'

/**
 * ADR 0009. One helper for every rule and page: membership comes from the
 * records that already exist (spec §1), the switch comes from Site settings
 * (spec §10), and admins pass every check without appearing as members.
 */
export type SpaceKind = 'community' | 'cohort' | 'course'
export type PostingLevel = 'open' | 'members_comment' | 'fellows_only'

export type SpacesSettings = {
  spaces_mode?: 'off' | 'trial' | 'on' | null
  spaces_trial_courses?: Array<number | { id: number }> | null
  spaces_trial_community?: boolean | null
  spaces_trial_cohorts?: Array<number | { id: number }> | null
}

export type SpaceLike = {
  id: number
  kind: SpaceKind
  course?: number | { id: number } | null
  programme?: number | { id: number } | null
  posting?: PostingLevel | null
  reopened?: boolean | null
}

export type SpaceFacts = {
  /** course ids where the person is a listed fellow */
  courseFellows?: number[] | null
  /** enrolled course ids for the person */
  enrolledCourses?: number[] | null
  /** programmes where the person holds any membership */
  memberProgrammes?: number[] | null
  /** programmes where the person's membership role is a residential fellow */
  fellowProgrammes?: number[] | null
  /** whether the account has a linked person (community rule) */
  hasPerson?: boolean | null
}

const relIds = (v: Array<number | { id: number }> | null | undefined) =>
  (v ?? []).map((x) => (typeof x === 'object' ? x.id : x))

const idOf = (v: number | { id: number } | null | undefined) =>
  v == null ? null : typeof v === 'object' ? v.id : v

/**
 * The settings as they read right now. `cache` makes one settings read per
 * render, however many rules and page sections call it (spec §1: the switch
 * is read as it is, once).
 */
export const spacesSettings = cache(async (payload: Payload): Promise<SpacesSettings> => {
  return (await payload.findGlobal({
    slug: 'site-settings',
    overrideAccess: true,
  })) as SpacesSettings
})

export const mode = (settings: SpacesSettings | null | undefined) => settings?.spaces_mode ?? 'off'

/** Whether one space opens now, by the switch alone (spec §10). */
export const spaceOpenOn = (space: SpaceLike, settings: SpacesSettings): boolean => {
  if (mode(settings) === 'on') return true
  if (mode(settings) === 'trial') {
    if (
      space.kind === 'course' &&
      relIds(settings.spaces_trial_courses).includes(idOf(space.course)!)
    )
      return true
    if (
      space.kind === 'cohort' &&
      relIds(settings.spaces_trial_cohorts).includes(idOf(space.programme)!)
    )
      return true
    if (space.kind === 'community') return Boolean(settings.spaces_trial_community)
  }
  return false
}

/**
 * What the person is to one space, from the facts the caller gathered.
 * Admins pass everywhere and are called with `isAdmin: true` by the rules
 * below without ever appearing in member lists (spec §1). Members are worked
 * out only from records that exist: course fellows, enrollments in the
 * course, programme memberships, the account's linked person.
 */
export type Membership = { role: 'moderator' | 'member' | 'none' }
// moderators so far: admins, the course's fellows, the programme's
// residential fellows (spec §7 without step 3's moderation powers).

export const membershipOf = (
  space: SpaceLike,
  facts: SpaceFacts,
  { isAdmin = false }: { isAdmin?: boolean } = {},
): Membership => {
  if (isAdmin) return { role: 'moderator' }
  switch (space.kind) {
    case 'community':
      return { role: facts.hasPerson ? 'member' : 'none' }
    case 'course': {
      const cid = idOf(space.course)
      const f = cid !== null ? (facts.courseFellows ?? []).includes(cid) : false
      const s = cid !== null ? (facts.enrolledCourses ?? []).includes(cid) : false
      return { role: f ? 'moderator' : s ? 'member' : 'none' }
    }
    case 'cohort': {
      const pid = idOf(space.programme)
      const f = pid !== null ? (facts.fellowProgrammes ?? []).includes(pid) : false
      const m = pid !== null ? (facts.memberProgrammes ?? []).includes(pid) : false
      return { role: f ? 'moderator' : m ? 'member' : 'none' }
    }
  }
}

/**
 * Gathers the facts for one person with as few queries as possible:
 * enrollments by person, programme memberships by person, and the courses
 * that list the person as a fellow. `spaces` is every space the caller asks
 * about.
 */
export const factsFor = async (
  payload: Payload,
  personId: number | null,
  spaces: Pick<SpaceLike, 'kind' | 'course' | 'programme'>[],
): Promise<SpaceFacts> => {
  const facts: SpaceFacts = { hasPerson: personId !== null }
  const courseIds = new Set(
    spaces
      .filter((s) => s.kind === 'course')
      .map((s) => idOf(s.course)!)
      .filter(Boolean),
  )
  const programmeIds = new Set(
    spaces
      .filter((s) => s.kind === 'cohort')
      .map((s) => idOf(s.programme)!)
      .filter(Boolean),
  )
  if (personId !== null) {
    if (courseIds.size) {
      const { docs } = await payload.find({
        collection: 'enrollments',
        where: {
          and: [
            { course: { in: [...courseIds] } },
            { status: { in: [...ENROLLED] } },
            { person: { equals: personId } },
          ],
        },
        select: { course: true },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      facts.enrolledCourses = [...new Set(docs.map((e) => idOf(e.course as never)!))]
    }
    if (courseIds.size) {
      const { docs: fellowDocs } = await payload.find({
        collection: 'courses',
        where: { and: [{ id: { in: [...courseIds] } }, { fellows: { in: [personId] } }] },
        select: { slug: true },
        depth: 0,
        draft: true,
        pagination: false,
        overrideAccess: true,
      })
      // Course ids where the person is a listed fellow; membershipOf joins
      // them against the space's own course id, never against a person id.
      // (Payload always returns the id, even projected away.)
      facts.courseFellows = [...new Set(fellowDocs.map((c) => c.id as number))]
    }
    if (programmeIds.size) {
      const { docs } = await payload.find({
        collection: 'memberships',
        where: {
          and: [{ programme: { in: [...programmeIds] } }, { person: { equals: personId } }],
        },
        select: { programme: true, role: true },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      facts.memberProgrammes = [...new Set(docs.map((m) => idOf(m.programme as never)!))]
      // Cohort moderators are the programme's residential fellows (spec §7);
      // visiting fellows are members, not moderators.
      facts.fellowProgrammes = [
        ...new Set(
          docs
            .filter((m) => m.role === 'residential_fellow')
            .map((m) => idOf(m.programme as never)!),
        ),
      ]
    }
  }
  return facts
}

/**
 * Membership of one user (an account) in one space. This is the call every
 * rule and page uses.
 */
export const membership = async (
  payload: Payload,
  user: null | { id?: number; roles?: readonly string[]; person?: unknown },
  space: SpaceLike,
): Promise<Membership> => {
  const isAdmin = user ? isAdminUser(user as never) : false
  if (!user) return { role: 'none' }
  const person = personOf(user)
  if (person === null) return isAdmin ? { role: 'moderator' } : { role: 'none' }
  const facts = await factsFor(payload, person, [space])
  return membershipOf(space, facts, { isAdmin })
}

/* ------------------------------------------------- Where-builders & rules */

type SpaceIds = number[] | true | false

/**
 * The ids of the spaces this account can read right now, `true` for admin/
 * none, `false` for no user. Everything else builds Where clauses on top.
 * `cache` keeps this to one membership read per render — the rules and the
 * pages all ask.
 */
export const readableSpaceIds = cache(
  async (
    payload: Payload,
    user: null | { roles?: readonly string[]; person?: unknown },
    settings?: SpacesSettings,
  ): Promise<SpaceIds> => {
    if (!user) return false
    if (isAdminUser(user as never)) return true
    const stored = settings ?? (await spacesSettings(payload))
    if (mode(stored) === 'off') return false
    const person = personOf(user)
    const { docs } = await payload.find({
      collection: 'spaces',
      depth: 0,
      draft: true,
      pagination: false,
      overrideAccess: true,
    })
    const envelope: Pick<SpaceLike, 'kind' | 'course' | 'programme'>[] = docs
    const facts = await factsFor(payload, person, envelope)
    const open = docs.filter((s) => spaceOpenOn(s as SpaceLike, stored))
    const readable: number[] = []
    for (const s of open) {
      // A course row deleted since its space was made leaves `course: null`
      // (relations null out on delete). Nobody reads that ghost: skip it
      // instead of findById(null) throwing inside a read rule.
      if (s.kind === 'course' && idOf(s.course as never) == null) continue
      if (membershipOf(s as SpaceLike, facts).role !== 'none') readable.push(s.id)
    }
    return readable
  },
)

/** Access rules assembled once, reused by the collections (spec §1). */

/**
 * Reads as a Payload Where: the readable spaces, intersected with whatever
 * the caller adds. Admins get `true` (no constraint). Nothing readable gets
 * `false`, so the rule refuses without trickery.
 */
export const readableWhere = async (
  payload: Payload,
  user: null | { roles?: readonly string[]; person?: unknown },
  field: 'id' | 'space' = 'space',
  settings?: SpacesSettings,
): Promise<Where | boolean> => {
  const ids = await readableSpaceIds(payload, user, settings)
  if (ids === true) return true
  if (!ids || !ids.length) return false
  return { [field]: { in: ids } }
}

/** The space's access read rule for the `spaces` collection itself. */
export const readSpaces: Access = async ({ req }) =>
  req.user ? readableWhere(req.payload, req.user, 'id') : false

/**
 * Whether this member may start a post in this space (spec §7 posting levels,
 * without step 3's moderation powers). Announcement permission needs role
 * and kind — `mayStart` answers only "may this post kind begin here".
 */
export const mayStart = (
  membership: Membership,
  kind: 'discussion' | 'question' | 'announcement',
  posting: PostingLevel = 'open',
):
  | { ok: true }
  | { ok: false; error: 'not-member' | 'read-only' | 'posting-level' | 'announcement' } => {
  if (membership.role === 'none') return { ok: false, error: 'not-member' }
  const mod = membership.role === 'moderator'
  if (kind === 'announcement' && !mod) return { ok: false, error: 'announcement' }
  if (posting === 'fellows_only' && !mod) return { ok: false, error: 'posting-level' }
  if (posting === 'members_comment' && kind !== 'announcement' && !mod)
    return { ok: false, error: 'posting-level' }
  return { ok: true }
}

/**
 * May this member write at all right now (consent and read-only live in the
 * write module — this is the collection access floor).
 */
export const writePostWhere = async (
  payload: Payload,
  user: null | { roles?: readonly string[]; person?: unknown },
): Promise<Where | boolean> => readableWhere(payload, user, 'space')
