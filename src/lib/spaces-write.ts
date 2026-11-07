import { relId as unwrapId, relId } from '@/lib/relation'
import { detailPath } from '@/lib/paths'
import type { Payload, Where } from 'payload'

import { personOf } from '@/access'
import { archivedNow } from '@/lib/space-lifecycle'
import { parentOf, spaceLink, spaceTitle } from '@/lib/space-ref'
import { mentionSafelist, spacePeople } from '@/lib/space-members'
import { actorOf, notify, reactionNote } from '@/lib/notify'
import { spacesSettings, mode, spaceOpenOn, membership, introGates } from '@/lib/spaces'
import { FILE_LIMITS, SPACE_FILE_MIME } from '@/lib/space-file-limits'
import { NOTICE_VERSION, RULES_MAX } from '@/lib/space-consent'
import { locationUrl, eventOver, eventName, isRsvpStatus, type RsvpStatus } from '@/lib/space-event'
import {
  ABOUT_MAX,
  closingOf,
  eventsAllow,
  eventTimes,
  eventTitleOf,
  mayComment,
  postingAllows,
  shapeData,
  voteClosed,
  voteLabels,
  type PostFile,
  type PostShape,
} from '@/lib/space-rules'
import { SPACE_FILE_LIMIT } from '@/collections/SpaceFiles'
import { coverIssue, prepareCover } from '@/lib/event-cover-image'
import { placeName } from '@/lib/link-preview'
import { cleanSessionRefs, sessionIdsIn } from '@/lib/session-refs'
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
  | 'event-over'
  | 'rsvp'
  | 'vote'
  | 'vote-closed'
  | 'vote-voted'
  | 'about'
  | 'rules'
  | 'upload'
  | 'session'
  | 'intro'
  | 'intro-post'

export type WriteResult<T> =
  | { ok: true; data: T; notify?: (() => Promise<void>) | null }
  | { ok: false; error: WriteError; data?: { field?: string } }

export type StepKey =
  | 'saw_privacy'
  | 'introduced'
  | 'read_pinned'
  | 'checked_profile'
  | 'chose_digest'

export const STEP_KEYS: readonly StepKey[] = [
  'saw_privacy',
  'introduced',
  'read_pinned',
  'checked_profile',
  'chose_digest',
]

/** What a tombstoned row keeps in its required body field. */
const TOMBSTONE_BODY = ' '

type Input<T> = { payload: Payload; user: NonNullable<User> } & T

// --- Pure decision layer ---

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
    const path = detailPath('people', String(idStr))
    if (!Number.isNaN(id) && memberIds.has(id)) {
      if (!mentioned.includes(id)) mentioned.push(id)
    } else {
      invalid.push(path)
    }
  }
  return { mentioned, invalid }
}

// --- Helpers ---

const idOf = (v: number | { id: number } | null | undefined) => (v == null ? null : unwrapId(v))

const err = <E extends WriteError>(error: E): WriteResult<never> => ({ ok: false, error })

const gate = async (
  payload: Payload,
  user: NonNullable<User>,
  spaceId: number,
  /**
   * The post the write touches, `null` for a new post. A member behind the
   * space's introduction gate may touch only its intro post (W20).
   */
  opts: { write?: boolean; post?: number | null } = {},
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
    if (archivedNow(space, await parentOf(payload, space)))
      return { stop: true as const, error: 'read-only' as WriteError, space: space as SpaceLike }
  }
  if (opts.post !== undefined) {
    const intro = (await introGates(payload, user)).get(spaceId)
    if (intro != null && opts.post !== intro)
      return { stop: true as const, error: 'intro' as WriteError, space: space as SpaceLike }
  }
  return { stop: false as const, space: space as SpaceLike, settings }
}

