import 'server-only'

import type { Payload, Where } from 'payload'

import { adminViewOf, ownsViaAuthors, ownsViaFellows } from '@/access'
import type { CourseType } from '@/fields/course-type'
import type { Locale } from '@/i18n/routing'
import type { Season } from '@/lib/cycle'
import { mediaPopulate, mediaThumbnail } from '@/lib/media-image'
import { relId } from '@/lib/relation'
import {
  candidateIds,
  findCopies,
  findMain,
  gate,
  keyedRows,
  type Entry,
} from '@/lib/review-candidates'
import { ADMIN_VISIBLE, KEY_WHERE, LIVE_MAIN, waitsOn, type StatusKey } from '@/lib/review-status'
import { titleOf } from '@/lib/title-of'
import type { Media, User } from '@/payload-types'

import { heldCount } from './course-meta'
import {
  clampPage,
  GROUPS,
  groupOf,
  MAX_SEARCH_PARENTS,
  PAGE_SIZE,
  PAGED,
  searchTermOf,
  workKeys,
  type GroupId,
  type ListCollection,
  type ListKind,
  type PagedGroup,
} from './groups'

export type ListRow = {
  id: number
  collection: ListCollection
  key: StatusKey
  group: GroupId
  title: string | null
  cover: string | null
  updatedAt: string
  waitingSince: string | null
  owners: string[]
  tier: 'public' | 'community' | null
  course: {
    type: CourseType | null
    season: Season | null
    year: number | null
    held: number
    total: number
  } | null
}

export type ListGroup = { id: GroupId; rows: ListRow[]; total: number; hasMore: boolean }

export type ListResult = { groups: ListGroup[]; total: number }

export type ListQuery = {
  collection: ListCollection
  search: string | null
  only: GroupId | null
  pages: Partial<Record<PagedGroup, number>>
}

/** The kind of list an account gets, or null when it may open none. */
export const listKindOf = (user: User, collection: ListCollection): ListKind | null => {
  const view = adminViewOf(user)
  if (view === 'admin') return 'admin'
  if (view === 'fellow') return collection === 'articles' ? 'ownerArticles' : 'fellowCourses'
  if (view === 'student') return collection === 'articles' ? 'ownerArticles' : null
  return null
}

type Ctx = {
  payload: Payload
  user: User
  collection: ListCollection
  kind: ListKind
  base: Where
  locale: Locale
  spaces: ReadonlySet<number>
}

const ownershipOf = (collection: ListCollection) =>
  collection === 'articles' ? ownsViaAuthors : ownsViaFellows

/**
 * The rows the reader's list may hold. An owner list holds the reader's own
 * documents, never the public archive. An admin list holds what
 * `ADMIN_VISIBLE` names, and the admin's own rows.
 */
export const baseWhere = (
  user: User,
  collection: ListCollection,
  kind: ListKind,
): Where | false => {
  const owned = ownershipOf(collection)(user)
  if (kind !== 'admin') return owned
  return { or: [ADMIN_VISIBLE, ...(owned === false ? [] : [owned])] }
}

/** The fields a list row needs beyond its keys, and the full read: a list shows every key. */
const LIST_ROWS = {
  select: { main: { tier: true, cover_image: true }, version: { cover_image: true } },
  read: 'full',
} as const

/**
 * The row a list shows: the latest version where the row shows the owner's
 * newest writing, else the main row. The cover comes from the same row as the
 * title. On an admin list that is the latest version only where the row waits
 * on the admin: otherwise the admin sees what was approved or sent back.
 */
const sourceOf = ({ kind }: Ctx, { main, latest, key }: Entry) =>
  kind !== 'admin' || waitsOn(key) === 'admin' ? (latest ?? main) : main

const coverUrls = async (ctx: Ctx, ids: number[]) => {
  if (ids.length === 0) return new Map<number, string | null>()
  const { docs } = await ctx.payload.find({
    collection: 'media',
    where: { id: { in: ids } },
    select: { ...mediaPopulate, sizes: true },
    depth: 0,
    pagination: false,
    ...gate(ctx),
  })
  return new Map(docs.map((media) => [media.id, mediaThumbnail(media as Media) ?? null]))
}

type CourseMeta = NonNullable<ListRow['course']>
type Details = { owners: string[]; course: CourseMeta | null }

const namesOf = (people: unknown) =>
  ((people ?? []) as Array<{ name?: string | null } | number>).flatMap((person) =>
    typeof person === 'object' && person.name ? [person.name] : [],
  )

/**
 * What a row shows beyond its keys, in one gated read of the shown rows at
 * depth 1: an admin sees the owners' names, a course has its type and cycle,
 * and a course has its session counts from one more read, grouped by course.
 */
