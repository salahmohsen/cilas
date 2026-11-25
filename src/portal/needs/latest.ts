import type { Payload } from 'payload'

import type { StoredNotification } from '@/lib/realtime/events'
import { isRoomHref } from '@/lib/space-ref'
import { spacesOff } from '@/lib/spaces'
import type { User } from '@/payload-types'

/** Rows one page of Latest holds, and the most pages **Show more** reaches (300 rows). */
export const LATEST_PAGE = 30
export const LATEST_MAX_PAGES = 10

/** The page count of a `?latest=` value: an integer from 1 to 10, else 1. */
export const latestPagesOf = (param: string | string[] | undefined): number => {
  const value = Array.isArray(param) ? param[0] : param
  const n = value === undefined || value.trim() === '' ? NaN : Number(value)
  return Number.isInteger(n) && n >= 1 && n <= LATEST_MAX_PAGES ? n : 1
}

export type LatestPage = {
  rows: StoredNotification[]
  pages: number
  /** `link`: more rows wait and **Show more** reaches them. `cap`: more wait past the 10 page cap. */
  more: 'link' | 'cap' | null
}

/**
 * The newest notification rows of the reader, newest first. A gated read: the
 * collection's read access is the recipient's own rows, so no other reader's row comes back.
 * With spaces off, a row that would open a space page keeps its text and loses its link.
 */
export const latestRows = async (payload: Payload, user: User, limit: number) => {
  const found = await payload.find({
    collection: 'notifications',
    where: { recipient: { equals: user.id } },
    sort: ['-createdAt', '-id'],
    limit,
    depth: 0,
    select: {
      kind: true,
      title: true,
      description: true,
      link: true,
      read_at: true,
      actor_name: true,
      actor_photo: true,
      createdAt: true,
    },
    user,
    overrideAccess: false,
  })
  const rows = found.docs as unknown as StoredNotification[]
  const off = await spacesOff(payload)
  return {
    rows: off
      ? rows.map((row) => (row.link && isRoomHref(row.link) ? { ...row, link: null } : row))
      : rows,
    hasNextPage: found.hasNextPage,
  }
}

export const latestPage = async (
  payload: Payload,
  user: User,
  pages: number,
): Promise<LatestPage> => {
  const { rows, hasNextPage } = await latestRows(payload, user, LATEST_PAGE * pages)
  return {
    rows,
    pages,
    more: hasNextPage ? (pages < LATEST_MAX_PAGES ? 'link' : 'cap') : null,
  }
}
