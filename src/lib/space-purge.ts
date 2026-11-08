import type { Payload, Where } from 'payload'

/** Deleted content stays restorable this long (the privacy notice, spec §7). */
export const RETENTION_DAYS = 30

export type PurgeCounts = {
  comments: number
  posts: number
  files: number
  reactions: number
  votes: number
  rsvps: number
  notifications: number
}

const loops = 20

/**
 * Deletes rows in batches until none match, so a long backlog never holds one
 * huge statement. Counts only; nothing the rows held is read or logged.
 */
const sweep = async (
  payload: Payload,
  collection: 'space-files' | 'space-reactions' | 'space-votes' | 'space-rsvps',
  where: Where,
  batch: number,
): Promise<number> => {
  let removed = 0
  for (let i = 0; i < loops; i++) {
    const { docs } = await payload.find({
      collection,
      where,
      limit: batch,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    if (!docs.length) break
    // Files go one at a time so their storage objects are deleted with the row.
    for (const doc of docs) {
      await payload.delete({ collection, id: doc.id, overrideAccess: true })
      removed++
    }
  }
  return removed
}

const dependents = async (
  payload: Payload,
  field: 'post' | 'comment',
  id: number,
  batch: number,
  counts: PurgeCounts,
) => {
  const mine: Where = { [field]: { equals: id } }
  counts.files += await sweep(payload, 'space-files', mine, batch)
  counts.reactions += await sweep(payload, 'space-reactions', mine, batch)
  if (field === 'post') {
    counts.votes += await sweep(payload, 'space-votes', mine, batch)
    counts.rsvps += await sweep(payload, 'space-rsvps', mine, batch)
  }
}

/**
 * Permanently removes what was deleted more than RETENTION_DAYS ago (spec §7,
 * §10), and everything that hangs on it: files with their stored objects,
 * reactions, votes, answers, bell notifications about the post, and, through
 * the collections' own hooks, its private-search entries.
 *
 * A deleted comment or post that still has replies is a placeholder (its text
 * is already gone): its files, reactions and answers go, the row stays so the
 * live replies keep their place, and it is removed on a later run once the
 * replies are gone. Safe to run again at any time; runs whatever the Spaces
 * switch says.
 */
export const purgeDeleted = async (
  payload: Payload,
  now: Date = new Date(),
  { batch = 50 }: { batch?: number } = {},
): Promise<PurgeCounts> => {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const counts: PurgeCounts = {
    comments: 0,
    posts: 0,
    files: 0,
    reactions: 0,
    votes: 0,
    rsvps: 0,
    notifications: 0,
  }
  const db = payload.db.pool

  // Placeholders first: their files, reactions and answers go though the row stays.
  const old = (field: 'post' | 'comment'): Where => ({
    [`${field}.deleted_at`]: { less_than: cutoff },
  })
  const either: Where = { or: [old('post'), old('comment')] }
  counts.files += await sweep(payload, 'space-files', either, batch)
  counts.reactions += await sweep(payload, 'space-reactions', either, batch)
  counts.votes += await sweep(payload, 'space-votes', old('post'), batch)
  counts.rsvps += await sweep(payload, 'space-rsvps', old('post'), batch)

  // Comments with no reply left, leaves first (replies sit two deep at most).
  for (let round = 0; round < 3; round++) {
    const { rows } = await db.query<{ id: number }>(
      `SELECT c.id FROM space_comments c
       WHERE c.deleted_at < $1
         AND NOT EXISTS (SELECT 1 FROM space_comments r WHERE r.parent_id = c.id)
       ORDER BY c.deleted_at LIMIT $2`,
      [cutoff, batch],
    )
    if (!rows.length) break
    for (const { id } of rows) {
      await dependents(payload, 'comment', id, batch, counts)
      await payload.delete({ collection: 'space-comments', id, overrideAccess: true })
      counts.comments++
    }
  }

  // Posts with no comment left.
  const { rows: posts } = await db.query<{ id: number; cover: number | null }>(
    `SELECT p.id, p.event_cover_id AS cover FROM space_posts p
     WHERE p.deleted_at < $1
       AND NOT EXISTS (SELECT 1 FROM space_comments c WHERE c.post_id = p.id)
     ORDER BY p.deleted_at LIMIT $2`,
    [cutoff, batch],
  )
  for (const { id, cover } of posts) {
    await dependents(payload, 'post', id, batch, counts)
    await payload.delete({ collection: 'space-posts', id, overrideAccess: true })
    if (cover != null)
      await payload
        .delete({ collection: 'space-files', id: cover, overrideAccess: true })
        .then(() => counts.files++)
        .catch(() => {})
    // A bell row names the post only in its link, with or without a language prefix.
    const gone = await db.query(`DELETE FROM notifications WHERE link ~ $1`, [
      `^(/(en|ar))?/spaces/(community|course|cohort)/[^/]+/posts/${id}([?#].*)?$`,
    ])
    counts.notifications += gone.rowCount ?? 0
    counts.posts++
  }
  return counts
}
