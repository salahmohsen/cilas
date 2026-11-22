import { relId } from '@/lib/relation'
import { ADMIN_LIST_KEYS, gate, keyedRows, waitingSet } from '@/lib/review-candidates'
import { ADMIN_VISIBLE, type StatusKey } from '@/lib/review-status'
import type { ReviewedCollection } from '@/lib/reviewed-fields'
import { REVIEWED } from '@/lib/reviewed-collections'
import type { Payload } from 'payload'

export type QueueKind = (typeof REVIEWED)[number]['kind']

export type QueueItem = {
  kind: QueueKind
  id: number
  /** Null when the document has no title yet. */
  title: string | null
  /** The owner asks to take the document off the site, not to publish a change. */
  removal: boolean
  by: string
  since: string
  href: string
}

/** What waits on an admin, per collection: each id with its key. One set, read keys only. */
export type AdminSets = Record<ReviewedCollection, Map<number, StatusKey>>

export type AdminReviewRow = {
  collection: ReviewedCollection
  kind: QueueKind
  id: number
  key: StatusKey
  title: { en: string | null; ar: string | null }
  owners: string[]
  since: string
}

const adminCtx = (payload: Payload, collection: ReviewedCollection) => ({
  payload,
  user: null,
  collection,
  base: ADMIN_VISIBLE,
})

/**
 * The documents that wait on an admin: the candidates the 1b admin list reads
 * (`ADMIN_LIST_KEYS`) under `ADMIN_VISIBLE`, whose key waits on the admin. The
 * admin list's Needs you group, minus an admin's own not-live rows. Read with
 * `overrideAccess: true` (Deviation 17): every caller checks the reader first.
 */
export const adminQueue = async (payload: Payload): Promise<AdminSets> => {
  const sets = await Promise.all(
    REVIEWED.map(({ collection }) =>
      waitingSet(adminCtx(payload, collection), { side: 'admin', keys: ADMIN_LIST_KEYS }),
    ),
  )
  return Object.fromEntries(REVIEWED.map(({ collection }, i) => [collection, sets[i]])) as AdminSets
}

/** The size of the admin queue: the dashboard's "Reviews waiting". */
export const countReviewQueue = async (payload: Payload) =>
  Object.values(await adminQueue(payload)).reduce((sum, set) => sum + set.size, 0)

const personIdsOf = (people: unknown) =>
  ((people ?? []) as Array<number | { id: number }>).flatMap((person) => {
    const id = relId(person)
    return typeof id === 'number' ? [id] : []
  })

/**
 * Exactly one row per id of `sets`, with the set's key. It reads only display
 * fields and does not filter: an id whose details read finds nothing still gets
 * a row, with no titles and no owners, so the count and the rows of one `sets`
 * value are equal. Title, owners and `since` come from one row, `latest ?? main`:
 * every key of the set waits on the admin, so the admin reviews the copy.
 * Oldest first.
 */
export const adminReviewRows = async (
  payload: Payload,
  sets: AdminSets,
  locale: 'en' | 'ar',
): Promise<AdminReviewRow[]> => {
  const rows = await Promise.all(
    REVIEWED.map(async ({ kind, collection, owners }) => {
      const set = sets[collection]
      if (set.size === 0) return []
      const ctx = adminCtx(payload, collection)
      const field = { [owners]: true } as const
      const entries = await keyedRows(ctx, [...set.keys()], {
        select: { main: field, version: field },
        read: 'keys',
      })
      const sourceOf = (id: number) => {
        const entry = entries.get(id)
        return entry ? (entry.latest ?? entry.main) : null
      }
      const personIds = [
        ...new Set([...set.keys()].flatMap((id) => personIdsOf(sourceOf(id)?.[owners]))),
      ]
      const names = new Map<number, string>()
      if (personIds.length) {
        const { docs } = await payload.find({
          collection: 'people',
          where: { id: { in: personIds } },
          select: { name: true },
          depth: 0,
          pagination: false,
          locale,
          ...gate(ctx),
        })
        for (const person of docs) if (person.name) names.set(person.id, person.name)
      }
      return [...set].map(([id, key]): AdminReviewRow => {
        const source = sourceOf(id)
        const title = (source?.title ?? {}) as { en?: string | null; ar?: string | null }
        return {
          collection,
          kind,
          id,
          key,
          title: { en: title.en || null, ar: title.ar || null },
          owners: personIdsOf(source?.[owners]).flatMap((person) => names.get(person) ?? []),
          since: source?.updatedAt ?? '',
        }
      })
    }),
  )
  return rows.flat().sort((a, b) => a.since.localeCompare(b.since))
}

/**
 * Content waiting for an admin, oldest first: articles, courses and
 * publications waiting for review. Applications have their own page
 * (Admin → Applicants). Read from the documents themselves, so it is right
 * even when an email never arrives.
 */
export const getReviewQueue = async (payload: Payload): Promise<QueueItem[]> => {
  const rows = await adminReviewRows(payload, await adminQueue(payload), 'en')
  return rows.map((row): QueueItem => ({
    kind: row.kind,
    id: row.id,
    title: row.title.en ?? row.title.ar,
    removal: row.key === 'published_removal',
    by: row.owners.join(', '),
    since: row.since,
    href: `/admin/collections/${row.collection}/${row.id}`,
  }))
}
