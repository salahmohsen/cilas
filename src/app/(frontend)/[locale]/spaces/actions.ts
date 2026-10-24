'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import { personOf } from '@/access'
import { routing } from '@/i18n/routing'
import { currentReader } from '@/lib/reader'
import {
  commentCreate,
  commentEdit,
  commentRemove,
  consentAccept,
  fileAdd,
  postCreate,
  postEdit,
  postModify,
  postRemove,
  preferenceSet,
  reactionToggle,
  spaceSettingsSet,
  STEP_KEYS,
  stepMark,
  visitRecord,
  type PostFile,
  type StepKey,
  type WriteError,
} from '@/lib/spaces-write'

/**
 * Errors come back as keys; the pages map them to next-intl strings.
 * `auth` means no signed-in account reached the action.
 */
export type SpacesWriteState = { status: 'ok' } | { status: 'error'; error: WriteError | 'auth' }

const err = (error: WriteError | 'auth'): SpacesWriteState => ({ status: 'error', error })

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

export async function postCreateAction(
  _prev: SpacesWriteState,
  form: FormData,
): Promise<SpacesWriteState> {
  const user = await currentReader()
  if (!user || user.collection !== 'users') return err('auth')
  const space = num(form, 'space')
  if (!space) return err('space')
  const kind = text(form, 'kind') === 'announcement' ? 'announcement' : 'discussion'
  const files = await filesOf(form)
  const payload = await getPayload({ config })
  const result = await postCreate({
    payload,
    user,
    space,
    kind,
    body: text(form, 'body'),
    files,
  })
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
  })
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
  const reopen = form.get('reopen')
  const payload = await getPayload({ config })
  const result = await spaceSettingsSet({
    payload,
    user,
    space,
    posting: posting ? (posting as 'open' | 'members_comment' | 'fellows_only') : undefined,
    reopened: parseBool(reopen),
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
