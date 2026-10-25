'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { setRequestLocale } from 'next-intl/server'
import { createElement } from 'react'
import { getPayload } from 'payload'

import { personOf } from '@/access'
import { routing } from '@/i18n/routing'
import { cairoInstant } from '@/lib/cairo-day'
import { PostArticle, loadPost } from '@/components/space/post-article'
import { currentReader } from '@/lib/reader'
import { isRsvpStatus } from '@/lib/space-event'
import { postSpace } from '@/lib/spaces-data'
import {
  commentCreate,
  commentEdit,
  commentRemove,
  consentAccept,
  eventEdit,
  fileAdd,
  postCreate,
  postEdit,
  postModify,
  postRemove,
  preferenceSet,
  reactionToggle,
  rsvpSet,
  spaceSettingsSet,
  STEP_KEYS,
  stepMark,
  visitRecord,
  voteSet,
  type PostFile,
  type PostShape,
  type StepKey,
  type WriteError,
} from '@/lib/spaces-write'

/**
 * Errors come back as keys; the pages map them to next-intl strings.
 * `auth` means no signed-in account reached the action.
 */
export type SpacesWriteState =
  { status: 'ok' } | { status: 'error'; error: WriteError | 'auth' | 'failed' }

const err = (error: WriteError | 'auth' | 'failed'): SpacesWriteState => ({
  status: 'error',
  error,
})

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

const num = (form: FormData, key: string): number | null => {
  const raw = form.get(key)
  if (raw === null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const parseBool = (raw: FormDataEntryValue | null): boolean | undefined => {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (v === 'true' || v === 'on' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return undefined
}

const bool = (form: FormData, key: string): boolean | undefined => parseBool(form.get(key))

const filesOf = async (form: FormData): Promise<PostFile[]> =>
  Promise.all(
    form
      .getAll('file')
      .filter((f): f is File => f instanceof File && f.size > 0)
      .map(async (f) => ({
        data: Buffer.from(await f.arrayBuffer()),
        mimetype: f.type,
        name: f.name,
        size: f.size,
      })),
  )

// Server actions cannot read the route locale, so both trees refresh.
// 'layout' covers every page under /spaces, not only My spaces.
const revalidate = async () => {
  for (const locale of routing.locales) revalidatePath(`/${locale}/spaces`, 'layout')
}

/**
 * An event's start and optional end from the form's Cairo day and times, as
 * instants; null when a field names no real moment. The end is on the start's
 * day, and the write layer refuses one that is not after the start.
 */
const eventTimesOf = (form: FormData): { startsAt: string; endsAt: string | null } | null => {
  const day = text(form, 'day')
  const startsAt = cairoInstant(day, text(form, 'time'))
  if (!startsAt) return null
  const endTime = text(form, 'end_time')
  if (!endTime) return { startsAt, endsAt: null }
  const endsAt = cairoInstant(day, endTime)
  return endsAt ? { startsAt, endsAt } : null
}

/**
 * The post's kind and what it adds, read from the composer's fields. An
 * event's day and time are Cairo wall-clock (ADR 0002); null when they do
 * not name a real moment. The rules themselves live in postCreate.
 */
const shapeOf = (form: FormData): PostShape | null => {
  switch (text(form, 'kind')) {
    case 'announcement':
      return { kind: 'announcement' }
    case 'event': {
      const times = eventTimesOf(form)
      return times ? { kind: 'event', event: { location: text(form, 'location'), ...times } } : null
    }
    case 'vote':
      return {
        kind: 'vote',
        vote: {
          options: form.getAll('option').map((o) => String(o)),
          multiple: bool(form, 'multiple') ?? false,
          anonymous: bool(form, 'anonymous') ?? false,
        },
      }
    default:
      return { kind: 'discussion' }
  }
}

export async function postCreateAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const space = num(form, 'space')
  if (!space) return err('space')
  const shape = shapeOf(form)
  if (!shape) return err(text(form, 'kind') === 'vote' ? 'vote' : 'event')
  const files = await filesOf(form)
  const payload = await getPayload({ config })
  const result = await postCreate({
    payload,
    user,
    space,
    ...shape,
    body: text(form, 'body'),
    files,
    session: text(form, 'session') || null,
  }).catch((error) => {
    payload.logger.error({ err: error, msg: 'postCreate threw' })
    return null
  })
  if (!result) return err('failed')
  if (!result.ok) return err(result.error)
  await result.notify?.()
  await revalidate()
  return { status: 'ok' }
}

export async function postEditAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const id = num(form, 'post')
  if (!id) return err('not-found')
  const payload = await getPayload({ config })
  const result = await postEdit({ payload, user, id, body: text(form, 'body') })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function postRemoveAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const id = num(form, 'post')
  if (!id) return err('not-found')
  const payload = await getPayload({ config })
  const result = await postRemove({ payload, user, id })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function postModifyAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const id = num(form, 'post')
  if (!id) return err('not-found')
  const payload = await getPayload({ config })
  const result = await postModify({
    payload,
    user,
    id,
    pinned: bool(form, 'pinned'),
    locked: bool(form, 'locked'),
  })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function commentCreateAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const post = num(form, 'post')
  if (!post) return err('not-found')
  const files = await filesOf(form)
  const payload = await getPayload({ config })
  const result = await commentCreate({
    payload,
    user,
    post,
    parent: num(form, 'parent'),
    body: text(form, 'body'),
    files,
  }).catch((error) => {
    payload.logger.error({ err: error, msg: 'commentCreate threw' })
    return null
  })
  if (!result) return err('failed')
  if (!result.ok) return err(result.error)
  await result.notify?.()
  await revalidate()
  return { status: 'ok' }
}

export async function commentEditAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const id = num(form, 'comment')
  if (!id) return err('not-found')
  const payload = await getPayload({ config })
  const result = await commentEdit({ payload, user, id, body: text(form, 'body') })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function commentRemoveAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const id = num(form, 'comment')
  if (!id) return err('not-found')
  const payload = await getPayload({ config })
  const result = await commentRemove({ payload, user, id })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function fileAddAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const post = num(form, 'post')
  const comment = num(form, 'comment')
  if (!post && !comment) return err('not-found')
  const file = (await filesOf(form))[0]
  if (!file) return err('file-type')
  const payload = await getPayload({ config })
  const result = await fileAdd({
    payload,
    user,
    post: post ?? undefined,
    comment: comment ?? undefined,
    file,
  })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function reactionToggleAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const post = num(form, 'post')
  const comment = num(form, 'comment')
  if (!post && !comment) return err('not-found')
  const payload = await getPayload({ config })
  const result = await reactionToggle({
    payload,
    user,
    post: post ?? undefined,
    comment: comment ?? undefined,
    reaction: text(form, 'reaction'),
    on: text(form, 'on') === 'true',
  })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function voteSetAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const post = num(form, 'post')
  if (!post) return err('not-found')
  const payload = await getPayload({ config })
  const result = await voteSet({
    payload,
    user,
    post,
    options: form.getAll('option').map((o) => String(o)),
  })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function rsvpSetAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const post = num(form, 'post')
  if (!post) return err('not-found')
  const answer = text(form, 'status')
  if (answer !== '' && !isRsvpStatus(answer)) return err('rsvp')
  const payload = await getPayload({ config })
  const result = await rsvpSet({ payload, user, post, status: answer === '' ? null : answer })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function eventEditAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const id = num(form, 'post')
  if (!id) return err('not-found')
  const times = eventTimesOf(form)
  if (!times) return err('event')
  const payload = await getPayload({ config })
  const result = await eventEdit({ payload, user, id, location: text(form, 'location'), ...times })
  if (!result.ok) return err(result.error)
  await revalidate()
  await result.notify?.()
  return { status: 'ok' }
}

