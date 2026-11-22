import 'server-only'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { cache } from 'react'

import { isAdminUser } from '@/access'
import { countWaitingApplicants } from '@/forms/applicants'
import type { Locale } from '@/i18n/routing'
import { documentHref } from '@/lib/document-href'
import { adminQueue, adminReviewRows, type AdminSets } from '@/lib/review-queue'
import type { StatusKey } from '@/lib/review-status'
import { titleOf } from '@/lib/title-of'
import type { User } from '@/payload-types'

import { afterHeadStart } from './head-start'
import { ownRows, ownSet } from './owner-rows'
import {
  KIND_OF_KEY,
  SOURCES_OF,
  VERB_OF,
  type NeedRow,
  type NeedSource,
  type NeedsResult,
} from './sources'

/** The work of one reader: the ids that wait on them, each with its key. `failed` names a source that did not read. */
export type WorkSets = {
  reviewQueue?: AdminSets
  applicants?: number
  ownArticles?: Map<number, StatusKey>
  ownCourses?: Map<number, StatusKey>
  failed: NeedSource[]
}

const readSource = async (payload: Payload, user: User, source: NeedSource) => {
  switch (source) {
    case 'reviewQueue':
      if (!isAdminUser(user)) throw new Error('the review queue is for admins')
      return { reviewQueue: await adminQueue(payload) }
    case 'applicants':
      return { applicants: (await countWaitingApplicants(payload, user)).total }
    case 'ownArticles':
      return { ownArticles: await ownSet(payload, user, 'articles') }
    case 'ownCourses':
      return { ownCourses: await ownSet(payload, user, 'courses') }
  }
}

const fail = (payload: Payload, source: NeedSource, error: unknown) =>
  payload.logger.error({ err: error }, `needs: the ${source} source failed`)

/** Every source of the reader, read once. A source that fails is logged and left out; the others stay. */
export const workSetsOf = async (payload: Payload, user: User): Promise<WorkSets> => {
  const sources = SOURCES_OF(user)
  const settled = await Promise.allSettled(
    sources.map((source) => readSource(payload, user, source)),
  )
  const sets: WorkSets = { failed: [] }
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') Object.assign(sets, result.value)
    else {
      sets.failed.push(sources[index]!)
      fail(payload, sources[index]!, result.reason)
    }
  })
  return sets
}

export type NeedsCounts = { total: number | null; by: Partial<Record<NeedSource, number | null>> }

const sizeOf = (sets: WorkSets, source: NeedSource): number | null | undefined => {
  if (sets.failed.includes(source)) return null
  switch (source) {
    case 'reviewQueue':
      return sets.reviewQueue
        ? Object.values(sets.reviewQueue).reduce((sum, set) => sum + set.size, 0)
        : undefined
    case 'applicants':
      return sets.applicants
    case 'ownArticles':
      return sets.ownArticles?.size
    case 'ownCourses':
      return sets.ownCourses?.size
  }
}

/** The sizes of the sets. A failed source is `null`, and then so is the total: no number, never a wrong one. */
export const countsOf = (sets: WorkSets): NeedsCounts => {
  const by: NeedsCounts['by'] = {}
  for (const source of ['reviewQueue', 'applicants', 'ownArticles', 'ownCourses'] as const) {
    const size = sizeOf(sets, source)
    if (size !== undefined) by[source] = size
  }
  const sizes = Object.values(by)
  return {
    total: sizes.includes(null) ? null : sizes.reduce<number>((sum, n) => sum + (n ?? 0), 0),
    by,
  }
}

export { needsTotal, type NeedsResult } from './sources'

/**
 * One row per id of the sets, in the reader's locale. It reads only the display
 * fields, never a work set. The admin's review rows come first, oldest first,
 * then the applicants row; an owner's article and course rows are merged and
 * come oldest first, by their latest version.
 */
export const rowsOf = async (
  payload: Payload,
  user: User,
  sets: WorkSets,
  locale: Locale,
): Promise<NeedsResult> => {
  const failed = [...sets.failed]
  const part = async <Row>(source: NeedSource, read: () => Promise<Row[]>) => {
    try {
      return await read()
    } catch (error) {
      failed.push(source)
      fail(payload, source, error)
      return []
    }
  }
  const { reviewQueue, applicants, ownArticles, ownCourses } = sets
  const [review, articles, courses] = await Promise.all([
    reviewQueue && isAdminUser(user)
      ? part('reviewQueue', async () =>
          (await adminReviewRows(payload, reviewQueue, locale)).map((row): NeedRow => {
            const kind = KIND_OF_KEY[row.key]!
            return {
              kind,
              verbKey: VERB_OF[kind],
              href: documentHref({
                collection: row.collection,
                id: row.id,
                viewer: 'admin',
                waiting: true,
                locale,
              }),
              label: titleOf(row.title, locale),
              count: 1,
              owners: row.owners,
              collection: row.collection,
            }
          }),
        )
      : [],
    ownArticles
      ? part('ownArticles', () => ownRows(payload, user, 'articles', ownArticles, locale))
      : [],
    ownCourses
      ? part('ownCourses', () => ownRows(payload, user, 'courses', ownCourses, locale))
      : [],
  ])
  const applicantRows: NeedRow[] = applicants
    ? [
        {
          kind: 'applicants',
          verbKey: VERB_OF.applicants,
          href: '/admin/applicants',
          label: null,
          count: applicants,
          owners: [],
          collection: null,
        },
      ]
    : []
  const own = [...articles, ...courses]
    .sort((a, b) => a.since.localeCompare(b.since))
    .map(({ row }) => row)
  return { rows: [...review, ...applicantRows, ...own], failed }
}

const once = <Value>(store: Map<string, Value>, key: string, make: () => Value) => {
  if (!store.has(key)) store.set(key, make())
  return store.get(key)!
}

/**
 * The work sets of one account, read once per `store`. The key is the user's id,
 * never the `User` object: the layout and a page can each load the user and hold
 * two objects for one account.
 */
export const workIn = (store: Map<string, Promise<WorkSets>>, payload: Payload, user: User) =>
  once(store, String(user.id), () => afterHeadStart(() => workSetsOf(payload, user)))

/** React `cache` gives one `Map` per request. */
const requestStore = <Value>() => cache(() => new Map<string, Value>())
const workStore = requestStore<Promise<WorkSets>>()
const rowsStore = requestStore<Promise<NeedsResult>>()

/** One read of the work sets per request and account. The layout calls `needsCounts`, the pages `needs`, and both share this entry. */
export const workOf = async (user: User) => workIn(workStore(), await getPayload({ config }), user)

export const needsCounts = async (user: User) => countsOf(await workOf(user))

export const needs = async (user: User, locale: Locale) => {
  const payload = await getPayload({ config })
  return once(rowsStore(), `${user.id}:${locale}`, async () =>
    rowsOf(payload, user, await workIn(workStore(), payload, user), locale),
  )
}