const consentOf = async (payload: Payload, user: NonNullable<User>): Promise<boolean> => {
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

/** Type, size and count checks for photos joining a post that already holds `existing`. The space-files collection checks again. */
const fileError = (files: PostFile[], existing: number): WriteError | null => {
  for (const f of files) {
    if (!(SPACE_FILE_MIME as readonly string[]).includes(f.mimetype)) return 'file-type'
    if (f.size > SPACE_FILE_LIMIT) return 'file-size'
  }
  return files.length && existing + files.length > FILE_LIMITS.post ? 'file-count' : null
}

const storeFile = async (
  payload: Payload,
  spaceId: number,
  target: { post: number },
  file: PostFile,
  replacing = 0,
): Promise<number> => {
  const created = await payload.create({
    context: { spaceFilesReplacing: replacing },
    collection: 'space-files',
    data: {
      space: spaceId,
      post: target.post,
      filename: file.name,
    } as never,
    file: { data: file.data, mimetype: file.mimetype, name: file.name, size: file.size } as never,
    overrideAccess: true,
  })
  return (created as { id: number }).id
}

/**
 * Stores every photo on a just-created post. When storage refuses one, the
 * post and its photos go and the member gets the 'upload' error, not a
 * server error.
 */
const storeFilesOrRollback = async (
  payload: Payload,
  spaceId: number,
  postId: number,
  files: PostFile[],
): Promise<boolean> => {
  const stored: number[] = []
  try {
    for (const f of files) stored.push(await storeFile(payload, spaceId, { post: postId }, f))
  } catch (e) {
    for (const id of stored)
      await payload
        .delete({ collection: 'space-files', id, overrideAccess: true })
        .catch(() => undefined)
    await payload
      .delete({ collection: 'space-posts', id: postId, overrideAccess: true })
      .catch(() => undefined)
    payload.logger.error({ err: e, msg: `A file for space-posts ${postId} was not stored` })
    return false
  }
  return true
}

/** The space's display name, quoted, for notification detail text. */
const spaceNameOf = async (payload: Payload, space: SpaceLike): Promise<string> =>
  `“${spaceTitle(space, await parentOf(payload, space, { select: { title: true } }), 'en')}”`

// --- postCreate ---

/** The place name to store for an event's place: only an address has one to read. */
const placeOf = async (location: string): Promise<string | null> => {
  const url = locationUrl(location)
  return url ? placeName(url) : null
}

type Cover = { data: Buffer; name: string; tone: string; size: number }

/** A cover checked against the space file rules and prepared for storage, or the error to show. */
const coverOf = async (file: PostFile): Promise<Cover | WriteError> => {
  const issue = coverIssue(file, SPACE_FILE_LIMIT)
  if (issue) return issue
  const ready = await prepareCover(file.data, file.name)
  return ready ? { ...ready, size: ready.data.byteLength } : 'file-type'
}

/** Stores a cover as a space file of its own (no post, no comment) and returns its id. */
const storeCover = async (payload: Payload, spaceId: number, cover: Cover): Promise<number> => {
  const created = await payload.create({
    collection: 'space-files',
    data: { space: spaceId, post: null, comment: null, filename: cover.name } as never,
    file: {
      data: cover.data,
      mimetype: 'image/webp',
      name: cover.name,
      size: cover.size,
    } as never,
    overrideAccess: true,
  })
  return (created as { id: number }).id
}

const removeFile = async (payload: Payload, id: number | null) => {
  if (id !== null)
    await payload
      .delete({ collection: 'space-files', id, overrideAccess: true })
      .catch(() => undefined)
}

/**
 * The body with every course session it names checked against this space's
 * course: an unknown or foreign session, or one past the cap, turns into
 * plain text. Outside a course space no session is known.
 */
export const sessionSafeBody = async (
  payload: Payload,
  space: SpaceLike,
  body: string,
  options?: { blocks?: boolean },
): Promise<string> => {
  if (!sessionIdsIn(body).length) return body
  const course =
    space.kind === 'course' ? await parentOf(payload, space, { select: { sessions: true } }) : null
  const known = new Set((course?.sessions ?? []).flatMap((s) => (s.id ? [s.id] : [])))
  return cleanSessionRefs(body, known, options)
}

export const postCreate = async (
  i: Input<
    {
      space: number
      body: string
      files?: PostFile[]
    } & PostShape
  >,
): Promise<WriteResult<{ id: number }>> => {
  const { payload, user, space: spaceId, kind, files } = i
  const g = await gate(payload, user, spaceId, { write: true, post: null })
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
  const body = await sessionSafeBody(payload, space, i.body)
  // Only sessions this course does not have: nothing is left to post.
  if (!body.trim()) return err('session')

  const mentioned = validateMentions(body, await mentionSafelist(payload, spaceId))
  if (mentioned.invalid.length > 0) return err('mention')

  if (!(await consentOf(payload, user))) return err('consent')

  const fileIssue = files?.length ? fileError(files, 0) : null
  if (fileIssue) return err(fileIssue)
  const cover = i.kind === 'event' && i.cover ? await coverOf(i.cover) : null
  if (typeof cover === 'string') return err(cover)
  if (i.kind === 'event') extra.event_place = await placeOf(String(extra.event_location))

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
  if (files?.length && !(await storeFilesOrRollback(payload, spaceId, postId, files)))
    return err('upload')
  if (cover) {
    let coverId: number | null = null
    try {
      coverId = await storeCover(payload, spaceId, cover)
      await payload.update({
        collection: 'space-posts',
        id: postId,
        data: { event_cover: coverId, event_cover_tone: cover.tone } as never,
        overrideAccess: true,
      })
    } catch (e) {
      payload.logger.error({ err: e, msg: `The cover of space-posts ${postId} was not stored` })
      await removeFile(payload, coverId)
      await postRemove({ payload, user, id: postId })
      return err('upload')
    }
  }

  const notifyFn = async () => {
    const actor = await actorOf(payload, personOf(user))
    const context = await spaceNameOf(payload, space)
    if (kind === 'announcement') {
      const people = await spacePeople(payload, spaceId)
      const accountIds = people.map((p) => p.accountId).filter((id): id is number => id !== null)
      await notify(payload, accountIds, {
        kind: 'announcement',
        description: `A new announcement in ${context}`,
        link: await spaceLink(payload, space, postId),
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
        link: await spaceLink(payload, space, postId),
        actor,
      })
    }
  }

  return { ok: true, data: { id: postId }, notify: notifyFn }
}

export type PostAttachmentEdit = { files?: PostFile[]; removeFiles?: number[] }

/** Stage new files before editing; a failed save removes only those staged files. */
const savePostEdit = async (
  payload: Payload,
  user: User,
  spaceId: number,
  post: number,
  changes: PostAttachmentEdit,
  update: () => Promise<unknown>,
): Promise<WriteResult<true>> => {
  const files = changes.files ?? []
  const remove = new Set(changes.removeFiles ?? [])
  const stored: number[] = []
  if (files.length || remove.size) {
    if (!(await consentOf(payload, user))) return err('consent')
    const { docs: existing } = await payload.find({
      collection: 'space-files',
      where: { post: { equals: post } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    if ([...remove].some((id) => !existing.some((f) => f.id === id))) return err('not-yours')
    const issue = fileError(files, existing.length - remove.size)
    if (issue) return err(issue)
  }
  try {
    for (const file of files)
      stored.push(await storeFile(payload, spaceId, { post }, file, remove.size))
    await update()
  } catch (error) {
    for (const id of stored)
      await payload
        .delete({ collection: 'space-files', id, overrideAccess: true })
        .catch(() => undefined)
    payload.logger.error({ err: error, msg: `Editing space-posts ${post} failed` })
    return err('upload')
  }
  for (const id of remove)
    await payload.delete({ collection: 'space-files', id, overrideAccess: true })
  return { ok: true, data: true }
}

// --- postEdit ---

export const postEdit = async (
  i: Input<{ id: number; body: string } & PostAttachmentEdit>,
): Promise<WriteResult<true>> => {
  const { payload, user, id } = i
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
  const spaceId = relId(post.space)
  const g = await gate(payload, user, spaceId, { write: true, post: id })
  if (g.stop) return err((g as { error: WriteError }).error)
  const space = g.space
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') return err('not-member')
  if (post.deleted_at) return err('not-found')
  if (post.locked) return err('locked')
  const isAuthor = post.author !== null && relId(post.author) === personOf(user)
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

  const body = await sessionSafeBody(payload, space, i.body)
  if (!body.trim()) return err('session')
  const mentioned = validateMentions(body, await mentionSafelist(payload, spaceId))
  if (mentioned.invalid.length > 0) return err('mention')

  return savePostEdit(payload, user, spaceId, id, i, () =>
    payload.update({
      collection: 'space-posts',
      id,
      data: { body, edited_at: new Date().toISOString() } as never,
      overrideAccess: true,
    }),
  )
}

// --- postRemove ---

export const postRemove = async (i: Input<{ id: number }>): Promise<WriteResult<true>> => {
  const { payload, user, id } = i
  const post = (await payload.findByID({
    collection: 'space-posts',
    id,
    depth: 0,
    overrideAccess: true,
  })) as {
    space: number | { id: number }
    author: number | { id: number } | null
    event_cover?: number | { id: number } | null
  } | null
  if (!post) return err('not-found')
  const spaceId = relId(post.space)
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
  const mem = await membership(payload, user, g.space)
  const isAuthor = post.author !== null && relId(post.author) === personOf(user)
  if (!isAuthor && mem.role !== 'moderator') return err('not-yours')
  // The intro post opens the space to its members; without it the gate has nothing to open.
  if (idOf(g.space.introduction_post) === id) return err('intro-post')
  const cover = post.event_cover != null ? idOf(post.event_cover) : null

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
      data: {
        deleted_at: new Date().toISOString(),
        body: TOMBSTONE_BODY,
        event_cover: null,
        event_cover_tone: null,
      } as never,
      overrideAccess: true,
    })
    await removeFile(payload, cover)
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
    // Their post column is NOT NULL under an ON DELETE SET NULL key, so the
    // post's delete fails while any answer or vote is left (reactions would
    // stay behind pointing at nothing).
    for (const collection of ['space-rsvps', 'space-votes', 'space-reactions'] as const)
      await payload.delete({ collection, where: { post: { equals: id } }, overrideAccess: true })
    await payload.delete({ collection: 'space-posts', id, overrideAccess: true })
    await removeFile(payload, cover)
  }
  return { ok: true, data: true }
}

// --- postModify ---

export const postModify = async (
  i: Input<{ id: number; pinned?: boolean; pinnedFull?: boolean; locked?: boolean }>,
): Promise<WriteResult<true>> => {
  const { payload, user, id, pinned, pinnedFull, locked } = i
  const post = (await payload.findByID({
    collection: 'space-posts',
    id,
    depth: 0,
    overrideAccess: true,
  })) as { space: number | { id: number } } | null
  if (!post) return err('not-found')
  const spaceId = relId(post.space)
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
  const mem = await membership(payload, user, g.space)
  if (mem.role !== 'moderator') return err('not-yours')
  // A locked intro post would keep its space shut to every member who has not commented yet.
  if (locked && idOf(g.space.introduction_post) === id) return err('intro-post')
  const data: Record<string, unknown> = {}
  if (typeof pinned === 'boolean') data.pinned = pinned
  if (typeof pinnedFull === 'boolean') data.pinned_full = pinnedFull
  if (typeof locked === 'boolean') data.locked = locked
  await payload.update({ collection: 'space-posts', id, data: data as never, overrideAccess: true })
  return { ok: true, data: true }
}

// --- commentCreate ---

export const commentCreate = async (
  i: Input<{ post: number; parent?: number | null; body: string }>,
): Promise<WriteResult<{ id: number }>> => {
  const { payload, user, post: postId, parent } = i
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
  const spaceId = relId(postData.space)
  const g = await gate(payload, user, spaceId, { write: true, post: postId })
  if (g.stop) return err((g as { error: WriteError }).error)
  const space = g.space
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') return err('not-member')
  // Every member may answer the intro post, whatever the posting level: it is how they get in.
  const isIntro = idOf(space.introduction_post) === postId
  if (!isIntro && !mayComment(mem, space.posting ?? 'open')) return err('posting-level')
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

  const body = await sessionSafeBody(payload, space, i.body, { blocks: false })
  if (!body.trim()) return err('session')
  const mentioned = validateMentions(body, await mentionSafelist(payload, spaceId))
  if (mentioned.invalid.length > 0) return err('mention')

  if (!(await consentOf(payload, user))) return err('consent')

  const personId = personOf(user)
  const comment = await payload.create({
    collection: 'space-comments',
    data: { space: spaceId, post: postId, parent: parent ?? null, author: personId, body } as never,
    overrideAccess: true,
  })
  const commentId = (comment as { id: number }).id

  await payload.update({
    collection: 'space-posts',
    id: postId,
    data: { last_activity_at: new Date().toISOString() } as never,
    overrideAccess: true,
  })

  const notifyFn = async () => {
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
        link: await spaceLink(payload, space, postId),
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
        const authorId = relId(parentComment.author)
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
          link: await spaceLink(payload, space, postId),
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
        link: await spaceLink(payload, space, postId),
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
  const { payload, user, id } = i
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
  const spaceId = relId(comment.space)
  const g = await gate(payload, user, spaceId, { write: true, post: idOf(comment.post) })
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
  const isAuthor = comment.author !== null && relId(comment.author) === personOf(user)
  if (!isAuthor) return err('not-yours')

  const body = await sessionSafeBody(payload, g.space, i.body, { blocks: false })
  if (!body.trim()) return err('session')
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
  const spaceId = relId(comment.space)
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
  const isAuthor = comment.author !== null && relId(comment.author) === personOf(user)
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
    await payload.delete({
      collection: 'space-reactions',
      where: { comment: { equals: id } },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'space-comments', id, overrideAccess: true })
  }
  return { ok: true, data: true }
}

// --- fileAdd ---

/** Adds one photo to a post. Comments take no files. */
export const fileAdd = async (
  i: Input<{ post: number; file: PostFile }>,
): Promise<WriteResult<{ id: number }>> => {
  const { payload, user, post: postId, file } = i
  const doc = (await payload.findByID({
    collection: 'space-posts',
    id: postId,
    depth: 0,
    overrideAccess: true,
  })) as {
    space: number | { id: number }
    author?: number | { id: number } | null
    deleted_at?: string | null
    locked?: boolean
  } | null
  if (!doc) return err('not-found')
  const spaceId = relId(doc.space)
  const g = await gate(payload, user, spaceId, { write: true, post: postId })
  if (g.stop) return err((g as { error: WriteError }).error)
  const mem = await membership(payload, user, g.space)
  if (mem.role === 'none') return err('not-member')
  if (doc.deleted_at) return err('not-found')
  if (doc.locked) return err('locked')
  const isAuthor = doc.author != null && idOf(doc.author) === personOf(user)
  if (!isAuthor && mem.role !== 'moderator') return err('not-yours')
  if (!(await consentOf(payload, user))) return err('consent')

  const { totalDocs } = await payload.count({
    collection: 'space-files',
    where: { post: { equals: postId } },
    overrideAccess: true,
  })
  const issue = fileError([file], totalDocs)
  if (issue) return err(issue)

  try {
    const id = await storeFile(payload, spaceId, { post: postId }, file)
    return { ok: true, data: { id } }
  } catch (e) {
    payload.logger.error({ err: e, msg: `A file for space-posts ${postId} was not stored` })
    return err('upload')
  }
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
  })) as {
    space: number | { id: number }
    post?: number | { id: number } | null
    author?: number | { id: number } | null
  } | null
  if (!doc) return err('not-found')
  const spaceId = relId(doc.space)
  const g = await gate(payload, user, spaceId, {
    write: true,
    post: isPost ? targetId! : idOf(doc.post),
  })
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
    const notifyFn = async () => {
      if (!doc.author) return
      const { docs: owners } = await payload.find({
        collection: 'users',
        where: { person: { equals: idOf(doc.author) } },
        depth: 0,
        overrideAccess: true,
        pagination: false,
        limit: 10,
      })
      const recipients = owners.map((u) => (u as { id: number }).id).filter((id) => id !== user.id)
      if (!recipients.length) return
      const actor = await actorOf(payload, personOf(user))
      const description = reactionNote({
        actor: actor?.name,
        reaction,
        target: isPost ? 'post' : 'comment',
        context: await spaceNameOf(payload, g.space),
      })
      const link = await spaceLink(payload, g.space, isPost ? targetId! : idOf(doc.post)!)
      // Switching a reaction off and on must not ring twice: one unread note
      // per person, place and line is enough.
      const { docs: unread } = await payload.find({
        collection: 'notifications',
        where: {
          and: [
            { recipient: { in: recipients } },
            { kind: { equals: 'reaction' } },
            { description: { equals: description } },
            { link: { equals: link } },
            { read_at: { exists: false } },
          ],
        },
        depth: 0,
        overrideAccess: true,
        pagination: false,
        select: { recipient: true },
      })
      const done = new Set(unread.map((n) => idOf(n.recipient as never)))
      await notify(
        payload,
        recipients.filter((id) => !done.has(id)),
        { kind: 'reaction', description, link, actor },
      )
    }
    return { ok: true, data: {}, notify: notifyFn }
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
 * at most one option; every option must be the post's own. A vote past its
 * closing time takes no more choices.
 */
