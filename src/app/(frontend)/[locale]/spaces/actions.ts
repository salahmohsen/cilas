'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { personOf } from '@/access'
import { routing } from '@/i18n/routing'
import { cairoInstant } from '@/lib/cairo-day'
import { currentReader } from '@/lib/reader'
import { isRsvpStatus } from '@/lib/space-event'
import type { PostFile, PostShape } from '@/lib/space-rules'
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
  voteEdit,
  voteSet,
  type StepKey,
  type WriteError,
} from '@/lib/spaces-write'

/**
 * Errors come back as keys; the pages map them to next-intl strings.
 * `auth` means no signed-in account reached the action.
 */
export type SpacesWriteState =
  | { status: 'ok' }
  | { status: 'error'; error: WriteError | 'auth' | 'failed' }

const err = (error: WriteError | 'auth' | 'failed'): SpacesWriteState => ({
  status: 'error',
  error,
})

/** The signed-in account and the payload client behind every action; null without an account. */
const sessionOf = async () => {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return null
  return { user, payload: await getPayload({ config }) }
}

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

const attachmentChangesOf = async (form: FormData) => ({
  files: await filesOf(form),
  removeFiles: form.getAll('remove_file').map((id) => Number(id)),
})

/** The event cover the form sends, if any (one photo, field `cover`). */
const coverOf = async (form: FormData): Promise<PostFile | null> => {
  const f = form.get('cover')
  if (!(f instanceof File) || f.size === 0) return null
  return { data: Buffer.from(await f.arrayBuffer()), mimetype: f.type, name: f.name, size: f.size }
}

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

/** When a vote closes, from its Cairo day and time: null for never, undefined when they name no real moment. */
const closesAtOf = (form: FormData): string | null | undefined => {
  const day = text(form, 'closes_day')
  if (!day) return null
  return cairoInstant(day, text(form, 'closes_time') || '23:45') ?? undefined
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
      return times
        ? {
            kind: 'event',
            event: { title: text(form, 'title'), location: text(form, 'location'), ...times },
          }
        : null
    }
    case 'vote': {
      const closesAt = closesAtOf(form)
      return closesAt === undefined
        ? null
        : {
            kind: 'vote',
            vote: {
              options: form.getAll('option').map((o) => String(o)),
              multiple: parseBool(form.get('multiple')) ?? false,
              anonymous: parseBool(form.get('anonymous')) ?? false,
              closesAt,
            },
          }
    }
    default:
      return { kind: 'discussion' }
  }
}

