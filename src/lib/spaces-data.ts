import type { Payload, Where } from 'payload'

import { personOf } from '@/access'
import type { ReactionCounts, ReactionKind } from '@/lib/space-reactions'
import { archivedNow, courseLastMeeting, readOnly } from '@/lib/space-lifecycle'
import { NOTICE_VERSION } from '@/lib/space-consent'
import { spacePeople } from '@/lib/space-members'
import { isRsvpStatus, type RsvpStatus } from '@/lib/space-event'
import {
  mode,
  readableSpaceIds,
  spaceOpenOn,
  spacesSettings,
  type SpacesSettings,
} from '@/lib/spaces'
import { cairoInstant } from '@/lib/cairo-day'
import { expandSchedule } from '@/lib/schedule'
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
  /** Posts and comments by others since the member's last visit */
  unread: number
  lastActivity: string | null
  /** A course space past its 14 days (spec §11); always false for the other kinds */
  archived: boolean
  /** The cover image of the course or the programme; null for a community */
  cover: string | null
}

/** The cover of a community space, which has no course or programme to lend one. */
export const COMMUNITY_COVER = '/assets/images/pigeons-tower.jpg'

export const coverOf = (label: { cover_image?: unknown; cover?: unknown } | undefined) => {
  const media = label?.cover_image ?? label?.cover
  return media && typeof media === 'object'
    ? ((media as { url?: string | null }).url ?? null)
    : null
}

