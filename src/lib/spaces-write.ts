import { differenceInCalendarDays } from 'date-fns'

import type { Payload } from 'payload'

import { personOf } from '@/access'
import { courseLastMeeting, readOnly } from '@/lib/space-lifecycle'
import { mentionSafelist, spacePeople } from '@/lib/space-members'
import { spacesSettings, mode, spaceOpenOn, membership } from '@/lib/spaces'
import { FILE_KINDS } from '@/lib/form-files'
import { SPACE_FILE_LIMIT } from '@/collections/SpaceFiles'
import type { SpaceLike, PostingLevel } from '@/lib/spaces'
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

export type WriteResult<T> =
  | { ok: true; data: T; notify?: (() => Promise<void>) | null }
  | { ok: false; error: WriteError; data?: { field?: string } }

export type PostFile = { data: Buffer; mimetype: string; name: string; size: number }

export type StepKey =
  'saw_privacy' | 'introduced' | 'read_pinned' | 'checked_profile' | 'chose_digest'

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

const gate = async (payload: Payload, user: NonNullable<User>, spaceId: number) => {
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

const spaceLink = (locale: string, space: SpaceLike, postId: number): string => {
  if (space.kind === 'community') return `/${locale}/spaces/community/posts/${postId}`
  const slug = space.kind === 'course' ? idOf(space.course) : idOf(space.programme)
  return `/${locale}/spaces/${space.kind}/${slug}/posts/${postId}`
}

// --- postCreate ---

export const postCreate = async (
  i: Input<{
    space: number
    kind: 'discussion' | 'announcement'
    body: string
    files?: PostFile[]
  }>,
): Promise<WriteResult<{ id: number }>> => {
  const { payload, user, space: spaceId, kind, body, files } = i
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err(g.error)
  const space = g.space
  const mem = await membership(payload, user, space)
  const last = await courseLastMeeting({
    schedule: (space as { schedule?: unknown }).schedule,
    sessions: (space as { sessions?: unknown }).sessions,
  })
  const days = last ? differenceInCalendarDays(new Date(), new Date(last)) : null
  if (readOnly(space, last, days)) return err('read-only')
  if (mem.role === 'none') return err('not-member')
  // Announcements are the moderator's voice; distinguish the refusal from
  // the posting level's (spec §3) so the UI can say which door is closed.
  if (kind === 'announcement' && mem.role !== 'moderator') return err('announcement')
  if (!postingAllows(space.posting ?? 'open', mem.role, kind)) return err('posting-level')

  const mentioned = validateMentions(body, await mentionSafelist(payload, spaceId))
  if (mentioned.invalid.length > 0) return err('mention')

  if (!(await consentOf(payload, user))) return err('consent')

  if (files && files.length > 0) {
    for (const f of files) {
      const kindEntry = Object.values(
        FILE_KINDS as Record<string, { mime: readonly string[] }>,
      ).find((k) => (k.mime as readonly string[]).includes(f.mimetype))
      if (!kindEntry) return err('file-type')
      if (f.size > SPACE_FILE_LIMIT) return err('file-size')
    }
    const { totalDocs } = await payload.count({
      collection: 'space-files',
      where: { post: { exists: false }, space: { equals: spaceId } },
      overrideAccess: true,
    })
    if (totalDocs + files.length > 5) return err('file-count')
  }

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
      last_activity_at: new Date().toISOString(),
      ...(kind === 'announcement' ? { pinned: true } : {}),
    } as never,
    overrideAccess: true,
  })
  const postId = (post as { id: number }).id

  const notifyFn = async () => {
    const { notify } = await import('@/lib/notify')
    if (kind === 'announcement') {
      const people = await spacePeople(payload, spaceId)
      const accountIds = people.map((p) => p.accountId).filter((id): id is number => id !== null)
      await notify(payload, accountIds, {
        kind: 'announcement',
        title: JSON.stringify({ key: 'space.announcement', args: {} }),
        link: spaceLink('en', space, postId),
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
        title: JSON.stringify({ key: 'space.mention', args: {} }),
        link: spaceLink('en', space, postId),
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
  })) as { space: number | { id: number }; author: number | { id: number } | null } | null
  if (!post) return err('not-found')
  const spaceId = typeof post.space === 'object' ? post.space.id : post.space
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
  const space = g.space
  const mem = await membership(payload, user, space)
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
      data: { deleted_at: new Date().toISOString(), body: ' ' } as never,
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
    author?: number | { id: number } | null
  } | null
  if (!postData) return err('not-found')
  const spaceId = typeof postData.space === 'object' ? postData.space.id : postData.space
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
  const space = g.space
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') return err('not-member')
  if (postData.locked) return err('locked')

  if (parent) {
    const parentComment = (await payload.findByID({
      collection: 'space-comments',
      id: parent,
      depth: 0,
      overrideAccess: true,
    })) as { parent?: number | { id: number } | null } | null
    if (parentComment?.parent) return err('depth')
  }

  const mentioned = validateMentions(body, await mentionSafelist(payload, spaceId))
  if (mentioned.invalid.length > 0) return err('mention')

  if (!(await consentOf(payload, user))) return err('consent')

  if (files && files.length > 0) {
    for (const f of files) {
      const kindEntry = Object.values(
        FILE_KINDS as Record<string, { mime: readonly string[] }>,
      ).find((k) => (k.mime as readonly string[]).includes(f.mimetype))
      if (!kindEntry) return err('file-type')
      if (f.size > SPACE_FILE_LIMIT) return err('file-size')
    }
    const { totalDocs } = await payload.count({
      collection: 'space-files',
      where: { comment: { exists: true }, space: { equals: spaceId } },
      overrideAccess: true,
    })
    if (totalDocs + files.length > 2) return err('file-count')
  }

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
    const { notify } = await import('@/lib/notify')
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
        title: JSON.stringify({ key: 'space.comment', args: {} }),
        link: spaceLink('en', space, postId),
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
          title: JSON.stringify({ key: 'space.reply', args: {} }),
          link: spaceLink('en', space, postId),
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
        title: JSON.stringify({ key: 'space.mention', args: {} }),
        link: spaceLink('en', space, postId),
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
  })) as { space: number | { id: number }; author: number | { id: number } | null } | null
  if (!comment) return err('not-found')
  const spaceId = typeof comment.space === 'object' ? comment.space.id : comment.space
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
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
      data: { deleted_at: new Date().toISOString(), body: '' } as never,
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
  })) as { space: number | { id: number } } | null
  if (!doc) return err('not-found')
  const spaceId = typeof doc.space === 'object' ? doc.space.id : doc.space
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
  const mem = await membership(payload, user, g.space)
  if (mem.role === 'none') return err('not-member')

  const kindEntry = Object.values(FILE_KINDS as Record<string, { mime: readonly string[] }>).find(
    (k) => (k.mime as readonly string[]).includes(file.mimetype),
  )
  if (!kindEntry) return err('file-type')
  if (file.size > SPACE_FILE_LIMIT) return err('file-size')

  const countField = isPost ? 'post' : 'comment'
  const { totalDocs } = await payload.count({
    collection: 'space-files',
    where: { [countField]: { equals: targetId } },
    overrideAccess: true,
  })
  const limit = isPost ? 5 : 2
  if (totalDocs >= limit) return err('file-count')

  const created = await payload.create({
    collection: 'space-files',
    data: {
      space: spaceId,
      post: post ?? null,
      comment: comment ?? null,
      filename: file.name,
    } as never,
    file: { data: file.data, mimetype: file.mimetype, name: file.name, size: file.size } as never,
    overrideAccess: true,
  })
  return { ok: true, data: { id: (created as { id: number }).id } }
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
  const g = await gate(payload, user, spaceId)
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

// --- visitRecord ---

export const visitRecord = async (i: Input<{ space: number }>): Promise<WriteResult<true>> => {
  const { payload, user, space } = i
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
  i: Input<{ space: number; posting?: PostingLevel; reopened?: boolean }>,
): Promise<WriteResult<true>> => {
  const { payload, user, space, posting, reopened } = i
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

export const spaceRoster = async (
  i: Input<{ space: number }>,
): Promise<
  WriteResult<{
    members: Array<{ personId: number; name: string; photo: { url: string; alt: string } | null }>
  }>
> => {
  const { payload, user, space: spaceId } = i
  const g = await gate(payload, user, spaceId)
  if (g.stop) return err((g as { error: WriteError }).error)
  const people = await spacePeople(payload, spaceId)
  const members = people.map((p) => ({ personId: p.id, name: p.name, photo: p.photo }))
  return { ok: true, data: { members } }
}