export const voteSet = async (
  i: Input<{ post: number; options: string[] }>,
  now = new Date(),
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
    vote_closes_at?: string | null
  } | null
  if (!post || post.kind !== 'vote' || post.deleted_at) return err('not-found')
  const spaceId = relId(post.space)
  const g = await gate(payload, user, spaceId, { write: true, post: postId })
  if (g.stop) return err((g as { error: WriteError }).error)
  if ((await membership(payload, user, g.space)).role === 'none') return err('not-member')
  if (post.locked) return err('locked')
  if (voteClosed(post.vote_closes_at, now)) return err('vote-closed')

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

// --- voteEdit ---

/** One option as the edit sends it: a kept option carries its id, a new one has none. */
export type VoteOptionEdit = { id?: string | null; label: string }

/**
 * The author's edit of a whole vote: the question, the options, the choice
 * rules and the closing time. Kept options keep their id, so their choices
 * stay; a removed option takes its choices with it. Once anyone has voted, an
 * anonymous vote stays anonymous (choices made in secret are never named),
 * and several choices stay allowed while a member holds more than one.
 */
export const voteEdit = async (
  i: Input<
    {
      id: number
      body: string
      options: VoteOptionEdit[]
      multiple: boolean
      anonymous: boolean
      closesAt: string | null
    } & PostAttachmentEdit
  >,
  now = new Date(),
): Promise<WriteResult<true>> => {
  const { payload, user, id } = i
  const post = (await payload
    .findByID({ collection: 'space-posts', id, depth: 0, overrideAccess: true })
    .catch(() => null)) as {
    space: number | { id: number }
    author: number | { id: number } | null
    kind?: string
    locked?: boolean | null
    deleted_at?: string | null
    vote_options?: { id?: string | null; label: string }[] | null
    vote_multiple?: boolean | null
    vote_anonymous?: boolean | null
    vote_closes_at?: string | null
  } | null
  if (!post || post.kind !== 'vote' || post.deleted_at) return err('not-found')
  const spaceId = relId(post.space)
  const g = await gate(payload, user, spaceId, { write: true, post: id })
  if (g.stop) return err((g as { error: WriteError }).error)
  const space = g.space
  if ((await membership(payload, user, space)).role === 'none') return err('not-member')
  if (idOf(post.author as never) !== personOf(user)) return err('not-yours')
  if (post.locked) return err('locked')

  const body = await sessionSafeBody(payload, space, i.body)
  if (!body.trim()) return err('vote')
  const mentioned = validateMentions(body, await mentionSafelist(payload, spaceId))
  if (mentioned.invalid.length > 0) return err('mention')

  const labels = voteLabels(i.options.map((o) => o.label))
  if (!labels || labels.length !== i.options.length) return err('vote')
  const stored = new Set((post.vote_options ?? []).map((o) => o.id).filter(Boolean))
  if (i.options.some((o) => o.id && !stored.has(o.id))) return err('vote')
  // An unchanged closing time may already have passed; a new one must be ahead.
  const same =
    (post.vote_closes_at ? new Date(post.vote_closes_at).getTime() : null) ===
    (i.closesAt ? new Date(i.closesAt).getTime() : null)
  const closesAt = same ? (post.vote_closes_at ?? null) : closingOf(i.closesAt, now)
  if (closesAt === undefined) return err('vote')

  const { docs: held } = await payload.find({
    collection: 'space-votes',
    where: { post: { equals: id } },
    overrideAccess: true,
    pagination: false,
    depth: 0,
    select: { account: true, option: true },
  })
  const kept = new Set(i.options.map((o) => o.id).filter(Boolean))
  const staying = held.filter((row) => kept.has(row.option))
  if (staying.length > 0 && post.vote_anonymous && !i.anonymous) return err('vote-voted')
  if (!i.multiple) {
    const perAccount = new Map<number, number>()
    for (const row of staying) {
      const account = idOf(row.account as never) ?? -1
      perAccount.set(account, (perAccount.get(account) ?? 0) + 1)
    }
    if ([...perAccount.values()].some((n) => n > 1)) return err('vote-voted')
  }

  const saved = await savePostEdit(payload, user, spaceId, id, i, () =>
    payload.update({
      collection: 'space-posts',
      id,
      data: {
        body,
        vote_options: i.options.map((o, n) => ({
          ...(o.id ? { id: o.id } : {}),
          label: labels[n],
        })),
        vote_multiple: i.multiple,
        vote_anonymous: i.anonymous,
        vote_closes_at: closesAt,
        edited_at: now.toISOString(),
      } as never,
      overrideAccess: true,
    }),
  )
  if (!saved.ok) return saved
  for (const row of held)
    if (!kept.has(row.option))
      await payload.delete({ collection: 'space-votes', id: row.id, overrideAccess: true })
  return { ok: true, data: true }
}

