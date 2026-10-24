import type { Payload, Where } from 'payload'

import { personOf } from '@/access'
import type { ReactionCounts, ReactionKind } from '@/components/arc/reactions/reactions'
import { archivedNow, courseLastMeeting, readOnly } from '@/lib/space-lifecycle'
import { NOTICE_VERSION } from '@/lib/space-consent'
import {
  mode,
  readableSpaceIds,
  spaceOpenOn,
  spacesSettings,
  type SpacesSettings,
} from '@/lib/spaces'
import type { Course, Programme, Space, SpacePost, User } from '@/payload-types'

/**
 * The reads behind the spaces pages (spec §2, §7, §11, §13). Two gates, on
 * purpose:
 * - Identity (spaces, courses, programmes) is read by the membership layer
 *   with `overrideAccess`: the ids are already exactly `readableSpaceIds`
 *   (the same read `factsFor` does), and a tile's course title must show
 *   even when the member cannot read the tier-owner course document (spec
 *   §2).
 * - Content (posts, comments, reactions, the member's own visits) passes
 *   `user` with `overrideAccess: false` — Payload's Local API defaults to
 *   `overrideAccess: true`, so the explicit false keeps the collections'
 *   read rules as the one gate.
 * `participation` is fully internal (see below): a moderator-page
 * aggregate whose caller has already checked the role (spec §13).
 */

const relId = (v: number | { id: number } | null | undefined) =>
  v == null ? null : typeof v === 'object' ? v.id : v

/** Markdown to one plain line for a preview: links keep their text, marks drop. */
export const previewOf = (body: string | null | undefined, max = 120): string | null => {
  if (!body?.trim()) return null
  const plain = body
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain || null
}

/**
 * The people who moderate a space (spec §7): the course's fellows, or the
 * programme's residential fellows. Admins moderate too but are accounts,
 * not people, so they carry no badge.
 */
export const moderatorPeople = async (payload: Payload, space: Space): Promise<Set<number>> => {
  if (space.kind === 'course' && space.course != null) {
    const course = await payload.findByID({
      collection: 'courses',
      id: relId(space.course)!,
      depth: 0,
      draft: true,
      select: { fellows: true },
      overrideAccess: true,
    })
    return new Set((course.fellows ?? []).map((f) => relId(f)!).filter((v) => v != null))
  }
  if (space.kind === 'cohort' && space.programme != null) {
    const { docs } = await payload.find({
      collection: 'memberships',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { person: true },
      where: {
        and: [
          { programme: { equals: relId(space.programme) } },
          { role: { equals: 'residential_fellow' } },
        ],
      },
    })
    return new Set(docs.map((m) => relId(m.person as never)!).filter((v) => v != null))
  }
  return new Set()
}

/** The community space's fixed label (spec §2: it is the one kind with no document behind it). */
export const COMMUNITY_LABEL = 'Community'

/** One row of My spaces (spec §2): a link, an unread count, a last activity. */
export type SpaceSummary = {
  space: Space
  /** community: the fixed label; course: the course title; cohort: the programme title */
  title: string
  href: string
  unread: number
  lastActivity: string | null
  /** A course space past its 14 days (spec §11); always false for the other kinds */
  archived: boolean
  /** The first words of the newest post, as plain text */
  preview: string | null
}

