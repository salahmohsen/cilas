import type { Payload } from 'payload'

import { personOf } from '@/access'
import { archivedNow } from '@/lib/space-lifecycle'
import { mentionSafelist, spacePeople, type PersonLink } from '@/lib/space-members'
import { spacesSettings, mode, spaceOpenOn, membership, mayComment } from '@/lib/spaces'
import { FILE_KINDS } from '@/lib/form-files'
import { EVENT_LOCATION_MAX, VOTE_OPTIONS } from '@/lib/space-post-kinds'
import { SPACE_FILE_LIMIT } from '@/collections/SpaceFiles'
import type { EventPosting, SpaceLike, PostingLevel } from '@/lib/spaces'
import type { User } from '@/payload-types'

export type WriteError =
  | 'mode'
  | 'not-member'
  | 'read-only'
  | 'posting-level'
  | 'announcement'
  | 'locked'
  | 'depth'
  | 'mention'
  | 'consent'
  | 'not-yours'
  | 'file-count'
  | 'file-size'
  | 'file-type'
  | 'duplicate'
  | 'space'
  | 'not-found'
  | 'events'
  | 'event'
  | 'vote'

export type WriteResult<T> =
  | { ok: true; data: T; notify?: (() => Promise<void>) | null }
  | { ok: false; error: WriteError; data?: { field?: string } }

export type PostFile = { data: Buffer; mimetype: string; name: string; size: number }

export type StepKey =
  'saw_privacy' | 'introduced' | 'read_pinned' | 'checked_profile' | 'chose_digest'

export const STEP_KEYS: readonly StepKey[] = [
  'saw_privacy',
  'introduced',
  'read_pinned',
  'checked_profile',
  'chose_digest',
]

/** Spec §6: 5 files per post, 1 per comment. */
const FILE_LIMITS = { post: 5, comment: 1 } as const

/** What a tombstoned row keeps in its required body field. */
const TOMBSTONE_BODY = ' '

type Input<T> = { payload: Payload; user: NonNullable<User> } & T

// --- Pure decision layer ---

export const postingAllows = (postingLevel: string, role: string, kind: string): boolean => {
  const isModerator = role === 'moderator'
  if (kind === 'announcement') return isModerator
  if (postingLevel === 'members_post' || postingLevel === 'open') return true
  if (postingLevel === 'members_comment' || postingLevel === 'fellows_only') return isModerator
  return false
}

export const validateMentions = (
  body: string,
  memberIds: Set<number>,
): { mentioned: number[]; invalid: string[] } => {
  const mentioned: number[] = []
  const invalid: string[] = []
  const regex = /\[@[^\]]*\]\(\/people\/([^)]+)\)/g
  let match
  while ((match = regex.exec(body)) !== null) {
    const idStr = match[1]
    const id = Number(idStr)
    const path = `/people/${idStr}`
    if (!Number.isNaN(id) && memberIds.has(id)) {
      if (!mentioned.includes(id)) mentioned.push(id)
    } else {
      invalid.push(path)
    }
  }
  return { mentioned, invalid }
}

// --- Helpers ---

const idOf = (v: number | { id: number } | null | undefined): number | null =>
  v == null ? null : typeof v === 'object' ? v.id : v

const err = <E extends WriteError>(error: E): WriteResult<never> => ({ ok: false, error })

const gate = async (
  payload: Payload,
  user: NonNullable<User>,
  spaceId: number,
  opts: { write?: boolean } = {},
) => {
  const settings = await spacesSettings(payload)
  if (mode(settings) === 'off')
    return { stop: true as const, error: 'mode' as WriteError, space: null }
  const space = (await payload.findByID({
    collection: 'spaces',
    id: spaceId,
    depth: 0,
    overrideAccess: true,
  })) as SpaceLike | null
  if (!space) return { stop: true as const, error: 'space' as WriteError, space: null }
  if (!spaceOpenOn(space, settings))
    return { stop: true as const, error: 'mode' as WriteError, space: space as SpaceLike }
  if (opts.write && space.kind === 'course') {
    const courseId = idOf(space.course)
    const course =
      courseId === null
        ? null
        : ((await payload
            .findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true })
            .catch(() => null)) as { schedule?: unknown; sessions?: unknown } | null)
    if (archivedNow(space, course))
      return { stop: true as const, error: 'read-only' as WriteError, space: space as SpaceLike }
  }
  return { stop: false as const, space: space as SpaceLike, settings }
}

const consentOf = async (payload: Payload, user: NonNullable<User>): Promise<boolean> => {
  const { NOTICE_VERSION } = await import('@/lib/space-consent')
  return (
    (
      await payload.count({
        collection: 'space-consents',
        where: { and: [{ account: { equals: user.id } }, { version: { equals: NOTICE_VERSION } }] },
        overrideAccess: true,
      })
    ).totalDocs > 0
  )
}

