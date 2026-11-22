import 'server-only'

import type { Payload } from 'payload'

import type { Locale } from '@/i18n/routing'
import { documentHref } from '@/lib/document-href'
import { keyedRows, waitingSet, type ReadCtx } from '@/lib/review-candidates'
import type { StatusKey } from '@/lib/review-status'
import { titleOf } from '@/lib/title-of'
import type { User } from '@/payload-types'

import type { ListCollection } from '../lists/groups'
import { baseWhere, listKindOf } from '../lists/rows'
import { KIND_OF_KEY, OWNER_SET_KEYS, VERB_OF, type NeedRow } from './sources'

/** The read of the reader's own 1b list, or null when they have none (no role, or no person). */
const ownCtx = (payload: Payload, user: User, collection: ListCollection): ReadCtx | null => {
  const kind = listKindOf(user, collection)
  if (kind === null || kind === 'admin') return null
  const base = baseWhere(user, collection, kind)
  return base === false ? null : { payload, user, collection, base }
}

/**
 * The documents of the reader's own 1b list that wait on them: that list's
 * Needs you group, read keys only. It reads `OWNER_SET_KEYS` and not every key
 * of the list: the others cannot give an owner-waiting key, and two of them have
 * no `KEY_WHERE` row, which would force the all-copies read on every request.
 */
export const ownSet = async (payload: Payload, user: User, collection: ListCollection) => {
  const ctx = ownCtx(payload, user, collection)
  return ctx
    ? waitingSet(ctx, { side: 'owner', keys: OWNER_SET_KEYS })
    : new Map<number, StatusKey>()
}

/**
 * One row per id of `set`, with the set's key and the time of its latest
 * version (`since`), which the caller orders by. It reads the titles only and
 * does not filter, so the rows and the count of one set are equal.
 */
export const ownRows = async (
  payload: Payload,
  user: User,
  collection: ListCollection,
  set: Map<number, StatusKey>,
  locale: Locale,
): Promise<Array<{ since: string; row: NeedRow }>> => {
  const ctx = ownCtx(payload, user, collection)
  if (!ctx || set.size === 0) return []
  const entries = await keyedRows(ctx, [...set.keys()], {
    select: { main: {}, version: {} },
    read: 'keys',
  })
  return [...set].map(([id, key]) => {
    const entry = entries.get(id)
    const source = entry ? (entry.latest ?? entry.main) : null
    const kind = KIND_OF_KEY[key]!
    return {
      since: source?.updatedAt ?? '',
      row: {
        kind,
        verbKey: VERB_OF[kind],
        href: documentHref({ collection, id, viewer: 'owner', waiting: false, locale }),
        label: source ? titleOf(source.title, locale) : null,
        count: 1,
        owners: [],
        collection,
      } satisfies NeedRow,
    }
  })
}
