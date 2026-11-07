import { relId as unwrapId, relId } from '@/lib/relation'
import type { Access, Payload, Where } from 'payload'

import { cache } from 'react'

import { isAdminUser, personOf } from '@/access'
import { ENROLLED } from '@/lib/list-members'
import { introGated } from '@/lib/space-rules'
import { isGhostCourse } from '@/lib/space-ref'

/**
 * ADR 0009. One helper for every rule and page: membership comes from the
 * records that already exist (spec §1), the switch comes from Site settings
 * (spec §10), and admins pass every check without appearing as members.
 */
export type SpaceKind = 'community' | 'cohort' | 'course'
export type PostingLevel = 'open' | 'members_comment' | 'fellows_only'
/** Who may start an event post, on top of the posting level. */
export type EventPosting = 'members' | 'moderators'
/** Who a community space is for. Course and cohort spaces ignore it. */
export type CommunityAudience = 'all' | 'fellows' | 'admins'

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
  audience?: CommunityAudience | null
  introduction_post?: number | { id: number } | null
}

type SpaceFacts = {
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
  /** whether the person is a fellow of any course or programme (audience `fellows`) */
  isFellow?: boolean | null
}

const relIds = (v: Array<number | { id: number }> | null | undefined) =>
  (v ?? []).map((x) => relId(x))

const idOf = (v: number | { id: number } | null | undefined) => (v == null ? null : unwrapId(v))

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