export async function consentAcceptAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  void form
  const payload = await getPayload({ config })
  const result = await consentAccept({ payload, user })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function visitRecordAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const space = num(form, 'space')
  if (!space) return err('space')
  const payload = await getPayload({ config })
  const result = await visitRecord({ payload, user, space })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function stepMarkAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const space = num(form, 'space')
  if (!space) return err('space')
  const step = text(form, 'step') as StepKey
  if (!STEP_KEYS.includes(step)) return err('not-found')
  const payload = await getPayload({ config })
  const result = await stepMark({ payload, user, space, step, value: bool(form, 'value') ?? true })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function preferenceSetAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const digest = text(form, 'digest') as 'daily' | 'weekly' | 'off'
  const payload = await getPayload({ config })
  const result = await preferenceSet({ payload, user, digest })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function spaceSettingsSetAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const space = num(form, 'space')
  if (!space) return err('space')
  const posting = text(form, 'posting') || undefined
  const events = text(form, 'events')
  const reopen = form.get('reopen')
  const about = form.has('about') ? text(form, 'about') : undefined
  const locale = text(form, 'locale') === 'ar' ? 'ar' : 'en'
  const payload = await getPayload({ config })
  const result = await spaceSettingsSet({
    payload,
    user,
    space,
    posting: posting ? (posting as 'open' | 'members_comment' | 'fellows_only') : undefined,
    events: events === 'members' || events === 'moderators' ? events : undefined,
    reopened: parseBool(reopen),
    about,
    locale,
  })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

/**
 * The freshness check (spec §Updates): how many posts by others arrived in a
 * space since the page rendered. A read through the posts rule, so a space the
 * caller cannot read counts zero.
 */
export async function spaceNewPostsAction(space: number, since: string): Promise<number> {
  const user = await currentReader()
  if (!user || user.collection !== 'users' || !Number.isFinite(space)) return 0
  if (Number.isNaN(Date.parse(since))) return 0
  const payload = await getPayload({ config })
  const person = personOf(user)
  const { totalDocs } = await payload.count({
    collection: 'space-posts',
    user,
    overrideAccess: false,
    where: {
      and: [
        { space: { equals: space } },
        { createdAt: { greater_than: since } },
        { deleted_at: { exists: false } },
        ...(person === null ? [] : [{ author: { not_equals: person } }]),
      ],
    },
  })
  return totalDocs
}

/**
 * The post dialog's content (spec §4), read on demand through the reader's
 * access instead of sitting in every feed card. Null when the post is gone
 * or this reader may not read it. `href` is only the link Copy link offers.
 */
export async function postDialogAction(postId: number, href: string, locale: string) {
  const user = await currentReader()
  if (!user || !Number.isInteger(postId)) return null
  const lang = routing.locales.find((l) => l === locale)
  if (!lang || !href.startsWith(`/${lang}/spaces/`)) return null
  setRequestLocale(lang)
  const payload = await getPayload({ config })
  const space = await postSpace(payload, user, postId)
  const loaded = space && (await loadPost(payload, user, space, postId, lang))
  if (!loaded) return null
  return createElement(PostArticle, {
    view: loaded.view,
    context: loaded.context,
    href,
    dialog: true,
  })
}