// --- rsvpSet ---

/**
 * Sets the member's answer to an event (going, maybe or not going), or
 * withdraws it with null. One row per member and event, so a retry or a
 * double tap lands on the same row. Archived spaces, locked posts and events
 * that are over refuse it.
 */
export const rsvpSet = async (
  i: Input<{ post: number; status: RsvpStatus | null }>,
  now = new Date(),
): Promise<WriteResult<{ status: RsvpStatus | null }>> => {
  const { payload, user, post: postId, status } = i
  if (status !== null && !isRsvpStatus(status)) return err('rsvp')
  const post = (await payload
    .findByID({ collection: 'space-posts', id: postId, depth: 0, overrideAccess: true })
    .catch(() => null)) as {
    space: number | { id: number }
    kind?: string
    locked?: boolean | null
    deleted_at?: string | null
    event_starts_at?: string | null
    event_ends_at?: string | null
  } | null
  if (!post || post.kind !== 'event' || post.deleted_at || !post.event_starts_at)
    return err('not-found')
  const spaceId = relId(post.space)
  const g = await gate(payload, user, spaceId, { write: true, post: postId })
  if (g.stop) return err((g as { error: WriteError }).error)
  if ((await membership(payload, user, g.space)).role === 'none') return err('not-member')
  if (post.locked) return err('locked')
  if (eventOver(post.event_starts_at, post.event_ends_at, now)) return err('event-over')

  const { docs: held } = await payload.find({
    collection: 'space-rsvps',
    where: { and: [{ account: { equals: user.id } }, { post: { equals: postId } }] },
    overrideAccess: true,
    pagination: false,
    depth: 0,
  })
  const [row, ...extra] = held
  for (const other of extra)
    await payload.delete({ collection: 'space-rsvps', id: other.id, overrideAccess: true })
  if (status === null) {
    if (row) await payload.delete({ collection: 'space-rsvps', id: row.id, overrideAccess: true })
  } else if (!row) {
    await payload.create({
      collection: 'space-rsvps',
      data: { space: spaceId, account: user.id, post: postId, status },
      overrideAccess: true,
    })
  } else if (row.status !== status) {
    await payload.update({
      collection: 'space-rsvps',
      id: row.id,
      data: { status },
      overrideAccess: true,
    })
  }
  return { ok: true, data: { status } }
}