const detailsOf = async (ctx: Ctx, ids: number[]) => {
  const details = new Map<number, Details>()
  const isCourses = ctx.collection === 'courses'
  if (ids.length === 0 || (!isCourses && ctx.kind !== 'admin')) return details
  const [rows, sessions] = await Promise.all([
    findMain(ctx, {
      where: { and: [ctx.base, { id: { in: ids } }] },
      select: isCourses ? { course_type: true, cycle: true, fellows: true } : { authors: true },
      populate: { people: { name: true }, cycles: { season: true, start_year: true } },
      depth: 1,
    }),
    isCourses
      ? ctx.payload.find({
          collection: 'sessions',
          where: { course: { in: ids } },
          select: { course: true, meetings: true, cancelled: true },
          depth: 0,
          pagination: false,
          ...gate(ctx),
        })
      : null,
  ])
  const sessionsOf = new Map<number, NonNullable<typeof sessions>['docs']>()
  for (const session of sessions?.docs ?? []) {
    const course = relId(session.course) as number
    sessionsOf.set(course, [...(sessionsOf.get(course) ?? []), session])
  }
  const now = new Date()
  for (const doc of rows.docs) {
    const cycle = typeof doc.cycle === 'object' ? (doc.cycle as Record<string, never>) : null
    details.set(doc.id, {
      owners: ctx.kind === 'admin' ? namesOf(isCourses ? doc.fellows : doc.authors) : [],
      course: isCourses
        ? {
            type: (doc.course_type as CourseType | null | undefined) ?? null,
            season: (cycle?.season as Season | undefined) ?? null,
            year: (cycle?.start_year as number | undefined) ?? null,
            ...heldCount(sessionsOf.get(doc.id) ?? [], now),
          }
        : null,
    })
  }
  return details
}

type Shown = { entry: Entry; group: GroupId }

const buildRows = async (ctx: Ctx, shown: Shown[]): Promise<ListRow[]> => {
  const coverIds = shown.flatMap(({ entry }) => {
    const id = relId(sourceOf(ctx, entry).cover_image)
    return typeof id === 'number' ? [id] : []
  })
  const [covers, details] = await Promise.all([
    coverUrls(ctx, [...new Set(coverIds)]),
    detailsOf(
      ctx,
      shown.map(({ entry }) => entry.id),
    ),
  ])
  return shown.map(({ entry, group }) => {
    const { main, latest, key } = entry
    const source = sourceOf(ctx, entry)
    const cover = relId(source.cover_image)
    return {
      id: entry.id,
      collection: ctx.collection,
      key,
      group,
      title: titleOf(source.title, ctx.locale),
      cover: typeof cover === 'number' ? (covers.get(cover) ?? null) : null,
      updatedAt: PAGED.has(group) ? main.updatedAt : (latest ?? main).updatedAt,
      waitingSince: waitsOn(key) === 'admin' && latest ? latest.updatedAt : null,
      owners: details.get(entry.id)?.owners ?? [],
      tier: main.tier === 'public' || main.tier === 'community' ? main.tier : null,
      course: details.get(entry.id)?.course ?? null,
    }
  })
}

const titleLike = (term: string): Where[] => [
  { 'title.en': { like: term } },
  { 'title.ar': { like: term } },
]

type Search = { term: string; parents: number[] }

/**
 * A row matches when the title of its main row or of its latest version
 * matches, in either language: a row can show either title, and a draft that
 * was never published has its newest title in its versions only. The version
 * read is gated, so a reader finds only the versions they may read, and a
 * parent it names still has to pass the base `where` on its main row. `like`
 * keeps `%` and `_` as wildcards. They only widen a match over rows the
 * reader may read. `searchTermOf` caps the term, and the parents are the
 * newest `MAX_SEARCH_PARENTS`.
 */
const searchOf = async (ctx: Ctx, raw: string | null): Promise<Search | null> => {
  const term = searchTermOf(raw)
  if (!term) return null
  const { docs } = await findCopies(ctx, {
    where: {
      and: [
        { latest: { equals: true } },
        { or: [{ 'version.title.en': { like: term } }, { 'version.title.ar': { like: term } }] },
      ],
    },
    select: { parent: true },
    sort: '-updatedAt',
    limit: MAX_SEARCH_PARENTS,
  })
  return { term, parents: docs.map((version) => relId(version.parent) as number) }
}

const matchingWork = async (ctx: Ctx, search: Search, workIds: number[]) => {
  const { docs } = workIds.length
    ? await findMain(ctx, {
        where: { and: [ctx.base, { id: { in: workIds } }, { or: titleLike(search.term) }] },
        select: { id: true },
      })
    : { docs: [] }
  return new Set([...search.parents, ...docs.map((doc) => doc.id)])
}

const pagedTerm = (ctx: Ctx, group: PagedGroup): Where => {
  const spaces = [...ctx.spaces]
  if (group === 'published') return LIVE_MAIN
  if (group === 'teachingNow')
    return spaces.length ? { or: [LIVE_MAIN, { id: { in: spaces } }] } : LIVE_MAIN
  return spaces.length
    ? { and: [KEY_WHERE.rejected.where, { id: { not_in: spaces } }] }
    : KEY_WHERE.rejected.where
}

type PagedRead = { id: PagedGroup; shown: Shown[]; total: number; hasMore: boolean }