const membershipOf = (
  space: SpaceLike,
  facts: SpaceFacts,
  { isAdmin = false }: { isAdmin?: boolean } = {},
): Membership => {
  if (isAdmin) return { role: 'moderator' }
  switch (space.kind) {
    case 'community':
      // Admins already returned above, so `admins` lets nobody else in.
      if (space.audience === 'admins') return { role: 'none' }
      if (space.audience === 'fellows') return { role: facts.isFellow ? 'member' : 'none' }
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

/** Roles in a programme that make a person a fellow. */
const FELLOW_ROLES = ['residential_fellow', 'visiting_fellow']

/** A fellow is listed on any course's fellows or holds a fellow role in any programme. */
const isFellowPerson = async (payload: Payload, personId: number): Promise<boolean> => {
  const [{ totalDocs: listed }, { totalDocs: held }] = await Promise.all([
    payload.find({
      collection: 'courses',
      where: { fellows: { in: [personId] } },
      select: { slug: true },
      depth: 0,
      draft: true,
      limit: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'memberships',
      where: { and: [{ person: { equals: personId } }, { role: { in: FELLOW_ROLES } }] },
      select: { role: true },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    }),
  ])
  return listed + held > 0
}

/** Every person who is a fellow somewhere (the member list of a `fellows` community space). */
export const fellowPersonIds = async (payload: Payload): Promise<Set<number>> => {
  const [courses, memberships] = await Promise.all([
    payload.find({
      collection: 'courses',
      select: { fellows: true },
      depth: 0,
      draft: true,
      pagination: false,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'memberships',
      where: { role: { in: FELLOW_ROLES } },
      select: { person: true },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    }),
  ])
  const ids = new Set<number>()
  for (const c of courses.docs) for (const f of relIds(c.fellows as never)) ids.add(f)
  for (const m of memberships.docs) {
    const id = idOf(m.person as never)
    if (id != null) ids.add(id)
  }
  return ids
}

/**
 * Gathers the facts for one person with as few queries as possible:
 * enrollments by person, programme memberships by person, and the courses
 * that list the person as a fellow. `spaces` is every space the caller asks
 * about.
 */
const factsFor = async (
  payload: Payload,
  personId: number | null,
  spaces: Pick<SpaceLike, 'kind' | 'course' | 'programme' | 'audience'>[],
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
    if (spaces.some((s) => s.kind === 'community' && s.audience === 'fellows')) {
      facts.isFellow = await isFellowPerson(payload, personId)
    }
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

type Reader = null | { roles?: readonly string[]; person?: unknown }
type SpaceIds = number[] | true | false

type ReadState = {
  ids: SpaceIds
  /** Space id to its intro post, for the spaces this reader has not introduced themselves in yet */
  gated: Map<number, number>
}

/**
 * The spaces this account can read right now (`true` for admin/none, `false`
 * for no user) and the ones still behind their introduction gate. Everything
 * else builds Where clauses on top. `readStateFor` keeps this to one membership
 * read per render or request — the rules and the pages all ask.
 */
const loadReadState = async (
  payload: Payload,
  user: Reader,
  settings?: SpacesSettings,
): Promise<ReadState> => {
  const gated = new Map<number, number>()
  if (!user) return { ids: false, gated }
  if (isAdminUser(user as never)) return { ids: true, gated }
  const stored = settings ?? (await spacesSettings(payload))
  if (mode(stored) === 'off') return { ids: false, gated }
  const person = personOf(user)
  const { docs } = await payload.find({
    collection: 'spaces',
    depth: 0,
    draft: true,
    pagination: false,
    overrideAccess: true,
  })
  const envelope: Pick<SpaceLike, 'kind' | 'course' | 'programme' | 'audience'>[] = docs
  const facts = await factsFor(payload, person, envelope)
  const open = docs.filter((s) => spaceOpenOn(s as SpaceLike, stored))
  const readable: number[] = []
  const waiting = new Map<number, number>()
  for (const s of open) {
    // Nobody reads a ghost course space: skip it instead of findById(null) throwing inside a read rule.
    if (isGhostCourse(s)) continue
    const { role } = membershipOf(s as SpaceLike, facts)
    if (role === 'none') continue
    readable.push(s.id)
    const intro = idOf(s.introduction_post as never)
    if (introGated(s.kind, role, intro, false)) waiting.set(s.id, intro!)
  }
  if (waiting.size && person !== null) {
    const intros = [...waiting.values()]
    const [{ docs: live }, { docs: mine }] = await Promise.all([
      payload.find({
        collection: 'space-posts',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        select: { space: true },
        where: { and: [{ id: { in: intros } }, { deleted_at: { exists: false } }] },
      }),
      payload.find({
        collection: 'space-comments',
        depth: 0,
        pagination: false,
        overrideAccess: true,
        select: { post: true, space: true },
        where: {
          and: [
            { post: { in: intros } },
            { author: { equals: person } },
            { deleted_at: { exists: false } },
          ],
        },
      }),
    ])
    const liveSpaces = new Map(live.map((p) => [p.id, idOf(p.space as never)]))
    const introduced = new Set(
      mine.map((c) => `${idOf(c.space as never)}:${idOf(c.post as never)}`),
    )
    for (const [space, intro] of waiting)
      if (
        liveSpaces.has(intro) &&
        (liveSpaces.get(intro) !== space || !introduced.has(`${space}:${intro}`))
      )
        gated.set(space, intro)
  }
  return { ids: readable, gated }
}

/** One scope per render, for the pages. A collection's access rule has its request's context instead. */
const renderScope = cache(() => ({}))
const reads = new WeakMap<object, { user: unknown; state: Promise<ReadState> }>()

/**
 * The read state, memoized for one reader in one scope: the request's
 * `context` when the caller has one (the collections' access rules, the
 * private search), else the current render. The scope outlives any copy of the
 * context object, since it is a nested object that spreads keep.
 */
export const readStateFor = (
  payload: Payload,
  user: Reader,
  { context, settings }: { context?: Record<string, unknown>; settings?: SpacesSettings } = {},
): Promise<ReadState> => {
  const scope = context
    ? typeof context.spacesReadScope === 'object' && context.spacesReadScope
      ? context.spacesReadScope
      : (context.spacesReadScope = {})
    : renderScope()
  const prior = reads.get(scope)
  if (prior?.user === user) return prior.state
  const state = loadReadState(payload, user, settings)
  reads.set(scope, { user, state })
  return state
}

export const readableSpaceIds = async (
  payload: Payload,
  user: Reader,
  settings?: SpacesSettings,
): Promise<SpaceIds> => (await readStateFor(payload, user, { settings })).ids

/**
 * The spaces this reader still has to introduce themselves in, each with its
 * intro post: the only post they read there until they comment on it.
 */
export const introGates = async (payload: Payload, user: Reader): Promise<Map<number, number>> =>
  (await readStateFor(payload, user)).gated

/** Access rules assembled once, reused by the collections (spec §1). */

/**
 * Reads as a Payload Where: the readable spaces, intersected with whatever
 * the caller adds. Admins get `true` (no constraint). Nothing readable gets
 * `false`, so the rule refuses without trickery.
 */
export const readableWhere = async (
  payload: Payload,
  user: Reader,
  field: 'id' | 'space' = 'space',
  settings?: SpacesSettings,
): Promise<Where | boolean> => {
  const ids = await readableSpaceIds(payload, user, settings)
  if (ids === true) return true
  if (!ids || !ids.length) return false
  return { [field]: { in: ids } }
}

/**
 * Reads a space's content (posts and everything on them) as a Payload Where:
 * the readable spaces, except that a space behind its introduction gate shows
 * only its intro post. `post` names the field(s) that point at the post: `id`
 * for posts themselves, `post` for comments, and `comment.post` too for files
 * and reactions, which sit on a post or on one of its comments.
 */
export const contentWhere = async (
  payload: Payload,
  user: Reader,
  post: readonly string[],
  context?: Record<string, unknown>,
): Promise<Where | boolean> => {
  const { ids, gated } = await readStateFor(payload, user, { context })
  if (ids === true) return true
  if (!ids || !ids.length) return false
  if (!gated.size) return { space: { in: ids } }
  const open = ids.filter((id) => !gated.has(id))
  return {
    or: [
      ...(open.length ? [{ space: { in: open } }] : []),
      ...[...gated].flatMap(([space, intro]) =>
        post.map((field) => ({
          and: [{ space: { equals: space } }, { [field]: { equals: intro } }],
        })),
      ),
    ],
  }
}

/** The space's access read rule for the `spaces` collection itself. */
export const readSpaces: Access = async ({ req }) =>
  req.user ? readableWhere(req.payload, req.user, 'id') : false