export async function postCreateAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const space = num(form, 'space')
  if (!space) return err('space')
  const shape = shapeOf(form)
  if (!shape) return err(text(form, 'kind') === 'vote' ? 'vote' : 'event')
  if (shape.kind === 'event') shape.cover = await coverOf(form)
  const files = await filesOf(form)
  const result = await postCreate({
    payload,
    user,
    space,
    ...shape,
    body: text(form, 'body'),
    files,
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
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const id = num(form, 'post')
  if (!id) return err('not-found')
  const result = await postEdit({
    payload,
    user,
    id,
    body: text(form, 'body'),
    ...(await attachmentChangesOf(form)),
  })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function voteEditAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const id = num(form, 'post')
  if (!id) return err('not-found')
  const closesAt = closesAtOf(form)
  if (closesAt === undefined) return err('vote')
  // Each option is sent as "id|label"; a new option has an empty id.
  const options = form.getAll('option').map((raw) => {
    const value = String(raw)
    const bar = value.indexOf('|')
    return { id: value.slice(0, bar) || null, label: value.slice(bar + 1) }
  })
  const result = await voteEdit({
    ...(await attachmentChangesOf(form)),
    payload,
    user,
    id,
    body: text(form, 'body'),
    options,
    multiple: parseBool(form.get('multiple')) ?? false,
    anonymous: parseBool(form.get('anonymous')) ?? false,
    closesAt,
  })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function postRemoveAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const id = num(form, 'post')
  if (!id) return err('not-found')
  const result = await postRemove({ payload, user, id })
  if (!result.ok) return err(result.error)
  await revalidate()
  // Leave the deleted post before revalidation renders its now-missing route.
  // Only accept a local post route for this post, never an arbitrary return URL.
  const match = text(form, 'pathname').match(
    new RegExp(
      `^/(${routing.locales.join('|')})/spaces/(community|course|cohort)/([^/?#]+)/posts/(\\d+)$`,
    ),
  )
  if (match && Number(match[4]) === id) {
    redirect(`/${match[1]}/spaces/${match[2]}/${match[3]}`, 'replace')
  }
  return { status: 'ok' }
}

export async function postModifyAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const id = num(form, 'post')
  if (!id) return err('not-found')
  const result = await postModify({
    payload,
    user,
    id,
    pinned: parseBool(form.get('pinned')),
    pinnedFull: parseBool(form.get('pinnedFull')),
    locked: parseBool(form.get('locked')),
  })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function commentCreateAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const post = num(form, 'post')
  if (!post) return err('not-found')
  const result = await commentCreate({
    payload,
    user,
    post,
    parent: num(form, 'parent'),
    body: text(form, 'body'),
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
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const id = num(form, 'comment')
  if (!id) return err('not-found')
  const result = await commentEdit({ payload, user, id, body: text(form, 'body') })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function commentRemoveAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const id = num(form, 'comment')
  if (!id) return err('not-found')
  const result = await commentRemove({ payload, user, id })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function fileAddAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const post = num(form, 'post')
  if (!post) return err('not-found')
  const file = (await filesOf(form))[0]
  if (!file) return err('file-type')
  const result = await fileAdd({ payload, user, post, file })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function reactionToggleAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const post = num(form, 'post')
  const comment = num(form, 'comment')
  if (!post && !comment) return err('not-found')
  const result = await reactionToggle({
    payload,
    user,
    post: post ?? undefined,
    comment: comment ?? undefined,
    reaction: text(form, 'reaction'),
    on: text(form, 'on') === 'true',
  })
  if (!result.ok) return err(result.error)
  await result.notify?.()
  await revalidate()
  return { status: 'ok' }
}

export async function voteSetAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const post = num(form, 'post')
  if (!post) return err('not-found')
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
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const post = num(form, 'post')
  if (!post) return err('not-found')
  const answer = text(form, 'status')
  if (answer !== '' && !isRsvpStatus(answer)) return err('rsvp')
  const result = await rsvpSet({ payload, user, post, status: answer === '' ? null : answer })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function eventEditAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const id = num(form, 'post')
  if (!id) return err('not-found')
  const times = eventTimesOf(form)
  if (!times) return err('event')
  const cover = text(form, 'cover_remove') === '1' ? null : ((await coverOf(form)) ?? undefined)
  const result = await eventEdit({
    ...(await attachmentChangesOf(form)),
    payload,
    user,
    id,
    location: text(form, 'location'),
    ...times,
    cover,
    // Only the author's dialog sends the words.
    title: form.has('title') ? text(form, 'title') : undefined,
    body: form.has('body') ? String(form.get('body') ?? '') : undefined,
  })
  if (!result.ok) return err(result.error)
  await revalidate()
  await result.notify?.()
  return { status: 'ok' }
}

export async function consentAcceptAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  void form
  const result = await consentAccept({ payload, user })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function visitRecordAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const space = num(form, 'space')
  if (!space) return err('space')
  const result = await visitRecord({ payload, user, space })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function stepMarkAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const space = num(form, 'space')
  if (!space) return err('space')
  const step = text(form, 'step') as StepKey
  if (!STEP_KEYS.includes(step)) return err('not-found')
  const result = await stepMark({
    payload,
    user,
    space,
    step,
    value: parseBool(form.get('value')) ?? true,
  })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function preferenceSetAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const digest = text(form, 'digest') as 'daily' | 'weekly' | 'off'
  const result = await preferenceSet({ payload, user, digest })
  if (!result.ok) return err(result.error)
  await revalidate()
  return { status: 'ok' }
}

export async function spaceSettingsSetAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const session = await sessionOf()
  if (!session) return err('auth')
  const { user, payload } = session
  const space = num(form, 'space')
  if (!space) return err('space')
  const posting = text(form, 'posting') || undefined
  const events = text(form, 'events')
  const reopen = form.get('reopen')
  const about = form.has('about') ? text(form, 'about') : undefined
  const rules = form.has('rules') ? text(form, 'rules') : undefined
  const locale = text(form, 'locale') === 'ar' ? 'ar' : 'en'
  const result = await spaceSettingsSet({
    payload,
    user,
    space,
    posting: posting ? (posting as 'open' | 'members_comment' | 'fellows_only') : undefined,
    events: events === 'members' || events === 'moderators' ? events : undefined,
    reopened: parseBool(reopen),
    about,
    rules,
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
  const session = await sessionOf()
  if (!session || !Number.isFinite(space) || Number.isNaN(Date.parse(since))) return 0
  const { user, payload } = session
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