// --- eventEdit ---

/**
 * The one edit of an event post: its name and description (the author's
 * only), its place, times and cover (the author's or a moderator's). A locked
 * post or an archived space refuse; an event that is over takes new words
 * only. When the place or the times really change, the members who answered
 * going or maybe get a notification (returned as `notify`, run after the
 * save like postCreate's).
 */
export const eventEdit = async (
  i: Input<
    {
      id: number
      location: string
      startsAt: string
      endsAt?: string | null
      /** A new cover; null takes the cover away; left out, the cover stays */
      cover?: PostFile | null
      /** The name and the description are the author's words; left out, they stay */
      title?: string | null
      body?: string
    } & PostAttachmentEdit
  >,
  now = new Date(),
): Promise<WriteResult<true>> => {
  const { payload, user, id } = i
  const post = (await payload
    .findByID({ collection: 'space-posts', id, depth: 0, overrideAccess: true })
    .catch(() => null)) as {
    space: number | { id: number }
    author: number | { id: number } | null
    kind?: string
    body?: string
    locked?: boolean | null
    deleted_at?: string | null
    event_location?: string | null
    event_starts_at?: string | null
    event_ends_at?: string | null
    event_title?: string | null
    event_place?: string | null
    event_cover?: number | { id: number } | null
  } | null
  if (!post || post.kind !== 'event' || post.deleted_at || !post.event_starts_at)
    return err('not-found')
  const spaceId = relId(post.space)
  const g = await gate(payload, user, spaceId, { write: true, post: id })
  if (g.stop) return err((g as { error: WriteError }).error)
  const space = g.space
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') return err('not-member')
  const isAuthor = post.author !== null && relId(post.author) === personOf(user)
  if (!isAuthor && mem.role !== 'moderator') return err('not-yours')
  if (post.locked) return err('locked')

  // The author's words: a moderator may move someone's event, not reword it.
  const words: Record<string, unknown> = {}
  if (i.title !== undefined) {
    const title = eventTitleOf(i.title)
    if (title === undefined) return err('event')
    if (title !== (post.event_title ?? null)) words.event_title = title
  }
  const body = i.body === undefined ? undefined : await sessionSafeBody(payload, space, i.body)
  if (body !== undefined && body !== post.body) {
    if (body.trim() === '') return err('event')
    const mentioned = validateMentions(body, await mentionSafelist(payload, spaceId))
    if (mentioned.invalid.length > 0) return err('mention')
    words.body = body
  }
  const reworded = Object.keys(words).length > 0
  const filesChanged = !!(i.files?.length || i.removeFiles?.length)
  if ((reworded || filesChanged) && !isAuthor) return err('not-yours')
  const over = eventOver(post.event_starts_at, post.event_ends_at, now)

  const startChanged = new Date(i.startsAt).getTime() !== new Date(post.event_starts_at).getTime()
  const next = eventTimes(i, now, startChanged)
  if (!next) return err('event')
  const sameTime = (a: string | null | undefined, b: string | null) =>
    (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null)
  const moved = next.location !== (post.event_location ?? '')
  const changed =
    moved ||
    !sameTime(post.event_starts_at, next.startsAt) ||
    !sameTime(post.event_ends_at, next.endsAt)
  const oldCover = post.event_cover != null ? idOf(post.event_cover) : null
  const cover = i.cover ? await coverOf(i.cover) : null
  if (typeof cover === 'string') return err(cover)
  const coverChanges = i.cover !== undefined && (cover !== null || oldCover !== null)
  // A place saved before names were kept is read on the next save.
  const unnamed = post.event_place == null && locationUrl(next.location) !== null
  // An event that is over keeps its time, place and cover; its words may still be fixed.
  if (over && (changed || coverChanges)) return err('event-over')
  if (!changed && !coverChanges && !(unnamed && !over) && !reworded && !filesChanged)
    return { ok: true, data: true }

  let coverId: number | null = null
  try {
    if (cover) coverId = await storeCover(payload, spaceId, cover)
  } catch (e) {
    payload.logger.error({ err: e, msg: `A cover for space-posts ${id} was not stored` })
    return err('upload')
  }
  const saved = await savePostEdit(payload, user, spaceId, id, i, async () =>
    payload.update({
      collection: 'space-posts',
      id,
      data: {
        event_location: next.location,
        event_starts_at: next.startsAt,
        event_ends_at: next.endsAt,
        ...(moved || (unnamed && !over) ? { event_place: await placeOf(next.location) } : {}),
        ...words,
        ...(reworded || filesChanged ? { edited_at: now.toISOString() } : {}),
        ...(coverChanges ? { event_cover: coverId, event_cover_tone: cover?.tone ?? null } : {}),
      } as never,
      overrideAccess: true,
    }),
  )
  if (!saved.ok) {
    await removeFile(payload, coverId)
    return saved
  }
  if (coverChanges) await removeFile(payload, oldCover)
  // A new photo alone tells nobody: only a new time or place changes plans.
  if (!changed) return { ok: true, data: true }

  const notifyFn = async () => {
    const { docs: answers } = await payload.find({
      collection: 'space-rsvps',
      where: { and: [{ post: { equals: id } }, { status: { in: ['going', 'maybe'] } }] },
      overrideAccess: true,
      pagination: false,
      depth: 0,
      select: { account: true },
    })
    const accounts = answers.map((a) => relId(a.account)).filter((account) => account !== user.id)
    if (!accounts.length) return
    await notify(payload, accounts, {
      kind: 'event_changed',
      description: `“${eventName(post, 'An event')}” in ${await spaceNameOf(payload, space)} has a new time or place`,
      link: await spaceLink(payload, space, id),
      actor: await actorOf(payload, personOf(user)),
    })
  }
  return { ok: true, data: true, notify: notifyFn }
}