/** My spaces for one signed-in member: the community, their cohorts and courses. */
export const mySpaces = async (
  payload: Payload,
  user: null | User,
  locale: string,
): Promise<{
  community: SpaceSummary | null
  cohorts: SpaceSummary[]
  courses: SpaceSummary[]
}> => {
  const settings = await spacesSettings(payload)
  if (mode(settings) === 'off') return { community: null, cohorts: [], courses: [] }
  const ids = await readableSpaceIds(payload, user, settings)
  if (!ids || !user) return { community: null, cohorts: [], courses: [] }

  // Spaces read internals of the membership layer (the ids are exactly
  // readableSpaceIds — the same override `factsFor` uses; the collection rule
  // would only re-filter that same set). Content below stays rule-gated.
  const { docs } = await payload.find({
    collection: 'spaces',
    depth: 0,
    pagination: false,
    overrideAccess: true,
    where: ids === true ? undefined : { id: { in: ids } },
  })

  const courseIds = [
    ...new Set(
      docs
        .map((s) => (s.kind === 'course' ? relId(s.course) : null))
        .filter((v): v is number => v != null),
    ),
  ]
  const programmeIds = [
    ...new Set(
      docs
        .map((s) => (s.kind === 'cohort' ? relId(s.programme) : null))
        .filter((v): v is number => v != null),
    ),
  ]
  // Titles and slugs read through the membership layer too: an enrolled
  // student may not read a tier-owner course, yet the tile still shows the
  // course's name (spec §2).
  type Label = { id: number; title: string; slug: string; schedule?: unknown; sessions?: unknown }
  const labels = (collection: 'courses' | 'programmes', ready: number[]) =>
    ready.length
      ? (payload.find({
          collection,
          depth: 0,
          draft: true,
          pagination: false,
          overrideAccess: true,
          select:
            collection === 'courses'
              ? { title: true, slug: true, schedule: true, sessions: true }
              : { title: true, slug: true },
          where: { id: { in: ready } },
        }) as Promise<{ docs: Label[] }>)
      : Promise.resolve({ docs: [] as Label[] })
  const [{ docs: courseDocs }, { docs: programmeDocs }] = await Promise.all([
    labels('courses', courseIds),
    labels('programmes', programmeIds),
  ])
  const courseOf = new Map(courseDocs.map((c) => [c.id, c]))
  const programmeOf = new Map(programmeDocs.map((p) => [p.id, p]))

  const { docs: visits } = await payload.find({
    collection: 'space-visits',
    user,
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  const visitedAt = new Map<number, string>()
  for (const v of visits) {
    const sid = relId(v.space)
    if (sid != null) visitedAt.set(sid, v.last_visited_at)
  }

  // One posts read across every readable space, grouped in memory — small N,
  // so no warehouse (spec §7): posts, visits and grouping, never a join tree.
  const { docs: posts } = await payload.find({
    collection: 'space-posts',
    user,
    depth: 0,
    pagination: false,
    overrideAccess: false,
    select: { space: true, author: true, createdAt: true, last_activity_at: true, body: true },
    where: {
      and: [{ deleted_at: { exists: false } }, ...(ids === true ? [] : [{ space: { in: ids } }])],
    },
  })
  const postsBySpace = new Map<number, typeof posts>()
  for (const p of posts) {
    const sid = relId(p.space)
    if (sid != null) postsBySpace.set(sid, [...(postsBySpace.get(sid) ?? []), p])
  }

  const person = personOf(user)
  let community: SpaceSummary | null = null
  const cohorts: SpaceSummary[] = []
  const courses: SpaceSummary[] = []
  for (const s of docs) {
    const courseId = relId(s.course)
    // A course row deleted since its space was made leaves `course: null`.
    // Nobody reads that ghost (mirrors readableSpaceIds).
    if (s.kind === 'course' && courseId == null) continue
    const list = postsBySpace.get(s.id) ?? []
    const visited = visitedAt.get(s.id)
    const unread = list.filter(
      (p) =>
        (!visited || p.createdAt > visited) && !(person !== null && relId(p.author) === person),
    ).length
    const lastActivity = list.reduce<string | null>((acc, p) => {
      const when = p.last_activity_at ?? p.createdAt
      return acc && acc > when ? acc : when
    }, null)
    const course = s.kind === 'course' ? courseOf.get(relId(s.course) ?? -1) : undefined
    const programme = s.kind === 'cohort' ? programmeOf.get(relId(s.programme) ?? -1) : undefined
    const summary: SpaceSummary = {
      space: s,
      title: course?.title ?? programme?.title ?? COMMUNITY_LABEL,
      href:
        s.kind === 'community'
          ? `/${locale}/spaces/community`
          : `/${locale}/spaces/${s.kind}/${course?.slug ?? programme?.slug ?? ''}`,
      unread,
      lastActivity,
      archived: archivedNow(s, course),
      preview: previewOf(
        list.reduce<(typeof list)[number] | null>(
          (acc, p) => (acc && acc.createdAt > p.createdAt ? acc : p),
          null,
        )?.body,
      ),
    }
    if (s.kind === 'community') community = community ?? summary
    else if (s.kind === 'cohort') cohorts.push(summary)
    else courses.push(summary)
  }
  return { community, cohorts, courses }
}

/**
 * A space's archive state (spec §11), from the rows as they stand now: a
 * passed-in space row can carry a stale snapshot (reopened or the schedule
 * may have changed since), so both are read fresh, through the membership
 * layer's own override (the same one `factsFor` holds).
 */
const archiveState = async (payload: Payload, space: number | Space) => {
  const row = (await payload.findByID({
    collection: 'spaces',
    id: typeof space === 'object' ? space.id : space,
    depth: 0,
    overrideAccess: true,
  })) as Space
  const courseRel = row.kind === 'course' ? relId(row.course) : null
  const course =
    courseRel != null
      ? await payload.findByID({
          collection: 'courses',
          id: courseRel,
          depth: 0,
          draft: true,
          overrideAccess: true,
        })
      : null
  const lastMeeting = course ? courseLastMeeting(course) : null
  const daysSince = lastMeeting
    ? Math.floor((Date.now() - new Date(lastMeeting).getTime()) / 86_400_000)
    : null
  const archived = readOnly({ kind: row.kind, reopened: row.reopened }, lastMeeting, daysSince)
  return { row, archived, lastMeeting, daysSince }
}

type Reactions = { counts: ReactionCounts; mine: ReactionKind[] }

const NO_REACTIONS: Reactions = { counts: {}, mine: [] }

/** Reaction rows grouped by their target, with the viewer's own marked. */
const tally = <R extends { reaction: string; account?: number | { id: number } | null }>(
  rows: R[],
  targetOf: (row: R) => number | null,
  viewer: null | User,
): Map<number, Reactions> => {
  const out = new Map<number, Reactions>()
  for (const r of rows) {
    const target = targetOf(r)
    if (target == null) continue
    const entry = out.get(target) ?? { counts: {}, mine: [] }
    const kind = r.reaction as ReactionKind
    entry.counts[kind] = (entry.counts[kind] ?? 0) + 1
    if (viewer && relId(r.account) === viewer.id) entry.mine.push(kind)
    out.set(target, entry)
  }
  return out
}

/** One row of the space feed (spec §7): the post with its roll-up counts. */
export type FeedRow = {
  post: SpacePost
  /** null means the post has no author — the intro post reads as CILAS */
  authorName: string | null
  /** The author's person id, for the photo and the moderator badge */
  authorId: number | null
  commentCount: number
  /** The two newest comments, oldest first, for the card's preview */
  latestComments: { id: number; authorId: number | null; body: string; createdAt: string }[]
  reactions: Reactions
}

/**
 * One space's feed: pinned first, then last activity (spec §7), and the
 * course kind's archive state (spec §11) for read-only rendering.
 */
export const spaceFeed = async (
  payload: Payload,
  user: null | User,
  space: number | Space,
): Promise<{
  rows: FeedRow[]
  settings: SpacesSettings
  archived: boolean
  lastMeeting: string | null
  daysSince: number | null
}> => {
  const [settings, { row, archived, lastMeeting, daysSince }] = await Promise.all([
    spacesSettings(payload),
    archiveState(payload, space),
  ])

  const { docs } = await payload.find({
    collection: 'space-posts',
    user: user ?? undefined,
    depth: 1,
    pagination: false,
    overrideAccess: false,
    sort: ['-pinned', '-last_activity_at'],
    where: {
      and: [{ space: { equals: row.id } }, { deleted_at: { exists: false } }],
    },
  })

  const postIds = docs.map((p) => p.id)
  const commentCountOf = new Map<number, number>()
  const latestOf = new Map<number, FeedRow['latestComments']>()
  let reactionsOf = new Map<number, Reactions>()
  if (postIds.length) {
    const { docs: comments } = await payload.find({
      collection: 'space-comments',
      user: user ?? undefined,
      depth: 0,
      pagination: false,
      overrideAccess: false,
      select: { post: true, author: true, body: true, createdAt: true },
      sort: 'createdAt',
      where: {
        and: [{ post: { in: postIds } }, { deleted_at: { exists: false } }],
      },
    })
    for (const c of comments) {
      const pid = relId(c.post)
      if (pid == null) continue
      commentCountOf.set(pid, (commentCountOf.get(pid) ?? 0) + 1)
      const latest = latestOf.get(pid) ?? []
      latest.push({
        id: c.id,
        authorId: relId(c.author as never),
        body: c.body,
        createdAt: c.createdAt,
      })
      latestOf.set(pid, latest.slice(-2))
    }

    const { docs: reactions } = await payload.find({
      collection: 'space-reactions',
      user: user ?? undefined,
      depth: 0,
      pagination: false,
      overrideAccess: false,
      select: { post: true, account: true, reaction: true },
      where: { post: { in: postIds } },
    })
    reactionsOf = tally(reactions, (r) => relId(r.post), user)
  }

  const rows: FeedRow[] = docs.map((p) => ({
    post: p,
    authorName: typeof p.author === 'object' && p.author ? p.author.name : null,
    authorId: relId(p.author as never),
    commentCount: commentCountOf.get(p.id) ?? 0,
    latestComments: latestOf.get(p.id) ?? [],
    reactions: reactionsOf.get(p.id) ?? NO_REACTIONS,
  }))
  return { rows, settings, archived, lastMeeting, daysSince }
}

/** A private file on a post or comment (ADR 0008), served through Payload's read rule. */
export type SpaceFileRef = { id: number; url: string; name: string; size: number }

/** One comment in a post's thread. A deleted comment with replies stays as a placeholder (spec §3). */
export type ThreadComment = {
  id: number
  authorId: number | null
  body: string
  createdAt: string
  edited: boolean
  deleted: boolean
  file: SpaceFileRef | null
  reactions: Reactions
}

/** Replies go one level under a comment (spec §4: two levels in all). */
export type TopComment = ThreadComment & { replies: ThreadComment[] }

export type PostView = {
  row: FeedRow
  files: SpaceFileRef[]
  comments: TopComment[]
  /** Deleted with comments: the body is gone, the thread stays (spec §3) */
  deleted: boolean
  archived: boolean
}

/** The stored name is `<32 hex>-<safe original name>` (SpaceFiles' hook). */
const fileRef = (f: {
  id: number
  url?: string | null
  filename?: string | null
  filesize?: number | null
}): SpaceFileRef => ({
  id: f.id,
  url: f.url ?? '',
  name: (f.filename ?? '').replace(/^[0-9a-f]{32}-/, ''),
  size: f.filesize ?? 0,
})

/**
 * One post with its whole thread (spec §4), read through the collections'
 * rules. Null when the post is not in this space or the reader cannot see
 * it, so the page renders "not found".
 */
export const postView = async (
  payload: Payload,
  user: null | User,
  space: Space,
  postId: number,
): Promise<PostView | null> => {
  const post = await payload
    .findByID({
      collection: 'space-posts',
      id: postId,
      user: user ?? undefined,
      depth: 1,
      overrideAccess: false,
    })
    .catch(() => null)
  if (!post || relId(post.space as never) !== space.id) return null

  const [{ archived }, { docs: comments }] = await Promise.all([
    archiveState(payload, space),
    payload.find({
      collection: 'space-comments',
      user: user ?? undefined,
      depth: 0,
      pagination: false,
      overrideAccess: false,
      sort: 'createdAt',
      where: { post: { equals: post.id } },
    }),
  ])
  const commentIds = comments.map((c) => c.id)
  const onTargets: Where = {
    or: [
      { post: { equals: post.id } },
      ...(commentIds.length ? [{ comment: { in: commentIds } }] : []),
    ],
  }
  const [{ docs: reactions }, { docs: files }] = await Promise.all([
    payload.find({
      collection: 'space-reactions',
      user: user ?? undefined,
      depth: 0,
      pagination: false,
      overrideAccess: false,
      select: { post: true, comment: true, account: true, reaction: true },
      where: onTargets,
    }),
    payload.find({
      collection: 'space-files',
      user: user ?? undefined,
      depth: 0,
      pagination: false,
      overrideAccess: false,
      sort: 'createdAt',
      where: onTargets,
    }),
  ])
  const onPost = tally(reactions, (r) => (r.comment == null ? relId(r.post) : null), user)
  const onComment = tally(reactions, (r) => relId(r.comment), user)
  const fileOf = new Map(
    files.filter((f) => f.comment != null).map((f) => [relId(f.comment as never)!, fileRef(f)]),
  )

  const node = (c: (typeof comments)[number]): ThreadComment => ({
    id: c.id,
    authorId: relId(c.author as never),
    body: c.deleted_at ? '' : c.body,
    createdAt: c.createdAt,
    edited: !!c.edited_at,
    deleted: !!c.deleted_at,
    file: c.deleted_at ? null : (fileOf.get(c.id) ?? null),
    reactions: onComment.get(c.id) ?? NO_REACTIONS,
  })
  const repliesOf = new Map<number, ThreadComment[]>()
  for (const c of comments) {
    const parent = relId(c.parent as never)
    if (parent != null) repliesOf.set(parent, [...(repliesOf.get(parent) ?? []), node(c)])
  }
  const thread = comments
    .filter((c) => c.parent == null)
    .map((c) => ({ ...node(c), replies: repliesOf.get(c.id) ?? [] }))

  const deleted = !!post.deleted_at
  return {
    row: {
      post: deleted ? { ...post, body: '' } : post,
      authorName: typeof post.author === 'object' && post.author ? post.author.name : null,
      authorId: relId(post.author as never),
      commentCount: comments.filter((c) => !c.deleted_at).length,
      latestComments: [],
      reactions: onPost.get(post.id) ?? NO_REACTIONS,
    },
    files: deleted ? [] : files.filter((f) => f.post != null).map(fileRef),
    comments: thread,
    deleted,
    archived,
  }
}

/**
 * The space a page opens: by kind and document slug (the space row carries
 * none of its own), gated by both the member's access rule and the switch —
 * the trial mode can still keep a space closed (spec §10). Null means the
 * space page renders "not found".
 */
export const spaceLanding = async (
  payload: Payload,
  user: null | User,
  kind: Space['kind'],
  slug: string,
): Promise<{ space: Space; course?: Course; programme?: Programme } | null> => {
  const settings = await spacesSettings(payload)
  if (mode(settings) === 'off') return null

  let space: Space | null = null
  let extra: { course?: Course; programme?: Programme } = {}
  if (kind === 'community') {
    const { docs } = await payload.find({
      collection: 'spaces',
      user: user ?? undefined,
      depth: 0,
      overrideAccess: false,
      where: { kind: { equals: 'community' } },
    })
    space = docs[0] ?? null
  } else {
    // The document holds the slug. One internal read for its id (draft
    // aware, published only), then the space read through the access rule.
    const { docs: rels } = await payload.find({
      collection: kind === 'course' ? 'courses' : 'programmes',
      depth: 0,
      draft: true,
      pagination: false,
      limit: 1,
      overrideAccess: true,
      where: { slug: { equals: slug }, _status: { equals: 'published' } },
    })
    const rel = rels[0] as Course | Programme | undefined
    const relIdValue = rel?.id
    if (relIdValue != null) {
      const { docs } = await payload.find({
        collection: 'spaces',
        user: user ?? undefined,
        depth: 0,
        overrideAccess: false,
        where:
          kind === 'course'
            ? { course: { equals: relIdValue } }
            : { programme: { equals: relIdValue } },
      })
      space = docs[0] ?? null
      if (space)
        extra = kind === 'course' ? { course: rel as Course } : { programme: rel as Programme }
    }
  }
  if (!space) return null
  // The read rule knew membership only; the switch is checked at the row so
  // flipping `mode`/trial scopes cannot leak an open space page.
  if (!spaceOpenOn(space, settings)) return null
  return { space, ...extra }
}

/** One moderator row of the participation summary (spec §13). */
export type ParticipationRow = {
  personId: number
  name: string
  posts: number
  comments: number
  reactions: number
  lastVisit: string | null
}

/**
 * The space's participation numbers (spec §13), one row per person. Read for
 * the moderator page only — the caller has already checked the role, so this
 * overrides access to count the space's activity. Small N: four parallel
 * reads, then one users read and one people read map accounts to names.
 */
export const participation = async (
  payload: Payload,
  space: number | { id: number },
): Promise<ParticipationRow[]> => {
  const spaceId = typeof space === 'object' ? space.id : space
  const [posts, comments, reactions, visits] = await Promise.all([
    payload.find({
      collection: 'space-posts',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { author: true },
      where: {
        and: [{ space: { equals: spaceId } }, { deleted_at: { exists: false } }],
      },
    }),
    payload.find({
      collection: 'space-comments',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { author: true },
      where: {
        and: [{ space: { equals: spaceId } }, { deleted_at: { exists: false } }],
      },
    }),
    payload.find({
      collection: 'space-reactions',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { account: true },
      where: { space: { equals: spaceId } },
    }),
    payload.find({
      collection: 'space-visits',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { account: true, last_visited_at: true },
      where: { space: { equals: spaceId } },
    }),
  ])

  // Reactions and visits name accounts; the summary names people.
  const { docs: accounts } = await payload.find({
    collection: 'users',
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const personOfAccount = new Map<number, number | null>()
  for (const a of accounts) personOfAccount.set(a.id, personOf(a))
  const accountPerson = (a: number | null | undefined) =>
    a != null ? (personOfAccount.get(a) ?? null) : null

  const postCount = new Map<number, number>()
  const commentCount = new Map<number, number>()
  const reactionCount = new Map<number, number>()
  const lastVisitOf = new Map<number, string>()
  const personIds = new Set<number>()
  const bump = (pid: number | null, count: Map<number, number>) => {
    if (pid == null) return
    personIds.add(pid)
    count.set(pid, (count.get(pid) ?? 0) + 1)
  }
  for (const p of posts.docs) bump(relId(p.author), postCount)
  for (const c of comments.docs) bump(relId(c.author), commentCount)
  for (const r of reactions.docs) bump(accountPerson(relId(r.account)), reactionCount)
  for (const v of visits.docs) {
    const pid = accountPerson(relId(v.account))
    if (pid != null) {
      personIds.add(pid)
      lastVisitOf.set(pid, v.last_visited_at)
    }
  }

  const names = new Map<number, string>()
  if (personIds.size) {
    const { docs: people } = await payload.find({
      collection: 'people',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      where: { id: { in: [...personIds] } },
    })
    for (const p of people) names.set(p.id, p.name)
  }
  return [...personIds]
    .map((personId) => ({
      personId,
      name: names.get(personId) ?? '',
      posts: postCount.get(personId) ?? 0,
      comments: commentCount.get(personId) ?? 0,
      reactions: reactionCount.get(personId) ?? 0,
      lastVisit: lastVisitOf.get(personId) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The member's own state in one space: the checklist marks, the consent stamp, the digest choice. */
export type MemberState = {
  steps: {
    saw_privacy: boolean
    introduced: boolean
    read_pinned: boolean
    checked_profile: boolean
    chose_digest: boolean
  } | null
  consented: boolean
  digest: 'daily' | 'weekly' | 'off' | null
  /** When the member last opened this space, before this visit stamps it; null on a first visit */
  lastVisitedAt: string | null
}

/**
 * The page's own three reads, rule-gated as the content reads are (the
 * collections' own-row rules are the gate). The steps live on this space's
 * visit row; consent and the digest are account-wide.
 */
export const memberState = async (
  payload: Payload,
  user: User,
  spaceId: number,
): Promise<MemberState> => {
  const [visits, consents, preferences] = await Promise.all([
    payload.find({
      collection: 'space-visits',
      user,
      depth: 0,
      pagination: false,
      limit: 1,
      overrideAccess: false,
      where: { and: [{ account: { equals: user.id } }, { space: { equals: spaceId } }] },
    }),
    payload.count({
      collection: 'space-consents',
      user,
      overrideAccess: false,
      where: { and: [{ account: { equals: user.id } }, { version: { equals: NOTICE_VERSION } }] },
    }),
    payload.find({
      collection: 'space-preferences',
      user,
      depth: 0,
      pagination: false,
      limit: 1,
      overrideAccess: false,
      where: { account: { equals: user.id } },
    }),
  ])
  const visit = visits.docs[0]
  const digest = (preferences.docs[0] as { digest?: 'daily' | 'weekly' | 'off' | null })?.digest
  return {
    steps: visit
      ? {
          saw_privacy: visit.saw_privacy ?? false,
          introduced: visit.introduced ?? false,
          read_pinned: visit.read_pinned ?? false,
          checked_profile: visit.checked_profile ?? false,
          chose_digest: visit.chose_digest ?? false,
        }
      : null,
    lastVisitedAt: visit?.last_visited_at ?? null,
    consented: consents.totalDocs > 0,
    digest: digest ?? null,
  }
}
