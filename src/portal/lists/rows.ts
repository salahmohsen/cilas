import type { Payload, Where } from 'payload'

import { adminViewOf, ownsViaAuthors, ownsViaFellows } from '@/access'
import type { CourseType } from '@/fields/course-type'
import type { Locale } from '@/i18n/routing'
import type { Season } from '@/lib/cycle'
import { mediaPopulate, mediaThumbnail } from '@/lib/media-image'
import { relId } from '@/lib/relation'
import {
  KEY_SELECT,
  KEY_WHERE,
  LIVE_COPY,
  statusInputOf,
  statusOf,
  statusSelect,
  waitsOn,
  type ReviewedDoc,
  type StatusKey,
} from '@/lib/review-status'
import type { Media, User } from '@/payload-types'

import { heldCount } from './course-meta'
import {
  GROUPS,
  groupOf,
  MAX_PAGES,
  PAGE_SIZE,
  PAGED,
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
  kind: ListKind
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

type Doc = ReviewedDoc
type Version = {
  parent: number | { id: number }
  version: { updatedAt: string } & Record<string, unknown>
}
type Found = { docs: Doc[]; totalDocs: number; hasNextPage: boolean }

type Ctx = {
  payload: Payload
  user: User
  collection: ListCollection
  kind: ListKind
  base: Where
  locale: Locale
  spaces: ReadonlySet<number>
}

type Entry = { id: number; main: Doc; latest: Doc | null; key: StatusKey }

const ownershipOf = (collection: ListCollection) =>
  collection === 'articles' ? ownsViaAuthors : ownsViaFellows

/**
 * The rows the reader's list may hold. An owner list holds the reader's own
 * documents, never the public archive. An admin list leaves out other people's
 * not-live rows at draft and approved.
 */
const baseWhere = (user: User, collection: ListCollection, kind: ListKind): Where | false => {
  const owned = ownershipOf(collection)(user)
  if (kind !== 'admin') return owned
  return {
    or: [
      { _status: { equals: 'published' } },
      { 'review.status': { in: ['submitted', 'changes_requested', 'rejected'] } },
      ...(owned === false ? [] : [owned]),
    ],
  }
}

const gate = ({ user }: { user: User }) => ({ user, overrideAccess: false }) as const

const findMain = (ctx: Ctx, args: Record<string, unknown>) =>
  ctx.payload.find({
    collection: ctx.collection,
    draft: false,
    depth: 0,
    pagination: false,
    ...args,
    ...gate(ctx),
  } as never) as unknown as Promise<Found>

const findCopies = (ctx: Ctx, args: Record<string, unknown>) =>
  ctx.payload.findVersions({
    collection: ctx.collection,
    depth: 0,
    pagination: false,
    ...args,
    ...gate(ctx),
  } as never) as unknown as Promise<{ docs: Version[] }>

const newestPerParent = (versions: Version[]) => {
  const latest = new Map<number, Doc>()
  for (const { parent, version } of versions) {
    const id = relId(parent) as number
    const seen = latest.get(id)
    if (!seen || version.updatedAt > seen.updatedAt) latest.set(id, { ...version, id } as Doc)
  }
  return latest
}

const readMains = async (ctx: Ctx, ids: number[], select: Record<string, unknown>) => {
  const { docs } = await findMain(ctx, {
    where: { and: [ctx.base, { id: { in: ids } }] },
    select,
    locale: 'all',
  })
  return new Map(docs.map((doc) => [doc.id, doc]))
}

const readLatest = async (ctx: Ctx, ids: number[], version: Record<string, unknown>) => {
  const { docs } = await findCopies(ctx, {
    where: { and: [{ parent: { in: ids } }, { latest: { equals: true } }] },
    select: { parent: true, version },
    locale: 'all',
  })
  return newestPerParent(docs)
}

/**
 * Reads the rows and their latest versions in two steps. Step one reads the
 * fields every row needs. Step two reads the reviewed fields, only for a live
 * row with a draft copy, because only those need a field compare.
 */
const readEntries = async (ctx: Ctx, ids: number[]) => {
  const entries = new Map<number, Entry>()
  if (ids.length === 0) return entries
  const mains = await readMains(ctx, ids, { ...KEY_SELECT, tier: true, cover_image: true })
  const latests = await readLatest(ctx, ids, { ...KEY_SELECT, cover_image: true })
  const keyed = ids.flatMap((id) => {
    const main = mains.get(id)
    return main ? [{ id, main, latest: latests.get(id) ?? null }] : []
  })
  const compare = keyed
    .filter(
      ({ main, latest }) =>
        statusInputOf({ collection: ctx.collection, main, latest, read: 'keys' }).draft !== null,
    )
    .map(({ id }) => id)
  const [fullMains, fullLatests] = compare.length
    ? await Promise.all([
        readMains(ctx, compare, statusSelect(ctx.collection)),
        readLatest(ctx, compare, statusSelect(ctx.collection)),
      ])
    : [new Map<number, Doc>(), new Map<number, Doc>()]
  for (const { id, main, latest } of keyed) {
    const full = compare.includes(id)
    const key = statusOf(
      full
        ? statusInputOf({
            collection: ctx.collection,
            main: fullMains.get(id)!,
            latest: fullLatests.get(id) ?? null,
            read: 'full',
          })
        : statusInputOf({ collection: ctx.collection, main, latest, read: 'keys' }),
    )
    entries.set(id, { id, main, latest, key })
  }
  return entries
}

/** The ids of every row that may hold work: the ones the `KEY_WHERE` rows find, and the live ones with a copy. */
const workCandidates = async (ctx: Ctx) => {
  const keys = workKeys(ctx.kind)
  const onMain = keys.flatMap((key) =>
    KEY_WHERE[key]?.on === 'main' ? [KEY_WHERE[key].where] : [],
  )
  const onCopy = keys.filter((key) => KEY_WHERE[key]?.on !== 'main').map((key) => KEY_WHERE[key])
  const copyWhere = onCopy.every((row) => row !== undefined)
    ? { or: onCopy.map((row) => row.where) }
    : LIVE_COPY
  const [mains, copies] = await Promise.all([
    findMain(ctx, { where: { and: [ctx.base, { or: onMain }] }, select: { id: true } }),
    findCopies(ctx, { where: copyWhere, select: { parent: true } }),
  ])
  return [
    ...new Set([
      ...mains.docs.map((doc) => doc.id),
      ...copies.docs.map((v) => relId(v.parent) as number),
    ]),
  ]
}

const titleOf = (value: unknown, locale: Locale) => {
  if (typeof value === 'string') return value || null
  const titles = (value ?? {}) as Record<string, string | null | undefined>
  return titles[locale] || titles[locale === 'en' ? 'ar' : 'en'] || null
}

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
 * and a course has its session counts from one more read.
 */
const detailsOf = async (ctx: Ctx, ids: number[]) => {
  const details = new Map<number, Details>()
  const isCourses = ctx.collection === 'courses'
  if (ids.length === 0 || (!isCourses && ctx.kind !== 'admin')) return details
  const [rows, sessions] = await Promise.all([
    ctx.payload.find({
      collection: ctx.collection,
      where: { and: [ctx.base, { id: { in: ids } }] },
      select: isCourses ? { course_type: true, cycle: true, fellows: true } : { authors: true },
      populate: { people: { name: true }, cycles: { season: true, start_year: true } },
      draft: false,
      depth: 1,
      pagination: false,
      ...gate(ctx),
    } as never) as unknown as Promise<{ docs: Array<Record<string, unknown> & { id: number }> }>,
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
            ...heldCount(
              (sessions?.docs ?? []).filter((session) => relId(session.course) === doc.id),
              now,
            ),
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

const pagedTerm = (ctx: Ctx, group: PagedGroup): Where => {
  const spaces = [...ctx.spaces]
  if (group === 'published') return { _status: { equals: 'published' } }
  if (group === 'teachingNow')
    return spaces.length
      ? { or: [{ _status: { equals: 'published' } }, { id: { in: spaces } }] }
      : { _status: { equals: 'published' } }
  return spaces.length
    ? { and: [KEY_WHERE.rejected!.where, { id: { not_in: spaces } }] }
    : KEY_WHERE.rejected!.where
}

/**
 * The paged groups, `PAGE_SIZE` rows a page. Each leaves out every work row,
 * so a live document that waits on someone stays in its work group, and a
 * document sits in one group.
 */
const pagedGroups = async (ctx: Ctx, query: ListQuery, workIds: number[]) => {
  const groups: ListGroup[] = []
  for (const id of GROUPS[ctx.kind]) {
    if (!PAGED.has(id) || (query.only && query.only !== id)) continue
    const pages = Math.min(query.pages[id as PagedGroup] ?? 1, MAX_PAGES)
    const found = await findMain(ctx, {
      where: {
        and: [
          ctx.base,
          pagedTerm(ctx, id as PagedGroup),
          ...(workIds.length ? [{ id: { not_in: workIds } }] : []),
        ],
      },
      select: { id: true },
      pagination: true,
      limit: PAGE_SIZE * pages,
      page: 1,
      sort: ['-updatedAt', '-id'],
    })
    const entries = await readEntries(
      ctx,
      found.docs.map((doc) => doc.id),
    )
    const shown = found.docs.flatMap((doc): Shown[] => {
      const entry = entries.get(doc.id)
      return entry ? [{ entry, group: id }] : []
    })
    groups.push({
      id,
      rows: await buildRows(ctx, shown),
      total: found.totalDocs,
      hasMore: found.hasNextPage,
    })
  }
  return groups
}

/**
 * The courses of a fellow's list that have a space. A fellow listed on a course
 * reads its space also when the course is not live. A fellow who cannot read
 * spaces (spaces mode off) gets none: `disableErrors` turns the refusal into
 * an empty answer, so the list still loads.
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

/**
 * The list of one reader. Every read is gated. The ownership `where` is in the
 * base `where` of an owner list; a version read adds none, because version
 * access keeps an owner to the versions that name them.
 */
export const loadList = async (
  payload: Payload,
  user: User,
  query: ListQuery,
  locale: Locale,
): Promise<ListResult> => {
  const base = baseWhere(user, query.collection, query.kind)
  if (base === false) return { groups: [], total: 0 }
  const bare = { payload, user, collection: query.collection, kind: query.kind, base, locale }
  const ctx: Ctx = { ...bare, spaces: await coursesWithSpace(bare) }
  const [{ totalDocs: total }, candidates] = await Promise.all([
    payload.count({ collection: ctx.collection, where: base, ...gate(ctx) }),
    workCandidates(ctx),
  ])
  const entries = await readEntries(ctx, candidates)
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
  const worked = await buildRows(ctx, work)
  const paged = await pagedGroups(
    ctx,
    query,
    work.map(({ entry }) => entry.id),
  )
  const groups = GROUPS[ctx.kind].flatMap((id): ListGroup[] => {
    const inGroup = worked.filter((row) => row.group === id)
    const group = inGroup.length
      ? { id, rows: inGroup, total: inGroup.length, hasMore: false }
      : paged.find((candidate) => candidate.id === id)
    return group && group.rows.length && (!query.only || query.only === id) ? [group] : []
  })
  return { groups, total }
}