/** Type, size and count checks for files joining a post or comment that already holds `existing`. */
const fileError = (files: PostFile[], existing: number, limit: number): WriteError | null => {
  for (const f of files) {
    const kindEntry = Object.values(FILE_KINDS as Record<string, { mime: readonly string[] }>).find(
      (k) => (k.mime as readonly string[]).includes(f.mimetype),
    )
    if (!kindEntry) return 'file-type'
    if (f.size > SPACE_FILE_LIMIT) return 'file-size'
  }
  return existing + files.length > limit ? 'file-count' : null
}

const storeFile = async (
  payload: Payload,
  spaceId: number,
  target: { post: number } | { comment: number },
  file: PostFile,
): Promise<number> => {
  const created = await payload.create({
    collection: 'space-files',
    data: {
      space: spaceId,
      post: 'post' in target ? target.post : null,
      comment: 'comment' in target ? target.comment : null,
      filename: file.name,
    } as never,
    file: { data: file.data, mimetype: file.mimetype, name: file.name, size: file.size } as never,
    overrideAccess: true,
  })
  return (created as { id: number }).id
}

/** Stores every file on a just-created row; a storage failure removes the row and its files. */
const storeFilesOrRollback = async (
  payload: Payload,
  spaceId: number,
  collection: 'space-posts' | 'space-comments',
  rowId: number,
  files: PostFile[],
) => {
  const target = collection === 'space-posts' ? { post: rowId } : { comment: rowId }
  const stored: number[] = []
  try {
    for (const f of files) stored.push(await storeFile(payload, spaceId, target, f))
  } catch (e) {
    for (const id of stored)
      await payload
        .delete({ collection: 'space-files', id, overrideAccess: true })
        .catch(() => undefined)
    await payload.delete({ collection, id: rowId, overrideAccess: true }).catch(() => undefined)
    throw e
  }
}

const spaceLink = (locale: string, space: SpaceLike, postId: number): string => {
  if (space.kind === 'community') return `/${locale}/spaces/community/posts/${postId}`
  const slug = space.kind === 'course' ? idOf(space.course) : idOf(space.programme)
  return `/${locale}/spaces/${space.kind}/${slug}/posts/${postId}`
}