export const consentAccept = async (i: Input<object>): Promise<WriteResult<true>> => {
  const { payload, user } = i
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

/**
 * Stamps the member's visit: one row per member and space. Two renders of a
 * first visit can both find no row; the second create then meets the unique
 * index, and its stamp lands on the row the first one made.
 */
export const visitRecord = async (i: Input<{ space: number }>): Promise<WriteResult<true>> => {
  const { payload, user, space } = i
  const target = await memberSpace(payload, user, space)
  if (!target.ok) return err(target.error)
  const stamp = { last_visited_at: new Date().toISOString() }
  const mine: Where = { and: [{ account: { equals: user.id } }, { space: { equals: space } }] }
  const { docs } = await payload.find({
    collection: 'space-visits',
    where: mine,
    overrideAccess: true,
    pagination: false,
    limit: 1,
  })
  if (docs.length === 0) {
    const made = await payload
      .create({
        collection: 'space-visits',
        data: { account: user.id, space, ...stamp } as never,
        overrideAccess: true,
      })
      .then(() => true)
      .catch(() => false)
    if (made) return { ok: true, data: true }
  }
  await payload.update({
    collection: 'space-visits',
    where: mine,
    data: stamp as never,
    overrideAccess: true,
  })
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
  i: Input<{
    space: number
    posting?: PostingLevel
    events?: EventPosting
    reopened?: boolean
    /** The custom About text in `locale`; an empty string goes back to the default. */
    about?: string
    /** This space's own "Privacy and rules" in `locale`; an empty string goes back to the site's. */
    rules?: string
    locale?: 'en' | 'ar'
  }>,
): Promise<WriteResult<true>> => {
  const { payload, user, space, posting, events, reopened, about, rules, locale } = i
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
  if (typeof about === 'string') {
    const text = about.replace(/\r\n?/g, '\n').trim()
    if (text.length > ABOUT_MAX) return err('about')
    data.about = text
  }
  if (typeof rules === 'string') {
    const text = rules.replace(/\r\n?/g, '\n').trim()
    if (text.length > RULES_MAX) return err('rules')
    data.privacy_rules = text
  }
  await payload.update({
    collection: 'spaces',
    id: space,
    data: data as never,
    locale,
    overrideAccess: true,
  })
  return { ok: true, data: true }
}
