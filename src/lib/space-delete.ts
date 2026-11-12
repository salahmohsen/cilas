import type { Payload, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'

import { parentOf, parentRef, spaceHref } from '@/lib/space-ref'
import type { SpaceKind } from '@/lib/spaces'
import { escapeRegExp } from '@/lib/regexp'

/** What deleting a space takes with it, shown in the admin dialog before it runs. */
export type SpaceContentCounts = {
  posts: number
  comments: number
  files: number
  reactions: number
  votes: number
  rsvps: number
}

/** Course and cohort spaces belong to their course or programme (made by its publish hook). */
const BLOCKED: Record<Exclude<SpaceKind, 'community'>, string> = {
  course: 'This space belongs to a course. Delete the course instead.',
  cohort: 'This space belongs to a programme. Delete the programme instead.',
}

/** Set on `req.context` while a course or programme deletes its own space. */
const OWNER_DELETING = 'spaceOwnerDeleting'
const bellsKey = (id: number) => `spaceBells:${id}`

type SpaceRow = {
  id: number
  kind: SpaceKind
  course?: unknown
  programme?: unknown
}

/** Why this space may not be deleted on its own, or null when it may. */
export const spaceDeleteBlock = (space: SpaceRow): string | null =>
  space.kind === 'community' || parentRef(space as never) === null ? null : BLOCKED[space.kind]

const ofSpace = (id: number): Where => ({ space: { equals: id } })

export const countSpaceContent = async (
  payload: Payload,
  id: number,
  req?: Partial<PayloadRequest>,
): Promise<SpaceContentCounts> => {
  const count = (
    collection:
      | 'space-posts'
      | 'space-comments'
      | 'space-files'
      | 'space-reactions'
      | 'space-votes'
      | 'space-rsvps',
  ) =>
    payload
      .count({ collection, where: ofSpace(id), overrideAccess: true, req })
      .then((r) => r.totalDocs)
  const [posts, comments, files, reactions, votes, rsvps] = await Promise.all([
    count('space-posts'),
    count('space-comments'),
    count('space-files'),
    count('space-reactions'),
    count('space-votes'),
    count('space-rsvps'),
  ])
  return { posts, comments, files, reactions, votes, rsvps }
}

/**
 * The spaces collection's beforeDelete: removes everything that hangs on the
 * space so its row can go. Child rows hold `space_id NOT NULL` with
 * `ON DELETE set null`, so the database refuses a bare delete. Runs inside the
 * delete's transaction (`req`); files go one at a time so their storage
 * objects go with them, and the collections' own hooks clear private-search
 * entries. A course or cohort space is refused unless its course or programme
 * is the one deleting it (deleteOwnedSpaces).
 */
export const deleteSpaceContent = async (req: PayloadRequest, id: number): Promise<void> => {
  const { payload } = req
  const space = (await payload.findByID({
    collection: 'spaces',
    id,
    depth: 0,
    overrideAccess: true,
    req,
    select: { kind: true, course: true, programme: true },
  })) as SpaceRow
  const blocked = spaceDeleteBlock(space)
  if (blocked && !req.context[OWNER_DELETING]) throw new APIError(blocked, 400)

  // The bell links name the space by its URL; read it while the parent still exists.
  const parent = await parentOf(payload, space as never, { select: { slug: true } })
  req.context[bellsKey(id)] = spaceHref(space as never, parent)

  const where = ofSpace(id)
  const opts = { where, overrideAccess: true, req } as const
  await payload.delete({ collection: 'space-reactions', ...opts })
  await payload.delete({ collection: 'space-votes', ...opts })
  await payload.delete({ collection: 'space-rsvps', ...opts })
  await payload.delete({ collection: 'space-visits', ...opts })
  await payload.delete({ collection: 'space-files', ...opts })

  // Replies before the comments they answer (two levels deep at most).
  const { docs: comments } = await payload.find({
    collection: 'space-comments',
    where,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
    select: { parent: true },
  })
  const parentId = new Map<number, number | null>(
    comments.map((c) => [c.id, (typeof c.parent === 'object' ? c.parent?.id : c.parent) ?? null]),
  )
  const depth = (cid: number): number => {
    let d = 0
    for (let p = parentId.get(cid); p != null && d < 10; p = parentId.get(p)) d++
    return d
  }
  const ordered = [...parentId.keys()].sort((a, b) => depth(b) - depth(a))
  for (const cid of ordered)
    await payload.delete({ collection: 'space-comments', id: cid, overrideAccess: true, req })

  // The space's own introduction_post link clears itself (ON DELETE set null).
  await payload.delete({ collection: 'space-posts', ...opts })
}

/**
 * The spaces collection's afterDelete: bell rows name a space only in their
 * link, with or without a language prefix. Runs once the space row is gone,
 * so a refused delete keeps them.
 */
export const deleteSpaceBells = async (req: PayloadRequest, id: number): Promise<void> => {
  const href = req.context[bellsKey(id)]
  if (typeof href !== 'string') return
  await req.payload.db.pool.query(`DELETE FROM notifications WHERE link ~ $1`, [
    `^(/(en|ar))?${escapeRegExp(href)}([/?#].*)?$`,
  ])
}

/**
 * A course's or programme's beforeDelete: its space, and all the space holds,
 * goes with it. Without this the space stays behind with no parent.
 */
export const deleteOwnedSpaces =
  (field: 'course' | 'programme') =>
  async ({ id, req }: { id: number | string; req: PayloadRequest }): Promise<void> => {
    const { docs } = await req.payload.find({
      collection: 'spaces',
      where: { [field]: { equals: id } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      req,
      select: { kind: true },
    })
    if (!docs.length) return
    req.context[OWNER_DELETING] = true
    try {
      for (const space of docs)
        await req.payload.delete({ collection: 'spaces', id: space.id, overrideAccess: true, req })
    } finally {
      delete req.context[OWNER_DELETING]
    }
  }