/** The space's display name, quoted, for notification detail text. */
const spaceNameOf = async (payload: Payload, space: SpaceLike): Promise<string> => {
  if (space.kind === 'community') return '“the community space”'
  const slug = space.kind === 'course' ? idOf(space.course) : idOf(space.programme)
  if (slug === null) return '“the space”'
  const doc = (await payload
    .findByID({
      collection: space.kind === 'course' ? 'courses' : 'programmes',
      id: slug,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)) as { title?: string } | null
  return doc?.title ? `“${doc.title}”` : '“the space”'
}

// --- postCreate ---

/** What an event or a vote adds to a post; the other kinds add nothing. */
export type PostShape =
  | { kind: 'discussion' | 'announcement' }
  | { kind: 'event'; event: { location: string; startsAt: string } }
  | { kind: 'vote'; vote: { options: string[]; multiple: boolean } }

/**
 * The extra columns an event or a vote stores, or null when they break a
 * rule: an event needs a place and a start that has not passed; a vote needs
 * two to ten distinct options.
 */
export const shapeData = (shape: PostShape, now = new Date()): Record<string, unknown> | null => {
  switch (shape.kind) {
    case 'discussion':
    case 'announcement':
      return {}
    case 'event': {
      const location = shape.event.location.trim()
      const starts = new Date(shape.event.startsAt)
      if (!location || location.length > EVENT_LOCATION_MAX) return null
      if (Number.isNaN(starts.getTime()) || starts.getTime() < now.getTime()) return null
      return { event_location: location, event_starts_at: starts.toISOString() }
    }
    case 'vote': {
      const options = shape.vote.options.map((o) => o.trim()).filter(Boolean)
      const distinct = new Set(options.map((o) => o.toLocaleLowerCase()))
      if (distinct.size !== options.length) return null
      if (options.length < VOTE_OPTIONS.min || options.length > VOTE_OPTIONS.max) return null
      if (options.some((o) => o.length > VOTE_OPTIONS.length)) return null
      return {
        vote_options: options.map((label) => ({ label })),
        vote_multiple: shape.vote.multiple,
      }
    }
  }
}

/** Whether this member may start an event in this space (on top of the posting level). */
export const eventsAllow = (events: EventPosting | null | undefined, role: string): boolean =>
  (events ?? 'members') === 'members' || role === 'moderator'

export const postCreate = async (
  i: Input<
    {
      space: number
      body: string
      files?: PostFile[]
    } & PostShape
  >,
): Promise<WriteResult<{ id: number }>> => {
  const { payload, user, space: spaceId, kind, body, files } = i
  const g = await gate(payload, user, spaceId, { write: true })
  if (g.stop) return err(g.error)
  const space = g.space
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') return err('not-member')
  // Announcements are the moderator's voice; distinguish the refusal from
  // the posting level's (spec §3) so the UI can say which door is closed.
  if (kind === 'announcement' && mem.role !== 'moderator') return err('announcement')
  if (!postingAllows(space.posting ?? 'open', mem.role, kind)) return err('posting-level')
  if (kind === 'event' && !eventsAllow((space as { events?: EventPosting }).events, mem.role))
    return err('events')
  const extra = shapeData(i)
  if (!extra) return err(kind === 'vote' ? 'vote' : 'event')

  const mentioned = validateMentions(body, await mentionSafelist(payload, spaceId))
  if (mentioned.invalid.length > 0) return err('mention')

  if (!(await consentOf(payload, user))) return err('consent')

  const fileIssue = files?.length ? fileError(files, 0, FILE_LIMITS.post) : null
  if (fileIssue) return err(fileIssue)

  const personId = personOf(user)
  const post = await payload.create({
    collection: 'space-posts',
    // pinned belongs to the data: the collection hook's data mutation does
    // not reach the row through the Local API (H8), so the action sets it.
    data: {
      space: spaceId,
      author: personId,
      kind,
      body,
      ...extra,
      last_activity_at: new Date().toISOString(),
      ...(kind === 'announcement' ? { pinned: true } : {}),
    } as never,
    overrideAccess: true,
  })
  const postId = (post as { id: number }).id
  if (files?.length) await storeFilesOrRollback(payload, spaceId, 'space-posts', postId, files)

  const notifyFn = async () => {
    const { actorOf, notify } = await import('@/lib/notify')
    const actor = await actorOf(payload, personOf(user))
    const context = await spaceNameOf(payload, space)
    if (kind === 'announcement') {
      const people = await spacePeople(payload, spaceId)
      const accountIds = people.map((p) => p.accountId).filter((id): id is number => id !== null)
      await notify(payload, accountIds, {
        kind: 'announcement',
        description: `A new announcement in ${context}`,
        link: spaceLink('en', space, postId),
        actor,
      })
    }
    const mentionedIds = mentioned.mentioned
    if (mentionedIds.length > 0) {
      const { docs: users } = await payload.find({
        collection: 'users',
        depth: 0,
        overrideAccess: true,
        pagination: false,
        limit: 10000,
      })
      const accountIds = users
        .filter(
          (u) => mentionedIds.includes(personOf(u) ?? -1) && (u as { id: number }).id !== user.id,
        )
        .map((u) => (u as { id: number }).id)
      await notify(payload, accountIds, {
        kind: 'mention',
        description: `${actor?.name ?? 'Someone'} mentioned you in ${context}`,
        link: spaceLink('en', space, postId),
        actor,
      })
    }
  }

  return { ok: true, data: { id: postId }, notify: notifyFn }
}

// --- postEdit ---

export const postEdit = async (
  i: Input<{ id: number; body: string }>,
): Promise<WriteResult<true>> => {
  const { payload, user, id, body } = i
  const post = (await payload.findByID({
    collection: 'space-posts',
    id,
    depth: 0,
    overrideAccess: true,
  })) as {
    space: number | { id: number }
    author: number | { id: number } | null
    deleted_at?: string | null
    locked?: boolean
  } | null
  if (!post) return err('not-found')
  const spaceId = typeof post.space === 'object' ? post.space.id : post.space
  const g = await gate(payload, user, spaceId, { write: true })
  if (g.stop) return err((g as { error: WriteError }).error)
  const space = g.space
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') return err('not-member')
  if (post.deleted_at) return err('not-found')
  if (post.locked) return err('locked')
  const isAuthor =
    post.author !== null &&
    (typeof post.author === 'object' ? post.author.id : post.author) === personOf(user)
  const fullSpace = (await payload.findByID({
    collection: 'spaces',
    id: spaceId,
    depth: 0,
    overrideAccess: true,
  })) as { introduction_post?: number | { id: number } | null }
  const isIntro =
    fullSpace.introduction_post != null &&
    (typeof fullSpace.introduction_post === 'object'
      ? fullSpace.introduction_post.id
      : fullSpace.introduction_post) === id
  const canEdit = isAuthor || (mem.role === 'moderator' && isIntro)
  if (!canEdit) return err('not-yours')

  const mentioned = validateMentions(body, await mentionSafelist(payload, spaceId))
  if (mentioned.invalid.length > 0) return err('mention')

  await payload.update({
    collection: 'space-posts',
    id,
    data: { body, edited_at: new Date().toISOString() } as never,
    overrideAccess: true,
  })
  // replace versions: payload handles versions automatically on update
  return { ok: true, data: true }
}

// --- postRemove ---

export const postRemove = async (i: Input<{ id: number }>): Promise<WriteResult<true>> => {
  const { payload, user, id } = i
  const post = (await payload.findByID({
    collection: 'space-posts',
    id,
    depth: 0,
    overrideAccess: true,
  })) as { space: number | { id: number }; author: number | { id: number } | null } | null
  if (!post) return err('not-found')
  const spaceId = typeof post.space === 'object' ? post.space.id : post.space
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
  const mem = await membership(payload, user, g.space)
  const isAuthor =
    post.author !== null &&
    (typeof post.author === 'object' ? post.author.id : post.author) === personOf(user)
  if (!isAuthor && mem.role !== 'moderator') return err('not-yours')

  const { totalDocs: replyCount } = await payload.count({
    collection: 'space-comments',
    where: { post: { equals: id } },
    overrideAccess: true,
  })
  if (replyCount > 0) {
    // The required textarea cannot take '', so the tombstone holds one
    // space: content is gone, the row shows "deleted" (plan fix, Task 8).
    await payload.update({
      collection: 'space-posts',
      id,
      data: { deleted_at: new Date().toISOString(), body: TOMBSTONE_BODY } as never,
      overrideAccess: true,
    })
  } else {
    const { docs: files } = await payload.find({
      collection: 'space-files',
      where: { post: { equals: id } },
      overrideAccess: true,
      pagination: false,
      limit: 1000,
    })
    for (const f of files)
      await payload.delete({
        collection: 'space-files',
        id: (f as { id: number }).id,
        overrideAccess: true,
      })
    await payload.delete({ collection: 'space-posts', id, overrideAccess: true })
  }
  return { ok: true, data: true }
}

// --- postModify ---

export const postModify = async (
  i: Input<{ id: number; pinned?: boolean; locked?: boolean }>,
): Promise<WriteResult<true>> => {
  const { payload, user, id, pinned, locked } = i
  const post = (await payload.findByID({
    collection: 'space-posts',
    id,
    depth: 0,
    overrideAccess: true,
  })) as { space: number | { id: number } } | null
  if (!post) return err('not-found')
  const spaceId = typeof post.space === 'object' ? post.space.id : post.space
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
  const mem = await membership(payload, user, g.space)
  if (mem.role !== 'moderator') return err('not-yours')
  const data: Record<string, unknown> = {}
  if (typeof pinned === 'boolean') data.pinned = pinned
  if (typeof locked === 'boolean') data.locked = locked
  await payload.update({ collection: 'space-posts', id, data: data as never, overrideAccess: true })
  return { ok: true, data: true }
}

// --- commentCreate ---

export const commentCreate = async (
  i: Input<{ post: number; parent?: number | null; body: string; files?: PostFile[] }>,
): Promise<WriteResult<{ id: number }>> => {
  const { payload, user, post: postId, parent, body, files } = i
  const postData = (await payload.findByID({
    collection: 'space-posts',
    id: postId,
    depth: 0,
    overrideAccess: true,
  })) as {
    space: number | { id: number }
    locked?: boolean
    deleted_at?: string | null
    author?: number | { id: number } | null
  } | null
  if (!postData) return err('not-found')
  const spaceId = typeof postData.space === 'object' ? postData.space.id : postData.space
  const g = await gate(payload, user, spaceId, { write: true })
  if (g.stop) return err((g as { error: WriteError }).error)
  const space = g.space
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') return err('not-member')
  if (!mayComment(mem, space.posting ?? 'open')) return err('posting-level')
  if (postData.deleted_at) return err('not-found')
  if (postData.locked) return err('locked')

  if (parent) {
    const parentComment = (await payload
      .findByID({ collection: 'space-comments', id: parent, depth: 0, overrideAccess: true })
      .catch(() => null)) as {
      post?: number | { id: number } | null
      parent?: number | { id: number } | null
    } | null
    if (!parentComment || idOf(parentComment.post) !== postId) return err('not-found')
    if (parentComment.parent) return err('depth')
  }

  const mentioned = validateMentions(body, await mentionSafelist(payload, spaceId))
  if (mentioned.invalid.length > 0) return err('mention')

  if (!(await consentOf(payload, user))) return err('consent')

  const fileIssue = files?.length ? fileError(files, 0, FILE_LIMITS.comment) : null
  if (fileIssue) return err(fileIssue)

  const personId = personOf(user)
  const comment = await payload.create({
    collection: 'space-comments',
    data: { space: spaceId, post: postId, parent: parent ?? null, author: personId, body } as never,
    overrideAccess: true,
  })
  const commentId = (comment as { id: number }).id
  if (files?.length)
    await storeFilesOrRollback(payload, spaceId, 'space-comments', commentId, files)

  await payload.update({
    collection: 'space-posts',
    id: postId,
    data: { last_activity_at: new Date().toISOString() } as never,
    overrideAccess: true,
  })

  const notifyFn = async () => {
    const { actorOf, notify } = await import('@/lib/notify')
    const actor = await actorOf(payload, personOf(user))
    const context = await spaceNameOf(payload, space)
    if (!parent && (postData as { author?: number | { id: number } | null }).author) {
      const authorId =
        typeof (postData as { author: number | { id: number } | null }).author === 'object'
          ? (postData as { author: { id: number } }).author.id
          : (postData as { author: number }).author
      const { docs: users } = await payload.find({
        collection: 'users',
        where: { person: { equals: authorId } },
        depth: 0,
        overrideAccess: true,
        pagination: false,
        limit: 10,
      })
      const commentTargets = users
        .map((u) => (u as { id: number }).id)
        .filter((id) => id !== user.id)
      await notify(payload, commentTargets, {
        kind: 'comment',
        description: `${actor?.name ?? 'Someone'} commented on your post in ${context}`,
        link: spaceLink('en', space, postId),
        actor,
      })
    }
    if (parent) {
      const parentComment = (await payload.findByID({
        collection: 'space-comments',
        id: parent,
        depth: 0,
        overrideAccess: true,
      })) as { author?: number | { id: number } | null }
      if (parentComment?.author) {
        const authorId =
          typeof parentComment.author === 'object' ? parentComment.author.id : parentComment.author
        const { docs: users } = await payload.find({
          collection: 'users',
          where: { person: { equals: authorId } },
          depth: 0,
          overrideAccess: true,
          pagination: false,
          limit: 10,
        })
        const replyTargets = users
          .map((u) => (u as { id: number }).id)
          .filter((id) => id !== user.id)
        await notify(payload, replyTargets, {
          kind: 'reply',
          description: `${actor?.name ?? 'Someone'} replied to your comment in ${context}`,
          link: spaceLink('en', space, postId),
          actor,
        })
      }
    }
    const mentionedIds = mentioned.mentioned
    if (mentionedIds.length > 0) {
      const { docs: users } = await payload.find({
        collection: 'users',
        depth: 0,
        overrideAccess: true,
        pagination: false,
        limit: 10000,
      })
      const accountIds = users
        .filter((u) => mentionedIds.includes(personOf(u) ?? -1))
        .map((u) => (u as { id: number }).id)
      await notify(payload, accountIds, {
        kind: 'mention',
        description: `${actor?.name ?? 'Someone'} mentioned you in ${context}`,
        link: spaceLink('en', space, postId),
        actor,
      })
    }
  }

  return { ok: true, data: { id: commentId }, notify: notifyFn }
}

// --- commentEdit ---

export const commentEdit = async (
  i: Input<{ id: number; body: string }>,
): Promise<WriteResult<true>> => {
  const { payload, user, id, body } = i
  const comment = (await payload.findByID({
    collection: 'space-comments',
    id,
    depth: 0,
    overrideAccess: true,
  })) as {
    space: number | { id: number }
    post: number | { id: number }
    author: number | { id: number } | null
    deleted_at?: string | null
  } | null
  if (!comment) return err('not-found')
  const spaceId = typeof comment.space === 'object' ? comment.space.id : comment.space
  const g = await gate(payload, user, spaceId, { write: true })
  if (g.stop) return err((g as { error: WriteError }).error)
  const mem = await membership(payload, user, g.space)
  if (mem.role === 'none') return err('not-member')
  if (comment.deleted_at) return err('not-found')
  const parentPost = (await payload.findByID({
    collection: 'space-posts',
    id: idOf(comment.post)!,
    depth: 0,
    overrideAccess: true,
  })) as { deleted_at?: string | null; locked?: boolean }
  if (parentPost.deleted_at) return err('not-found')
  if (parentPost.locked) return err('locked')
  const isAuthor =
    comment.author !== null &&
    (typeof comment.author === 'object' ? comment.author.id : comment.author) === personOf(user)
  if (!isAuthor) return err('not-yours')

  const mentioned = validateMentions(body, await mentionSafelist(payload, spaceId))
  if (mentioned.invalid.length > 0) return err('mention')

  await payload.update({
    collection: 'space-comments',
    id,
    data: { body, edited_at: new Date().toISOString() } as never,
    overrideAccess: true,
  })
  return { ok: true, data: true }
}

// --- commentRemove ---

export const commentRemove = async (i: Input<{ id: number }>): Promise<WriteResult<true>> => {
  const { payload, user, id } = i
  const comment = (await payload.findByID({
    collection: 'space-comments',
    id,
    depth: 0,
    overrideAccess: true,
  })) as { space: number | { id: number }; author: number | { id: number } | null } | null
  if (!comment) return err('not-found')
  const spaceId = typeof comment.space === 'object' ? comment.space.id : comment.space
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
  const isAuthor =
    comment.author !== null &&
    (typeof comment.author === 'object' ? comment.author.id : comment.author) === personOf(user)
  const mem = await membership(payload, user, g.space)
  if (!isAuthor && mem.role !== 'moderator') return err('not-yours')

  const { totalDocs: replyCount } = await payload.count({
    collection: 'space-comments',
    where: { parent: { equals: id } },
    overrideAccess: true,
  })
  if (replyCount > 0) {
    await payload.update({
      collection: 'space-comments',
      id,
      data: { deleted_at: new Date().toISOString(), body: TOMBSTONE_BODY } as never,
      overrideAccess: true,
    })
  } else {
    const { docs: files } = await payload.find({
      collection: 'space-files',
      where: { comment: { equals: id } },
      overrideAccess: true,
      pagination: false,
      limit: 1000,
    })
    for (const f of files)
      await payload.delete({
        collection: 'space-files',
        id: (f as { id: number }).id,
        overrideAccess: true,
      })
    await payload.delete({ collection: 'space-comments', id, overrideAccess: true })
  }
  return { ok: true, data: true }
}

// --- fileAdd ---

export const fileAdd = async (
  i: Input<{ post?: number; comment?: number; file: PostFile }>,
): Promise<WriteResult<{ id: number }>> => {
  const { payload, user, post, comment, file } = i
  const targetId = post ?? comment
  const isPost = !!post
  const collection = isPost ? 'space-posts' : 'space-comments'
  const doc = (await payload.findByID({
    collection,
    id: targetId!,
    depth: 0,
    overrideAccess: true,
  })) as {
    space: number | { id: number }
    author?: number | { id: number } | null
    deleted_at?: string | null
    locked?: boolean
  } | null
  if (!doc) return err('not-found')
  const spaceId = typeof doc.space === 'object' ? doc.space.id : doc.space
  const g = await gate(payload, user, spaceId, { write: true })
  if (g.stop) return err((g as { error: WriteError }).error)
  const mem = await membership(payload, user, g.space)
  if (mem.role === 'none') return err('not-member')
  if (doc.deleted_at) return err('not-found')
  if (doc.locked) return err('locked')
  const isAuthor = doc.author != null && idOf(doc.author) === personOf(user)
  if (!isAuthor && mem.role !== 'moderator') return err('not-yours')
  if (!(await consentOf(payload, user))) return err('consent')

  const countField = isPost ? 'post' : 'comment'
  const { totalDocs } = await payload.count({
    collection: 'space-files',
    where: { [countField]: { equals: targetId } },
    overrideAccess: true,
  })
  const issue = fileError([file], totalDocs, isPost ? FILE_LIMITS.post : FILE_LIMITS.comment)
  if (issue) return err(issue)

  const id = await storeFile(
    payload,
    spaceId,
    isPost ? { post: targetId! } : { comment: targetId! },
    file,
  )
  return { ok: true, data: { id } }
}

// --- reactionToggle ---

export const reactionToggle = async (
  i: Input<{ post?: number; comment?: number; reaction: string; on: boolean }>,
): Promise<WriteResult<{ removed?: boolean }>> => {
  const { payload, user, post, comment, reaction, on } = i
  const targetId = post ?? comment
  const isPost = !!post
  const collection = isPost ? 'space-posts' : 'space-comments'
  const doc = (await payload.findByID({
    collection,
    id: targetId!,
    depth: 0,
    overrideAccess: true,
  })) as { space: number | { id: number } } | null
  if (!doc) return err('not-found')
  const spaceId = typeof doc.space === 'object' ? doc.space.id : doc.space
  const g = await gate(payload, user, spaceId, { write: true })
  if (g.stop) return err((g as { error: WriteError }).error)
  const mem = await membership(payload, user, g.space)
  if (mem.role === 'none') return err('not-member')

  const accountId = user.id
  const where: Record<string, unknown> = {
    account: { equals: accountId },
    reaction: { equals: reaction },
  }
  if (isPost) where.post = { equals: targetId }
  else where.comment = { equals: targetId }

  const { docs: existing } = await payload.find({
    collection: 'space-reactions',
    where: where as never,
    overrideAccess: true,
    pagination: false,
    limit: 10,
  })

  if (on) {
    if (existing.length > 0) return err('duplicate')
    await payload.create({
      collection: 'space-reactions',
      data: {
        space: spaceId,
        account: accountId,
        post: post ?? null,
        comment: comment ?? null,
        reaction,
      } as never,
      overrideAccess: true,
    })
    return { ok: true, data: {} }
  } else {
    if (existing.length === 0) return { ok: true, data: { removed: true } }
    for (const e of existing)
      await payload.delete({
        collection: 'space-reactions',
        id: (e as { id: number }).id,
        overrideAccess: true,
      })
    return { ok: true, data: { removed: true } }
  }
}

// --- consentAccept ---

/**
 * Sets the member's whole choice on a vote (spec: events and votes): the
 * options given replace the ones held, so a retry or a double tap lands on
 * the same rows. An empty list withdraws the vote. A single-choice vote takes
 * at most one option; every option must be the post's own.
 */
export const voteSet = async (
  i: Input<{ post: number; options: string[] }>,
): Promise<WriteResult<{ options: string[] }>> => {
  const { payload, user, post: postId } = i
  const post = (await payload
    .findByID({ collection: 'space-posts', id: postId, depth: 0, overrideAccess: true })
    .catch(() => null)) as {
    space: number | { id: number }
    kind?: string
    locked?: boolean | null
    deleted_at?: string | null
    vote_multiple?: boolean | null
    vote_options?: { id?: string | null }[] | null
  } | null
  if (!post || post.kind !== 'vote' || post.deleted_at) return err('not-found')
  const spaceId = typeof post.space === 'object' ? post.space.id : post.space
  const g = await gate(payload, user, spaceId, { write: true })
  if (g.stop) return err((g as { error: WriteError }).error)
  if ((await membership(payload, user, g.space)).role === 'none') return err('not-member')
  if (post.locked) return err('locked')

  const chosen = [...new Set(i.options)]
  const valid = new Set((post.vote_options ?? []).map((o) => o.id).filter(Boolean))
  if (chosen.some((o) => !valid.has(o))) return err('vote')
  if (!post.vote_multiple && chosen.length > 1) return err('vote')

  const { docs: held } = await payload.find({
    collection: 'space-votes',
    where: { and: [{ account: { equals: user.id } }, { post: { equals: postId } }] },
    overrideAccess: true,
    pagination: false,
    depth: 0,
  })
  for (const row of held)
    if (!chosen.includes(row.option))
      await payload.delete({ collection: 'space-votes', id: row.id, overrideAccess: true })
  const kept = new Set(held.map((row) => row.option))
  for (const option of chosen)
    if (!kept.has(option))
      await payload.create({
        collection: 'space-votes',
        data: { space: spaceId, account: user.id, post: postId, option },
        overrideAccess: true,
      })
  return { ok: true, data: { options: chosen } }
}

export const consentAccept = async (i: Input<object>): Promise<WriteResult<true>> => {
  const { payload, user } = i
  const { NOTICE_VERSION } = await import('@/lib/space-consent')
  const existing = await payload.count({
    collection: 'space-consents',
    where: { and: [{ account: { equals: user.id } }, { version: { equals: NOTICE_VERSION } }] },
    overrideAccess: true,
  })
  if (existing.totalDocs === 0) {
    await payload.create({
      collection: 'space-consents',
      data: {
        account: user.id,
        version: NOTICE_VERSION,
        accepted_at: new Date().toISOString(),
      } as never,
      overrideAccess: true,
    })
  }
  const { docs: visits } = await payload.find({
    collection: 'space-visits',
    where: { account: { equals: user.id } },
    overrideAccess: true,
    pagination: false,
    limit: 100,
  })
  for (const v of visits) {
    if (!(v as { saw_privacy?: boolean }).saw_privacy) {
      await payload.update({
        collection: 'space-visits',
        id: (v as { id: number }).id,
        data: { saw_privacy: true } as never,
        overrideAccess: true,
      })
    }
  }
  return { ok: true, data: true }
}

/** The space row, if the caller belongs to it; visits and checklist marks need this. */
const memberSpace = async (
  payload: Payload,
  user: NonNullable<User>,
  spaceId: number,
): Promise<{ ok: true } | { ok: false; error: WriteError }> => {
  const space = (await payload
    .findByID({ collection: 'spaces', id: spaceId, depth: 0, overrideAccess: true })
    .catch(() => null)) as SpaceLike | null
  if (!space) return { ok: false, error: 'space' }
  const mem = await membership(payload, user, space)
  return mem.role === 'none' ? { ok: false, error: 'not-member' } : { ok: true }
}

// --- visitRecord ---

export const visitRecord = async (i: Input<{ space: number }>): Promise<WriteResult<true>> => {
  const { payload, user, space } = i
  const target = await memberSpace(payload, user, space)
  if (!target.ok) return err(target.error)
  const { docs } = await payload.find({
    collection: 'space-visits',
    where: { and: [{ account: { equals: user.id } }, { space: { equals: space } }] },
    overrideAccess: true,
    pagination: false,
    limit: 1,
  })
  if (docs.length > 0) {
    await payload.update({
      collection: 'space-visits',
      id: (docs[0] as { id: number }).id,
      data: { last_visited_at: new Date().toISOString() } as never,
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'space-visits',
      data: { account: user.id, space, last_visited_at: new Date().toISOString() } as never,
      overrideAccess: true,
    })
  }
  return { ok: true, data: true }
}

// --- stepMark ---

export const stepMark = async (
  i: Input<{ space: number; step: StepKey; value: boolean }>,
): Promise<WriteResult<true>> => {
  const { payload, user, space, step, value } = i
  if (!STEP_KEYS.includes(step)) return err('not-found')
  const target = await memberSpace(payload, user, space)
  if (!target.ok) return err(target.error)
  const { docs } = await payload.find({
    collection: 'space-visits',
    where: { and: [{ account: { equals: user.id } }, { space: { equals: space } }] },
    overrideAccess: true,
    pagination: false,
    limit: 1,
  })
  if (docs.length === 0) {
    await payload.create({
      collection: 'space-visits',
      data: {
        account: user.id,
        space,
        last_visited_at: new Date().toISOString(),
        [step]: value,
      } as never,
      overrideAccess: true,
    })
  } else {
    await payload.update({
      collection: 'space-visits',
      id: (docs[0] as { id: number }).id,
      data: { [step]: value } as never,
      overrideAccess: true,
    })
  }
  return { ok: true, data: true }
}

// --- preferenceSet ---

export const preferenceSet = async (
  i: Input<{ digest: 'daily' | 'weekly' | 'off' }>,
): Promise<WriteResult<true>> => {
  const { payload, user, digest } = i
  const { docs } = await payload.find({
    collection: 'space-preferences',
    where: { account: { equals: user.id } },
    overrideAccess: true,
    pagination: false,
    limit: 1,
  })
  if (docs.length > 0) {
    await payload.update({
      collection: 'space-preferences',
      id: (docs[0] as { id: number }).id,
      data: { digest } as never,
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'space-preferences',
      data: { account: user.id, digest } as never,
      overrideAccess: true,
    })
  }
  const { docs: spaces } = await payload.find({
    collection: 'spaces',
    where: { kind: { equals: 'community' } },
    overrideAccess: true,
    pagination: false,
    limit: 1,
  })
  if (spaces.length > 0) {
    const spaceId = (spaces[0] as { id: number }).id
    const { docs: visits } = await payload.find({
      collection: 'space-visits',
      where: { and: [{ account: { equals: user.id } }, { space: { equals: spaceId } }] },
      overrideAccess: true,
      pagination: false,
      limit: 1,
    })
    if (visits.length > 0) {
      await payload.update({
        collection: 'space-visits',
        id: (visits[0] as { id: number }).id,
        data: { chose_digest: true } as never,
        overrideAccess: true,
      })
    }
  }
  return { ok: true, data: true }
}

// --- spaceSettingsSet ---

export const spaceSettingsSet = async (
  i: Input<{ space: number; posting?: PostingLevel; events?: EventPosting; reopened?: boolean }>,
): Promise<WriteResult<true>> => {
  const { payload, user, space, posting, events, reopened } = i
  const sp = (await payload.findByID({
    collection: 'spaces',
    id: space,
    depth: 0,
    overrideAccess: true,
  })) as SpaceLike
  const mem = await membership(payload, user, sp)
  if (mem.role !== 'moderator') return err('not-yours')
  const data: Record<string, unknown> = {}
  if (posting) data.posting = posting
  if (events === 'members' || events === 'moderators') data.events = events
  if (typeof reopened === 'boolean') data.reopened = reopened
  await payload.update({
    collection: 'spaces',
    id: space,
    data: data as never,
    overrideAccess: true,
  })
  return { ok: true, data: true }
}

// --- spaceRoster ---

export type RosterMember = {
  personId: number
  name: string
  photo: { url: string; alt: string } | null
  /** The public profile path, only for a person shown on the site. */
  slug: string | null
  bio: string | null
  links: PersonLink[]
}

export const spaceRoster = async (
  i: Input<{ space: number; locale?: 'en' | 'ar' }>,
): Promise<WriteResult<{ members: RosterMember[] }>> => {
  const { payload, user, space: spaceId, locale } = i
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
  if ((await membership(payload, user, g.space)).role === 'none') return err('not-member')
  const people = await spacePeople(payload, spaceId, locale)
  const members = people.map((p) => ({
    personId: p.id,
    name: p.name,
    photo: p.photo,
    slug: p.visible ? p.slug : null,
    bio: p.bio,
    links: p.links,
  }))
  return { ok: true, data: { members } }
}