/**
 * The paged groups, `PAGE_SIZE` rows a page. Each leaves out every work row,
 * so a live document that waits on someone stays in its work group, and a
 * document sits in one group.
 */
const pagedGroups = async (
  ctx: Ctx,
  query: ListQuery,
  workIds: number[],
  search: Search | null,
): Promise<PagedRead[]> => {
  const reads: PagedRead[] = []
  for (const id of GROUPS[ctx.kind]) {
    if (!PAGED.has(id) || (query.only && query.only !== id)) continue
    const paged = id as PagedGroup
    const found = await findMain(ctx, {
      where: {
        and: [
          ctx.base,
          pagedTerm(ctx, paged),
          ...(workIds.length ? [{ id: { not_in: workIds } }] : []),
          ...(search
            ? [
                {
                  or: [
                    ...titleLike(search.term),
                    ...(search.parents.length ? [{ id: { in: search.parents } }] : []),
                  ],
                },
              ]
            : []),
        ],
      },
      select: { id: true },
      pagination: true,
      limit: PAGE_SIZE * clampPage(query.pages[paged]),
      page: 1,
      sort: ['-updatedAt', '-id'],
    })
    const entries = await keyedRows(
      ctx,
      found.docs.map((doc) => doc.id),
      LIST_ROWS,
    )
    const shown = found.docs.flatMap((doc): Shown[] => {
      const entry = entries.get(doc.id)
      return entry ? [{ entry, group: paged }] : []
    })
    reads.push({ id: paged, shown, total: found.totalDocs, hasMore: found.hasNextPage })
  }
  return reads
}

/**
 * The ids of every course that has a space the fellow may read. A fellow listed
 * on a course reads its space also when the course is not live. The list holds
 * only the fellow's own courses, so only the ids of those match a row. A fellow
 * who cannot read spaces (spaces mode off) gets none: `disableErrors` turns the
 * refusal into an empty answer, so the list still loads.
 */
const coursesWithSpace = async (ctx: Omit<Ctx, 'spaces'>) => {
  if (ctx.kind !== 'fellowCourses') return new Set<number>()
  const { docs } = await ctx.payload.find({
    collection: 'spaces',
    where: { course: { exists: true } },
    select: { course: true },
    depth: 0,
    pagination: false,
    disableErrors: true,
    ...gate(ctx),
  })
  return new Set(
    docs.flatMap((space) =>
      typeof relId(space.course) === 'number' ? [relId(space.course) as number] : [],
    ),
  )
}

const NOTHING: ListResult = { groups: [], total: 0 }

/**
 * The list of one reader, or nothing when the account may open no list of
 * this collection (`listKindOf`). Every read is gated. The ownership `where`
 * is in the base `where` of an owner list; a version read adds none, because
 * version access keeps an owner to the versions that name them. The work set
 * is rebuilt on every call: it is bounded by the rows the reader may read.
 */
export const loadList = async (
  payload: Payload,
  user: User,
  query: ListQuery,
  locale: Locale,
): Promise<ListResult> => {
  const kind = listKindOf(user, query.collection)
  if (!kind) return NOTHING
  const base = baseWhere(user, query.collection, kind)
  if (base === false) return NOTHING
  const bare = { payload, user, collection: query.collection, kind, base, locale }
  const ctx: Ctx = { ...bare, spaces: await coursesWithSpace(bare) }
  const [{ totalDocs: total }, candidates] = await Promise.all([
    payload.count({ collection: ctx.collection, where: base, ...gate(ctx) }),
    candidateIds(ctx, workKeys(ctx.kind)),
  ])
  const entries = await keyedRows(ctx, candidates, LIST_ROWS)
  const work = [...entries.values()]
    .map((entry): Shown => ({
      entry,
      group: groupOf(entry.key, ctx.kind, { hasSpace: ctx.spaces.has(entry.id) }),
    }))
    .filter(({ group }) => !PAGED.has(group))
    .sort((a, b) =>
      (b.entry.latest ?? b.entry.main).updatedAt.localeCompare(
        (a.entry.latest ?? a.entry.main).updatedAt,
      ),
    )
  const workIds = work.map(({ entry }) => entry.id)
  const search = await searchOf(ctx, query.search)
  const matches = search ? await matchingWork(ctx, search, workIds) : null
  const shownWork = work.filter(
    ({ entry, group }) =>
      (!matches || matches.has(entry.id)) && (!query.only || query.only === group),
  )
  const paged = await pagedGroups(ctx, query, workIds, search)
  const rows = await buildRows(ctx, [...shownWork, ...paged.flatMap(({ shown }) => shown)])
  const groups = GROUPS[ctx.kind].flatMap((id): ListGroup[] => {
    const inGroup = rows.filter((row) => row.group === id)
    if (inGroup.length === 0) return []
    const page = paged.find((read) => read.id === id)
    return [
      page
        ? { id, rows: inGroup, total: page.total, hasMore: page.hasMore }
        : { id, rows: inGroup, total: inGroup.length, hasMore: false },
    ]
  })
  return { groups, total }
}