/** My spaces for one signed-in member: the community, their cohorts and courses. */
export const mySpaces = async (
  payload: Payload,
  user: null | User,
  locale: string,
): Promise<{
  communities: SpaceSummary[]
  cohorts: SpaceSummary[]
  courses: SpaceSummary[]
}> => {
  const settings = await spacesSettings(payload)
  if (mode(settings) === 'off') return { communities: [], cohorts: [], courses: [] }
  const ids = await readableSpaceIds(payload, user, settings)
  if (!ids || !user) return { communities: [], cohorts: [], courses: [] }

  // Spaces read internals of the membership layer (the ids are exactly
  // readableSpaceIds — the same override `factsFor` uses; the collection rule
  // would only re-filter that same set). Content below stays rule-gated.
  const { docs } = await payload.find({
    collection: 'spaces',
    depth: 0,
    pagination: false,
    overrideAccess: true,
    locale: locale === 'ar' ? 'ar' : 'en',
    sort: 'id',
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
  type Label = {
    id: number
    title: string
    slug: string
    schedule?: unknown
    sessions?: unknown
    cover_image?: number | { url?: string | null } | null
    cover?: number | { url?: string | null } | null
  }
  const labels = (collection: 'courses' | 'programmes', ready: number[]) =>
    ready.length
      ? (payload.find({
          collection,
          depth: 1,
          draft: true,
          pagination: false,
          overrideAccess: true,
          select:
            collection === 'courses'
              ? { title: true, slug: true, schedule: true, sessions: true, cover_image: true }
              : { title: true, slug: true, cover: true },
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
    select: { space: true, author: true, createdAt: true, last_activity_at: true },
    where: {
      and: [{ deleted_at: { exists: false } }, ...(ids === true ? [] : [{ space: { in: ids } }])],
    },
  })
  // Comments in the same pass: a reply under an old post still counts as news.
  const { docs: comments } = await payload.find({
    collection: 'space-comments',
    user,
    depth: 0,
    pagination: false,
    overrideAccess: false,
    select: { space: true, author: true, createdAt: true },
    where: {
      and: [{ deleted_at: { exists: false } }, ...(ids === true ? [] : [{ space: { in: ids } }])],
    },
  })
  const postsBySpace = new Map<number, typeof posts>()
  for (const p of posts) {
    const sid = relId(p.space)
    if (sid != null) postsBySpace.set(sid, [...(postsBySpace.get(sid) ?? []), p])
  }

  const commentsBySpace = new Map<number, typeof comments>()
  for (const c of comments) {
    const sid = relId(c.space)
    if (sid != null) commentsBySpace.set(sid, [...(commentsBySpace.get(sid) ?? []), c])
  }

  const person = personOf(user)
  const communities: SpaceSummary[] = []
  const cohorts: SpaceSummary[] = []
  const courses: SpaceSummary[] = []
  for (const s of docs) {
    const courseId = relId(s.course)
    // A course row deleted since its space was made leaves `course: null`.
    // Nobody reads that ghost (mirrors readableSpaceIds).
    if (s.kind === 'course' && courseId == null) continue
    const list = postsBySpace.get(s.id) ?? []
    const visited = visitedAt.get(s.id)
    const isNew = (x: { createdAt: string; author?: unknown }) =>
      (!visited || x.createdAt > visited) &&
      !(person !== null && relId(x.author as number | { id: number } | null) === person)
    const unread =
      list.filter(isNew).length + (commentsBySpace.get(s.id) ?? []).filter(isNew).length
    const lastActivity = list.reduce<string | null>((acc, p) => {
      const when = p.last_activity_at ?? p.createdAt
      return acc && acc > when ? acc : when
    }, null)
    const course = s.kind === 'course' ? courseOf.get(relId(s.course) ?? -1) : undefined
    const programme = s.kind === 'cohort' ? programmeOf.get(relId(s.programme) ?? -1) : undefined
    const summary: SpaceSummary = {
      space: s,
      title: course?.title ?? programme?.title ?? (s.name?.trim() || COMMUNITY_LABEL),
      href:
        s.kind === 'community'
          ? `/${locale}/spaces/community/${s.id}`
          : `/${locale}/spaces/${s.kind}/${course?.slug ?? programme?.slug ?? ''}`,
      unread,
      lastActivity,
      archived: archivedNow(s, course),
      cover: coverOf(course ?? programme),
    }
    if (s.kind === 'community') communities.push(summary)
    else if (s.kind === 'cohort') cohorts.push(summary)
    else courses.push(summary)
  }
  return { communities, cohorts, courses }
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

export type Voter = { personId: number; name: string; photo: string | null }

/**
 * A vote post's options with their counts. Of the voters, only the reader's own
 * choice is named, unless the vote is open: then each option lists who chose it.
 * An anonymous vote never carries a voter's identity, so none reaches the client.
 */
export type VoteView = {
  multiple: boolean
  anonymous: boolean
  options: { id: string; label: string; count: number; voters: Voter[] }[]
  /** Distinct accounts with at least one choice */
  voters: number
  /** The reader's chosen option ids */
  mine: string[]
}

/** The people behind some accounts, keyed by account id, as a voter list shows them. */
const voterCards = async (
  payload: Payload,
  accounts: (number | null)[],
  locale: 'en' | 'ar',
): Promise<Map<number, Voter>> => {
  const out = new Map<number, Voter>()
  const ids = [...new Set(accounts.filter((a): a is number => a != null))]
  if (!ids.length) return out
  const { docs: users } = await payload.find({
    collection: 'users',
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { person: true },
    where: { id: { in: ids } },
  })
  const personOfAccount = new Map(users.map((u) => [u.id, relId(u.person as never)]))
  const personIds = [
    ...new Set([...personOfAccount.values()].filter((p): p is number => p != null)),
  ]
  if (!personIds.length) return out
  const { docs: people } = await payload.find({
    collection: 'people',
    depth: 1,
    locale,
    pagination: false,
    overrideAccess: true,
    select: { name: true, photo: true },
    where: { id: { in: personIds } },
  })
  const byPerson = new Map(people.map((p) => [p.id, p]))
  for (const [account, personId] of personOfAccount) {
    const person = personId != null ? byPerson.get(personId) : undefined
    if (!person) continue
    const photo = person.photo
    out.set(account, {
      personId: person.id,
      name: person.name ?? '',
      photo: photo && typeof photo === 'object' && photo.url ? photo.url : null,
    })
  }
  return out
}

/** Every vote post's tally in one read; an anonymous vote's voters are never named. */
const voteViews = async (
  payload: Payload,
  user: null | User,
  posts: SpacePost[],
  locale: 'en' | 'ar',
): Promise<Map<number, VoteView>> => {
  const out = new Map<number, VoteView>()
  const polls = posts.filter((p) => p.kind === 'vote' && !p.deleted_at)
  if (!polls.length) return out
  // The posts came through the reader's access, so the tally may read every row
  // of them with the server's: the collection's own rule hides an anonymous
  // vote's rows from the API, and only counts and the reader's own choice leave here.
  const { docs } = await payload.find({
    collection: 'space-votes',
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { post: true, account: true, option: true },
    where: { post: { in: polls.map((p) => p.id) } },
  })
  const open = new Set(polls.filter((p) => !p.vote_anonymous).map((p) => p.id))
  const people = await voterCards(
    payload,
    docs.filter((v) => open.has(relId(v.post) ?? -1)).map((v) => relId(v.account)),
    locale,
  )
  for (const p of polls) {
    const rows = docs.filter((v) => relId(v.post) === p.id)
    const anonymous = !!p.vote_anonymous
    out.set(p.id, {
      multiple: !!p.vote_multiple,
      anonymous,
      options: (p.vote_options ?? []).flatMap((o) => {
        if (!o.id) return []
        const chosen = rows.filter((v) => v.option === o.id)
        const voters = anonymous
          ? []
          : chosen.flatMap((v) => {
              const voter = people.get(relId(v.account) ?? -1)
              return voter ? [voter] : []
            })
        return [{ id: o.id, label: o.label, count: chosen.length, voters }]
      }),
      voters: new Set(rows.map((v) => relId(v.account))).size,
      mine: user ? rows.filter((v) => relId(v.account) === user.id).map((v) => v.option) : [],
    })
  }
  return out
}

/** The answers to an event: how many gave each, who is going, and the reader's own. */
export type RsvpView = {
  counts: Record<RsvpStatus, number>
  going: Voter[]
  mine: RsvpStatus | null
}

const NO_COUNTS: Record<RsvpStatus, number> = { going: 0, maybe: 0, not_going: 0 }

/**
 * Every event post's answers in one read, through the reader's access: the
 * rows follow the space's readers, so a post's card shows no more than the
 * space would. Only the people going are named.
 */
const rsvpViews = async (
  payload: Payload,
  user: null | User,
  posts: SpacePost[],
  locale: 'en' | 'ar',
): Promise<Map<number, RsvpView>> => {
  const out = new Map<number, RsvpView>()
  const events = posts.filter((p) => p.kind === 'event' && !p.deleted_at)
  if (!events.length) return out
  const { docs } = await payload.find({
    collection: 'space-rsvps',
    user: user ?? undefined,
    depth: 0,
    pagination: false,
    overrideAccess: false,
    sort: 'createdAt',
    select: { post: true, account: true, status: true },
    where: { post: { in: events.map((p) => p.id) } },
  })
  const cards = await voterCards(
    payload,
    docs.filter((r) => r.status === 'going').map((r) => relId(r.account)),
    locale,
  )
  for (const p of events) {
    const rows = docs.filter((r) => relId(r.post) === p.id && isRsvpStatus(r.status))
    const counts = { ...NO_COUNTS }
    for (const r of rows) counts[r.status as RsvpStatus] += 1
    const mine = user ? rows.find((r) => relId(r.account) === user.id)?.status : undefined
    out.set(p.id, {
      counts,
      going: rows.flatMap((r) => {
        const card = r.status === 'going' ? cards.get(relId(r.account) ?? -1) : undefined
        return card ? [card] : []
      }),
      mine: mine && isRsvpStatus(mine) ? mine : null,
    })
  }
  return out
}

/** The parts of a course a session card reads: its sessions, their dates, and the text that sets its direction. */
export type SessionCourse = Pick<
  Course,
  'id' | 'slug' | 'title' | 'subtitle' | 'description' | 'sessions' | 'schedule' | 'session_unit'
>

/**
 * The course session a post points at, as the reader may see it: `shown`
 * with the live course (a cancelled session shows as cancelled), `gone` when
 * the course no longer has that session, `hidden` when the reader may not
 * read the course.
 */
export type SessionView =
  | { state: 'shown'; course: SessionCourse; session: string }
  | { state: 'gone' }
  | { state: 'hidden' }

/**
 * Every post's session in one read of the course, through the reader's
 * access: a post shows no more of the course than its page would.
 */
const sessionViews = async (
  payload: Payload,
  user: null | User,
  posts: SpacePost[],
  courseId: number | null,
  locale: 'en' | 'ar',
): Promise<Map<number, SessionView>> => {
  const out = new Map<number, SessionView>()
  const linked = posts.filter((p) => p.course_session && !p.deleted_at)
  if (!linked.length) return out
  const { docs } =
    courseId != null
      ? await payload.find({
          collection: 'courses',
          user: user ?? undefined,
          depth: 0,
          limit: 1,
          locale,
          overrideAccess: false,
          select: {
            slug: true,
            title: true,
            subtitle: true,
            description: true,
            sessions: true,
            schedule: true,
            session_unit: true,
          },
          where: { id: { equals: courseId } },
        })
      : { docs: [] }
  const course = docs[0] as SessionCourse | undefined
  // Unread, the course is either deleted or not the reader's to read; only
  // the server's count tells the two apart.
  const unread: SessionView =
    !course &&
    courseId != null &&
    (
      await payload.count({
        collection: 'courses',
        overrideAccess: true,
        where: { id: { equals: courseId } },
      })
    ).totalDocs > 0
      ? { state: 'hidden' }
      : { state: 'gone' }
  for (const p of linked) {
    const session = p.course_session!
    out.set(
      p.id,
      !course
        ? unread
        : (course.sessions ?? []).some((s) => s.id === session)
          ? { state: 'shown', course, session }
          : { state: 'gone' },
    )
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
  /** The whole thread, oldest first, so a member replies from the feed itself */
  comments: TopComment[]
  /** Files on the post itself, not on its comments */
  files: SpaceFileRef[]
  reactions: Reactions
  vote: VoteView | null
  /** An event post's answers */
  rsvp: RsvpView | null
  /** The course session the post points at, if any */
  session: SessionView | null
}

/**
 * One space's feed: pinned first, then last activity (spec §7), and the
 * course kind's archive state (spec §11) for read-only rendering.
 */
export const spaceFeed = async (
  payload: Payload,
  user: null | User,
  space: number | Space,
  locale: 'en' | 'ar' = 'en',
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
  const [threads, votes, rsvps, sessions, { docs: reactions }, { docs: postFiles }] =
    await Promise.all([
      postThreads(payload, user, postIds),
      voteViews(payload, user, docs, locale),
      rsvpViews(payload, user, docs, locale),
      sessionViews(payload, user, docs, row.kind === 'course' ? relId(row.course) : null, locale),
      postIds.length
        ? payload.find({
            collection: 'space-reactions',
            user: user ?? undefined,
            depth: 0,
            pagination: false,
            overrideAccess: false,
            select: { post: true, comment: true, account: true, reaction: true },
            where: { and: [{ post: { in: postIds } }, { comment: { exists: false } }] },
          })
        : Promise.resolve({ docs: [] }),
      postIds.length
        ? payload.find({
            collection: 'space-files',
            user: user ?? undefined,
            depth: 0,
            pagination: false,
            overrideAccess: false,
            sort: 'createdAt',
            where: { and: [{ post: { in: postIds } }, { comment: { exists: false } }] },
          })
        : Promise.resolve({ docs: [] }),
    ])
  const reactionsOf = tally(reactions, (r) => relId(r.post), user)
  const filesOf = new Map<number, SpaceFileRef[]>()
  for (const f of postFiles) {
    const pid = relId(f.post as never)
    if (pid != null) filesOf.set(pid, [...(filesOf.get(pid) ?? []), fileRef(f)])
  }

  const rows: FeedRow[] = docs.map((p) => ({
    post: p,
    authorName: typeof p.author === 'object' && p.author ? p.author.name : null,
    authorId: relId(p.author as never),
    commentCount: threads.get(p.id)?.count ?? 0,
    comments: threads.get(p.id)?.comments ?? [],
    files: filesOf.get(p.id) ?? [],
    reactions: reactionsOf.get(p.id) ?? NO_REACTIONS,
    vote: votes.get(p.id) ?? null,
    rsvp: rsvps.get(p.id) ?? null,
    session: sessions.get(p.id) ?? null,
  }))
  return { rows, settings, archived, lastMeeting, daysSince }
}

/** A private file on a post or comment (ADR 0008), served through Payload's read rule. */
export type SpaceFileRef = {
  id: number
  url: string
  name: string
  size: number
  mime: string
  isImage: boolean
  width: number | null
  height: number | null
}

/** One comment in a post's thread. A deleted comment with replies stays as a placeholder (spec §3). */
export type ThreadComment = {
  id: number
  authorId: number | null
  body: string
  createdAt: string
  edited: boolean
  deleted: boolean
  files: SpaceFileRef[]
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
  mimeType?: string | null
  width?: number | null
  height?: number | null
}): SpaceFileRef => ({
  id: f.id,
  url: f.url ?? '',
  name: (f.filename ?? '').replace(/^[0-9a-f]{32}-/, ''),
  size: f.filesize ?? 0,
  mime: f.mimeType ?? '',
  isImage: (f.mimeType ?? '').startsWith('image/'),
  width: f.width ?? null,
  height: f.height ?? null,
})

/**
 * The threads of several posts at once (spec §4), read through the
 * collections' rules: three reads however many posts. Replies sit one level
 * under their comment; a deleted comment stays as a placeholder (spec §3).
 */
export const postThreads = async (
  payload: Payload,
  user: null | User,
  postIds: number[],
): Promise<Map<number, { comments: TopComment[]; count: number }>> => {
  const out = new Map<number, { comments: TopComment[]; count: number }>()
  if (!postIds.length) return out
  const { docs: comments } = await payload.find({
    collection: 'space-comments',
    user: user ?? undefined,
    depth: 0,
    pagination: false,
    overrideAccess: false,
    sort: 'createdAt',
    where: { post: { in: postIds } },
  })
  const commentIds = comments.map((c) => c.id)
  const [{ docs: reactions }, { docs: files }] = commentIds.length
    ? await Promise.all([
        payload.find({
          collection: 'space-reactions',
          user: user ?? undefined,
          depth: 0,
          pagination: false,
          overrideAccess: false,
          select: { comment: true, account: true, reaction: true },
          where: { comment: { in: commentIds } },
        }),
        payload.find({
          collection: 'space-files',
          user: user ?? undefined,
          depth: 0,
          pagination: false,
          overrideAccess: false,
          sort: 'createdAt',
          where: { comment: { in: commentIds } },
        }),
      ])
    : [{ docs: [] }, { docs: [] }]
  const onComment = tally(reactions, (r) => relId(r.comment), user)
  const filesOf = new Map<number, SpaceFileRef[]>()
  for (const f of files) {
    const cid = relId(f.comment as never)
    if (cid != null) filesOf.set(cid, [...(filesOf.get(cid) ?? []), fileRef(f)])
  }

  const node = (c: (typeof comments)[number]): ThreadComment => ({
    id: c.id,
    authorId: relId(c.author as never),
    body: c.deleted_at ? '' : c.body,
    createdAt: c.createdAt,
    edited: !!c.edited_at,
    deleted: !!c.deleted_at,
    files: c.deleted_at ? [] : (filesOf.get(c.id) ?? []),
    reactions: onComment.get(c.id) ?? NO_REACTIONS,
  })
  const repliesOf = new Map<number, ThreadComment[]>()
  for (const c of comments) {
    const parent = relId(c.parent as never)
    if (parent != null) repliesOf.set(parent, [...(repliesOf.get(parent) ?? []), node(c)])
  }
  for (const c of comments) {
    const pid = relId(c.post)
    if (pid == null) continue
    const entry = out.get(pid) ?? { comments: [], count: 0 }
    if (!c.deleted_at) entry.count++
    // A deleted comment with no live replies leaves no trace in the thread.
    if (c.parent == null) {
      const replies = repliesOf.get(c.id) ?? []
      if (!c.deleted_at || replies.length) entry.comments.push({ ...node(c), replies })
    }
    out.set(pid, entry)
  }
  return out
}

/**
 * The space a post sits in, when the reader may read the post. Lets a dialog
 * open a post knowing only its id; null for a missing post or a stranger.
 */
export const postSpace = async (
  payload: Payload,
  user: null | User,
  postId: number,
): Promise<Space | null> => {
  const post = await payload
    .findByID({
      collection: 'space-posts',
      id: postId,
      user: user ?? undefined,
      depth: 0,
      overrideAccess: false,
      select: { space: true },
    })
    .catch(() => null)
  const spaceId = post ? relId(post.space as never) : null
  if (spaceId == null) return null
  return payload
    .findByID({
      collection: 'spaces',
      id: spaceId,
      user: user ?? undefined,
      depth: 0,
      overrideAccess: false,
    })
    .catch(() => null)
}

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
  locale: 'en' | 'ar' = 'en',
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

  const [{ archived }, threads, votes, rsvps, sessions, { docs: reactions }, { docs: files }] =
    await Promise.all([
      archiveState(payload, space),
      postThreads(payload, user, [post.id]),
      voteViews(payload, user, [post], locale),
      rsvpViews(payload, user, [post], locale),
      sessionViews(
        payload,
        user,
        [post],
        space.kind === 'course' ? relId(space.course) : null,
        locale,
      ),
      payload.find({
        collection: 'space-reactions',
        user: user ?? undefined,
        depth: 0,
        pagination: false,
        overrideAccess: false,
        select: { post: true, comment: true, account: true, reaction: true },
        where: { and: [{ post: { equals: post.id } }, { comment: { exists: false } }] },
      }),
      payload.find({
        collection: 'space-files',
        user: user ?? undefined,
        depth: 0,
        pagination: false,
        overrideAccess: false,
        sort: 'createdAt',
        where: { post: { equals: post.id } },
      }),
    ])
  const onPost = tally(reactions, (r) => relId(r.post), user)
  const thread = threads.get(post.id)

  const deleted = !!post.deleted_at
  return {
    row: {
      post: deleted ? { ...post, body: '' } : post,
      authorName: typeof post.author === 'object' && post.author ? post.author.name : null,
      authorId: relId(post.author as never),
      commentCount: thread?.count ?? 0,
      comments: thread?.comments ?? [],
      files: [],
      reactions: onPost.get(post.id) ?? NO_REACTIONS,
      vote: votes.get(post.id) ?? null,
      rsvp: rsvps.get(post.id) ?? null,
      session: sessions.get(post.id) ?? null,
    },
    files: deleted ? [] : files.filter((f) => f.comment == null).map(fileRef),
    comments: thread?.comments ?? [],
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
  locale: string = 'en',
): Promise<{ space: Space; course?: Course; programme?: Programme } | null> => {
  const settings = await spacesSettings(payload)
  if (mode(settings) === 'off') return null

  let space: Space | null = null
  let extra: { course?: Course; programme?: Programme } = {}
  if (kind === 'community') {
    // No slug: the first community space this reader may open (the old
    // address). A number: that one space.
    const { docs } = await payload.find({
      collection: 'spaces',
      user: user ?? undefined,
      depth: 0,
      limit: 1,
      locale: locale === 'ar' ? 'ar' : 'en',
      sort: 'id',
      overrideAccess: false,
      where: {
        and: [
          { kind: { equals: 'community' } },
          ...(slug ? [{ id: { equals: Number(slug) } }] : []),
        ],
      },
    })
    space = docs[0] ?? null
  } else {
    // The document holds the slug. One internal read for its id (draft
    // aware, published only), then the space read through the access rule.
    const { docs: rels } = await payload.find({
      collection: kind === 'course' ? 'courses' : 'programmes',
      // One level, so the cover arrives as a file and not as an id.
      depth: 1,
      draft: true,
      pagination: false,
      limit: 1,
      locale: locale === 'ar' ? 'ar' : 'en',
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

/** Posts and comments written in one week, Monday to Sunday in UTC. */
export type ParticipationWeek = { start: string; posts: number; comments: number }

export type Participation = { rows: ParticipationRow[]; weeks: ParticipationWeek[] }

const WEEKS = 12
const DAY = 86_400_000

/** The Monday, 00:00 UTC, of the week holding the date. */
const weekStart = (iso: string | Date): number => {
  const d = new Date(iso)
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return midnight - ((d.getUTCDay() + 6) % 7) * DAY
}

/**
 * The space's participation numbers (spec §13): one row per member, including
 * the ones who never came, plus anyone who wrote here and left; and the last
 * twelve weeks of posts and comments. Read for the moderator page only — the
 * caller has already checked the role, so this overrides access.
 */
export const participation = async (
  payload: Payload,
  space: number | { id: number },
  now: Date = new Date(),
): Promise<Participation> => {
  const spaceId = typeof space === 'object' ? space.id : space
  const live: Where = { and: [{ space: { equals: spaceId } }, { deleted_at: { exists: false } }] }
  const [members, posts, comments, reactions, visits, accounts] = await Promise.all([
    spacePeople(payload, spaceId),
    payload.find({
      collection: 'space-posts',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { author: true, createdAt: true },
      where: live,
    }),
    payload.find({
      collection: 'space-comments',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { author: true, createdAt: true },
      where: live,
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
    // Reactions and visits name accounts; the summary names people.
    payload.find({ collection: 'users', depth: 0, pagination: false, overrideAccess: true }),
  ])

  const personOfAccount = new Map<number, number | null>()
  for (const a of accounts.docs) personOfAccount.set(a.id, personOf(a))
  const accountPerson = (a: number | null | undefined) =>
    a != null ? (personOfAccount.get(a) ?? null) : null

  const rows = new Map<number, ParticipationRow>(
    members.map((m) => [
      m.id,
      { personId: m.id, name: m.name, posts: 0, comments: 0, reactions: 0, lastVisit: null },
    ]),
  )
  const row = (pid: number): ParticipationRow => {
    let r = rows.get(pid)
    if (!r) {
      r = { personId: pid, name: '', posts: 0, comments: 0, reactions: 0, lastVisit: null }
      rows.set(pid, r)
    }
    return r
  }
  for (const p of posts.docs) {
    const pid = relId(p.author)
    if (pid != null) row(pid).posts++
  }
  for (const c of comments.docs) {
    const pid = relId(c.author)
    if (pid != null) row(pid).comments++
  }
  for (const r of reactions.docs) {
    const pid = accountPerson(relId(r.account))
    if (pid != null) row(pid).reactions++
  }
  for (const v of visits.docs) {
    const pid = accountPerson(relId(v.account))
    if (pid != null) row(pid).lastVisit = v.last_visited_at
  }

  // People who wrote here but are no longer members still need a name.
  const unnamed = [...rows.values()].filter((r) => !r.name).map((r) => r.personId)
  if (unnamed.length) {
    const { docs: people } = await payload.find({
      collection: 'people',
      depth: 0,
      pagination: false,
      overrideAccess: true,
      where: { id: { in: unnamed } },
    })
    for (const p of people) row(p.id).name = p.name
  }

  const last = weekStart(now)
  const weeks: ParticipationWeek[] = Array.from({ length: WEEKS }, (_, i) => ({
    start: new Date(last - (WEEKS - 1 - i) * 7 * DAY).toISOString().slice(0, 10),
    posts: 0,
    comments: 0,
  }))
  const slot = (iso: string) => {
    const index = WEEKS - 1 - Math.round((last - weekStart(iso)) / (7 * DAY))
    return index >= 0 && index < WEEKS ? weeks[index] : undefined
  }
  for (const p of posts.docs) {
    const w = slot(p.createdAt)
    if (w) w.posts++
  }
  for (const c of comments.docs) {
    const w = slot(c.createdAt)
    if (w) w.comments++
  }

  return {
    rows: [...rows.values()].sort((a, b) => a.name.localeCompare(b.name)),
    weeks,
  }
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

/**
 * One row of a space's Events tab. A union so a second kind of row (the
 * public events) can join the list without changing the rows that exist.
 */
export type SpaceEventItem =
  | {
      type: 'post'
      post: SpacePost
      startsAt: string
      endsAt: string | null
      authorName: string | null
      rsvp: RsvpView
    }
  | {
      /** A public event of the space's course: no answers, nothing to change here */
      type: 'public'
      id: number
      title: string
      startsAt: string
      endsAt: string | null
      place: string | null
    }

/**
 * The course's public events as rows of the Events tab, in one read through
 * the reader's access. An event with several meetings shows at its next
 * meeting, or its last when they are all over.
 */
const courseEvents = async (
  payload: Payload,
  user: null | User,
  courseId: number,
  locale: 'en' | 'ar',
  now: Date,
): Promise<SpaceEventItem[]> => {
  const { docs } = await payload.find({
    collection: 'events',
    user: user ?? undefined,
    depth: 1,
    pagination: false,
    locale,
    overrideAccess: false,
    where: { and: [{ course: { equals: courseId } }, { tier: { equals: 'public' } }] },
  })
  return docs.flatMap((event): SpaceEventItem[] => {
    const meetings = expandSchedule(event.schedule).flatMap((m) => {
      const startsAt = cairoInstant(m.date, m.start_time)
      const endsAt = cairoInstant(m.date, m.end_time)
      return startsAt ? [{ startsAt, endsAt }] : []
    })
    const meeting =
      meetings.find((m) => new Date(m.endsAt ?? m.startsAt).getTime() >= now.getTime()) ??
      meetings.at(-1)
    if (!meeting) return []
    const place = typeof event.place === 'object' && event.place ? event.place.name : null
    return [
      {
        type: 'public',
        id: event.id,
        title: event.title,
        ...meeting,
        place: place ?? event.external_venue?.name?.trim() ?? null,
      },
    ]
  })
}

/**
 * Every event post of a space in one read through the reader's access, with
 * their answers in one more; a course space adds the course's public events
 * in a third. Upcoming events come first, soonest first, then the ones that
 * are over, newest first.
 */
export const spaceEvents = async (
  payload: Payload,
  user: null | User,
  space: number | Space,
  locale: 'en' | 'ar' = 'en',
  now: Date = new Date(),
): Promise<{ upcoming: SpaceEventItem[]; past: SpaceEventItem[] }> => {
  const { docs } = await payload.find({
    collection: 'space-posts',
    user: user ?? undefined,
    depth: 1,
    pagination: false,
    overrideAccess: false,
    where: {
      and: [
        { space: { equals: typeof space === 'object' ? space.id : space } },
        { kind: { equals: 'event' } },
        { deleted_at: { exists: false } },
      ],
    },
  })
  const courseId = typeof space === 'object' && space.kind === 'course' ? relId(space.course) : null
  const [rsvps, publicEvents] = await Promise.all([
    rsvpViews(payload, user, docs, locale),
    courseId != null ? courseEvents(payload, user, courseId, locale, now) : [],
  ])
  const items = docs.flatMap((post): SpaceEventItem[] =>
    post.event_starts_at
      ? [
          {
            type: 'post',
            post,
            startsAt: post.event_starts_at,
            endsAt: post.event_ends_at ?? null,
            authorName: typeof post.author === 'object' && post.author ? post.author.name : null,
            rsvp: rsvps.get(post.id) ?? { counts: { ...NO_COUNTS }, going: [], mine: null },
          },
        ]
      : [],
  )
  items.push(...publicEvents)
  const over = (item: SpaceEventItem) =>
    new Date(item.endsAt || item.startsAt).getTime() < now.getTime()
  const time = (item: SpaceEventItem) => new Date(item.startsAt).getTime()
  return {
    upcoming: items.filter((i) => !over(i)).sort((a, b) => time(a) - time(b)),
    past: items.filter(over).sort((a, b) => time(b) - time(a)),
  }
}

/** A course's place for the space rail: the cycle's place, read through the reader's access. */
export type CoursePlace = { name: string; address: string | null; mapUrl: string | null }

/**
 * The place an in-person course meets at, in one read. Nothing for a course
 * that is online only, one without a place, or a place the reader may not read.
 */
export const coursePlace = async (
  payload: Payload,
  user: null | User,
  course: Course,
  locale: 'en' | 'ar' = 'en',
): Promise<CoursePlace | null> => {
  const modes = course.location ?? []
  if (modes.length > 0 && !modes.includes('OFFLINE') && !modes.includes('HYBRID')) return null
  const cycle = typeof course.cycle === 'object' ? course.cycle : null
  const placeId = relId(cycle?.place as never)
  if (placeId == null) return null
  const place = await payload
    .findByID({
      collection: 'places',
      id: placeId,
      user: user ?? undefined,
      depth: 0,
      locale,
      overrideAccess: false,
    })
    .catch(() => null)
  if (!place) return null
  return {
    name: place.name,
    address: place.address?.trim() || null,
    mapUrl: place.map_url?.trim() || null,
  }
}
