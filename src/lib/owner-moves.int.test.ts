import { APIError, getPayload, type CollectionBeforeChangeHook, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { createTracker, uniq, uniqEmail } from '../../testing/payload.fixture'
import { rest } from '../../testing/payload-rest.test-utils'
import { trustedWrites, writePublishedArticle } from '../../testing/portal-lists.fixture'
import { resendInbox } from '../../testing/resend.test-utils'
import { holdRow, waitForLockWaiters } from '../../testing/row-lock.test-utils'
import { ownerMove } from './owner-moves'
import { getReviewQueue } from './review-queue'
import { type ReviewedDoc, statusInputOf, statusOf } from './review-status'

const inbox = resendInbox()
mockNetwork(inbox.handler, ...localServices)

let payload: Payload
let owner: User
let admin: User
let stranger: User
let fellow: User
let ownerToken: string
const { track, cleanup } = createTracker()

const makeAccount = async (base: string, roles: User['roles'], withPerson: boolean) => {
  const person = withPerson
    ? track(
        'people',
        await payload.create({
          collection: 'people',
          data: { name: `Owner Moves ${base}`, slug: uniq(`owner-moves-${base}`) },
        }),
      ).id
    : undefined
  const email = uniqEmail(base)
  const password = crypto.randomUUID()
  const user = track(
    'users',
    await payload.create({
      collection: 'users',
      depth: 0,
      data: { email, password, roles, ...(person ? { person } : {}) },
    }),
  ) as User
  const { token } = await payload.login({ collection: 'users', data: { email, password } })
  if (!token) throw new Error(`No token for ${email}`)
  return { user, token }
}

beforeAll(async () => {
  payload = await getPayload({ config })
  const account = await makeAccount('owner-moves-owner', ['member'], true)
  owner = account.user
  ownerToken = account.token
  admin = (await makeAccount('owner-moves-admin', ['admin'], false)).user
  stranger = (await makeAccount('owner-moves-stranger', ['member'], true)).user
  fellow = (await makeAccount('owner-moves-fellow', ['fellow'], true)).user
})

afterAll(async () => {
  if (!payload) return
  await cleanup(payload)
  await payload.destroy()
})

const writes = () => trustedWrites(payload, track)

const target = (id: number) => ({ collection: 'articles', id }) as const
const as = (user: User) => ({ user, overrideAccess: false }) as const

const keyOf = async (id: number) => {
  const main = await payload.findByID({
    collection: 'articles',
    id,
    draft: false,
    locale: 'all',
    depth: 0,
    overrideAccess: true,
  })
  const {
    docs: [version],
  } = await payload.findVersions({
    collection: 'articles',
    where: { parent: { equals: id }, latest: { equals: true } },
    sort: '-updatedAt',
    limit: 1,
    locale: 'all',
    depth: 0,
    overrideAccess: true,
  })
  const latest = version ? ({ ...version.version, id } as unknown as ReviewedDoc) : null
  return statusOf(
    statusInputOf({
      collection: 'articles',
      main: main as unknown as ReviewedDoc,
      latest,
      read: 'full',
    }),
    () => undefined,
  )
}

const latestVersion = async (id: number) => {
  const {
    docs: [version],
  } = await payload.findVersions({
    collection: 'articles',
    where: { parent: { equals: id }, latest: { equals: true } },
    sort: '-updatedAt',
    limit: 1,
    locale: 'all',
    depth: 0,
    overrideAccess: true,
  })
  return version as unknown as { id: number; version: Record<string, unknown> }
}

const publicTitle = async (id: number) =>
  (await payload.findByID({ collection: 'articles', id, draft: false, locale: 'en', depth: 0 }))
    .title

let slugs = 0
const submittedNew = async (title: string) => {
  const w = writes()
  const id = await w.create('articles', {
    title,
    slug: uniq(`owner-moves-new-${++slugs}`),
    authors: [Number(owner.person)],
    tier: 'owner',
    review: { status: 'draft' },
  })
  await w.submit('articles', id)
  return id
}

const lexical = (text: string) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          { type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
        ],
      },
    ],
  },
})

const live = (title: string) => writePublishedArticle(writes().create, Number(owner.person), title)

const withdrawnNotes = async (title: string) =>
  (
    await payload.find({
      collection: 'notifications',
      where: {
        and: [
          { recipient: { equals: admin.id } },
          { kind: { equals: 'withdrawn' } },
          { description: { contains: title } },
        ],
      },
      depth: 0,
      limit: 5,
      overrideAccess: true,
    })
  ).docs

const notesAbout = async (title: string, recipient: User) =>
  (
    await payload.find({
      collection: 'notifications',
      where: {
        and: [{ recipient: { equals: recipient.id } }, { description: { contains: title } }],
      },
      depth: 0,
      limit: 5,
      overrideAccess: true,
    })
  ).docs

let cycle: number | undefined
const courseCycle = async () => {
  if (cycle !== undefined) return cycle
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: {
        name: 'Owner moves place',
        slug: uniq('owner-moves-place'),
        city: uniq('Movesville'),
      },
      overrideAccess: true,
    }),
  ).id
  cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'spring', start_year: 2036, place, start_date: '2036-03-04' },
      overrideAccess: true,
    }),
  ).id
  return cycle
}

const liveCourse = async (title: string) =>
  writes().create('courses', {
    title,
    slug: uniq('owner-moves-course'),
    course_type: 'THEMATIC',
    tier: 'public',
    cycle: await courseCycle(),
    fellows: [Number(fellow.person)],
    registration: { mode: 'closed' },
    review: { status: 'approved' },
    _status: 'published',
  })

const saveDraft = (
  collection: 'articles' | 'courses',
  id: number,
  locale: 'en' | 'ar',
  data: Record<string, unknown>,
) =>
  payload.update({
    collection,
    id,
    data: data as never,
    draft: true,
    locale,
    overrideAccess: true,
  })

const latestOf = async (collection: 'articles' | 'courses', id: number) => {
  const {
    docs: [version],
  } = await payload.findVersions({
    collection,
    where: { parent: { equals: id }, latest: { equals: true } },
    sort: '-updatedAt',
    limit: 1,
    locale: 'all',
    depth: 0,
    overrideAccess: true,
  })
  return version as unknown as { id: number; version: Record<string, unknown> }
}

const strip = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (key, inner) => (key === 'id' ? undefined : inner)))

const discardThenRestore = async (who: User, collection: 'articles' | 'courses', id: number) => {
  const discarded = await ownerMove(payload, who, { collection, id }, { move: 'discard' })
  if (!discarded.ok || discarded.restoreFrom === undefined) throw new Error('discard failed')
  const afterDiscard = (await latestOf(collection, id)).version
  expect(
    await ownerMove(
      payload,
      who,
      { collection, id },
      { move: 'restore', from: discarded.restoreFrom },
    ),
  ).toEqual({ ok: true })
  return { afterDiscard, afterRestore: (await latestOf(collection, id)).version }
}

const historyOf = async (id: number) => {
  const { docs } = await payload.find({
    collection: 'review-events' as never,
    where: { collection: { equals: 'articles' }, doc: { equals: id } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return docs.map((event) => track('review-events', event))
}

describe('review-events: owner moves', () => {
  it('withdraw a new submission', async () => {
    const title = uniq('Withdraw new')
    const id = await submittedNew(title)
    expect(await keyOf(id)).toBe('submitted')
    expect(
      await getReviewQueue(payload).then((q) => q.some((i) => i.kind === 'article' && i.id === id)),
    ).toBe(true)
    const before = inbox.sent.length

    expect(await ownerMove(payload, owner, target(id), { move: 'withdraw' })).toEqual({ ok: true })

    expect(await keyOf(id)).toBe('draft')
    expect(await withdrawnNotes(title)).toHaveLength(1)
    expect(inbox.sent.length).toBe(before)
    expect(
      await getReviewQueue(payload).then((q) => q.some((i) => i.kind === 'article' && i.id === id)),
    ).toBe(false)
    expect((await historyOf(id)).filter((event) => event.actor === owner.id)).toMatchObject([
      { from: 'submitted', to: 'draft', request: null, note: null },
    ])
  })

  it('withdraw changes on a live article', async () => {
    const title = uniq('Withdraw edits')
    const id = await live(title)
    const w = writes()
    await w.edit('articles', id, { title: `${title}, edited` })
    await w.submit('articles', id, 'changes')
    expect(await keyOf(id)).toBe('published_edits')

    expect(await ownerMove(payload, owner, target(id), { move: 'withdraw' })).toEqual({ ok: true })

    expect(await keyOf(id)).toBe('published_unsent')
    const { version } = await latestVersion(id)
    expect(version.title).toMatchObject({ en: `${title}, edited` })
    expect((version.review as { request?: string | null }).request ?? null).toBeNull()
    expect(await withdrawnNotes(`${title}, edited`)).toHaveLength(1)
    expect(inbox.sent.filter((m) => m.html.includes(title))).toEqual([])
  })

  it('withdraw a removal request', async () => {
    const title = uniq('Withdraw removal')
    const id = await live(title)
    await writes().submit('articles', id, 'removal')
    expect(await keyOf(id)).toBe('published_removal')

    expect(await ownerMove(payload, owner, target(id), { move: 'withdraw' })).toEqual({ ok: true })

    expect(await publicTitle(id)).toBe(title)
    const owned = await payload.find({
      collection: 'notifications',
      where: {
        and: [{ recipient: { equals: owner.id } }, { description: { contains: title } }],
      },
      depth: 0,
      overrideAccess: true,
    })
    expect(owned.docs).toEqual([])
    expect(await withdrawnNotes(title)).toHaveLength(1)
    expect(inbox.sent.filter((m) => m.html.includes(title))).toEqual([])
    expect((await historyOf(id)).filter((event) => event.actor === owner.id)).toMatchObject([
      { from: 'submitted', to: 'draft', request: 'removal', note: null },
    ])
  })

  it('discard from each copy state', async () => {
    const w = writes()
    const states = ['approved', 'draft', 'changes_requested', 'rejected'] as const
    for (const state of states) {
      const title = uniq(`Discard ${state}`)
      const id = await live(title)
      if (state !== 'approved') {
        await w.edit('articles', id, { title: `${title}, edited` })
        if (state !== 'draft') {
          await w.submit('articles', id, 'changes')
          await w.decide('articles', id, state)
        }
      }
      const before = inbox.sent.length

      expect(await ownerMove(payload, owner, target(id), { move: 'discard' })).toMatchObject({
        ok: true,
      })

      expect(await publicTitle(id), state).toBe(title)
      expect(await keyOf(id), state).toBe('published')
      expect(inbox.sent.length, state).toBe(before)
      expect(
        (await historyOf(id)).filter((event) => event.actor === owner.id),
        state,
      ).toMatchObject(
        state === 'changes_requested' || state === 'rejected'
          ? [{ from: state, to: 'draft', request: 'changes', note: null }]
          : [],
      )
    }
  })

  it('discard, then restore them', async () => {
    const w = writes()
    const title = uniq('Restore')
    const id = await live(title)
    await w.edit('articles', id, { title: `${title}, edited` })
    await payload.update({
      collection: 'articles',
      id,
      data: { title: `${title}, تعديل` },
      draft: true,
      locale: 'ar',
      overrideAccess: true,
    })
    for (const locale of ['en', 'ar'] as const) {
      await payload.update({
        collection: 'articles',
        id,
        data: { body: lexical(`Body ${locale}`) } as never,
        draft: true,
        locale,
        overrideAccess: true,
      })
    }
    const { version: editedVersion } = await latestVersion(id)
    const edited = editedVersion.title
    const editedBody = editedVersion.body
    expect(editedBody).toMatchObject({ en: expect.anything(), ar: expect.anything() })
    const before = inbox.sent.length

    const discarded = await ownerMove(payload, owner, target(id), { move: 'discard' })
    expect(discarded).toMatchObject({ ok: true })
    expect(await keyOf(id)).toBe('published')

    if (!discarded.ok || discarded.restoreFrom === undefined) throw new Error('no restoreFrom')
    expect(
      await ownerMove(payload, owner, target(id), { move: 'restore', from: discarded.restoreFrom }),
    ).toEqual({ ok: true })

    expect(await keyOf(id)).toBe('published_unsent')
    const restored = (await latestVersion(id)).version
    expect(restored.title).toEqual(edited)
    expect(restored.body).toEqual(editedBody)
    expect(inbox.sent.length).toBe(before)
  })

  it('discard, then restore, keeps every locale of a localized array label', async () => {
    const title = uniq('Restore credits')
    const people = [Number(owner.person)]
    const id = await live(title)
    await saveDraft('articles', id, 'en', {
      credits: [{ role: 'editor', label: 'Editor', people }],
    })
    const {
      version: { credits: enOnly },
    } = await latestVersion(id)
    await saveDraft('articles', id, 'ar', {
      credits: [{ id: (enOnly as { id: string }[])[0].id, role: 'editor', label: 'محرر', people }],
    })
    const edited = (await latestVersion(id)).version.credits
    expect(strip(edited)).toMatchObject([{ role: 'editor', label: { en: 'Editor', ar: 'محرر' } }])

    const { afterDiscard, afterRestore } = await discardThenRestore(owner, 'articles', id)

    expect(strip(afterDiscard.credits ?? [])).toEqual([])
    expect(strip(afterRestore.credits)).toEqual(strip(edited))
  })

  it('discard, then restore, keeps every locale of a course with localized blocks', async () => {
    const title = uniq('Restore course')
    const id = await liveCourse(title)
    await saveDraft('courses', id, 'en', {
      title: `${title}, edited`,
      applicant_questions: [{ blockType: 'text', name: 'why', label: 'Why?', required: true }],
    })
    const {
      version: { applicant_questions: enOnly },
    } = await latestOf('courses', id)
    await saveDraft('courses', id, 'ar', {
      title: `${title}, تعديل`,
      applicant_questions: [
        {
          id: (enOnly as { id: string }[])[0].id,
          blockType: 'text',
          name: 'why',
          label: 'لماذا؟',
          required: true,
        },
      ],
    })
    const { version: edited } = await latestOf('courses', id)
    expect(strip(edited.applicant_questions)).toMatchObject([
      { name: 'why', label: { en: 'Why?', ar: 'لماذا؟' } },
    ])
    expect(edited.title).toMatchObject({ en: `${title}, edited`, ar: `${title}, تعديل` })

    const { afterDiscard, afterRestore } = await discardThenRestore(fellow, 'courses', id)

    expect(afterDiscard.title).toMatchObject({ en: title })
    expect((afterDiscard.title as { ar?: string | null }).ar ?? null).toBeNull()
    expect(strip(afterDiscard.applicant_questions ?? [])).toEqual([])
    expect(afterRestore.title).toEqual(edited.title)
    expect(strip(afterRestore.applicant_questions)).toEqual(strip(edited.applicant_questions))
  })

  it('a second locale that fails to write rolls back the first', async () => {
    const title = uniq('Rollback')
    const id = await live(title)
    await saveDraft('articles', id, 'en', { title: `${title}, edited` })
    await saveDraft('articles', id, 'ar', { title: `${title}, تعديل` })
    const before = await latestVersion(id)
    const keyBefore = await keyOf(id)
    const written: string[] = []
    const failArabic: CollectionBeforeChangeHook = ({ data, req }) => {
      if (req.locale) written.push(req.locale)
      if (req.locale === 'ar') throw new APIError('Forced failure in the second locale', 500)
      return data
    }
    const hooks = payload.collections.articles.config.hooks.beforeChange
    hooks.push(failArabic)
    try {
      await expect(
        ownerMove(payload, owner, target(id), { move: 'discard' }),
      ).rejects.toMatchObject({ status: 500 })
    } finally {
      hooks.splice(hooks.indexOf(failArabic), 1)
    }

    expect(written).toEqual(['en', 'ar'])
    const after = await latestVersion(id)
    expect(after.id).toBe(before.id)
    expect(after.version.title).toEqual(before.version.title)
    expect(await keyOf(id)).toBe(keyBefore)
  })

  it('refuses to restore a version of another document', async () => {
    const id = await live(uniq('Restore own'))
    const other = await live(uniq('Restore other'))
    const { id: foreign } = await latestVersion(other)
    expect(await ownerMove(payload, owner, target(id), { move: 'restore', from: foreign })).toEqual(
      { ok: false, reason: 'refused' },
    )
  })

  it('refuses a restore of a version that does not exist', async () => {
    const id = await live(uniq('Restore missing'))
    expect(
      await ownerMove(payload, owner, target(id), { move: 'restore', from: 2_000_000_000 }),
    ).toEqual({ ok: false, reason: 'refused' })
  })

  it('refuses every move to a person who is not an author, and leaks nothing', async () => {
    const title = uniq('Not yours')
    const id = await submittedNew(title)
    const w = writes()
    const other = await live(uniq('Not yours live'))
    await w.edit('articles', other, { title: uniq('Not yours edited') })
    const otherKey = await keyOf(other)
    const moves = [
      { target: target(id), move: { move: 'withdraw' } },
      { target: target(other), move: { move: 'requestRemoval' } },
      { target: target(other), move: { move: 'discard' } },
    ] as const
    for (const { target: t, move } of moves) {
      expect(await ownerMove(payload, stranger, t, move), move.move).toEqual({
        ok: false,
        reason: 'refused',
      })
    }
    expect(await keyOf(id)).toBe('submitted')
    expect(await keyOf(other)).toBe(otherKey)
    expect(await withdrawnNotes(title)).toEqual([])
    expect(await notesAbout(title, owner)).toEqual([])
    expect(await notesAbout(title, stranger)).toEqual([])
  })

  it('a removal request reaches the admins and no one else', async () => {
    const title = uniq('Ask removal')
    const id = await live(title)

    expect(await ownerMove(payload, owner, target(id), { move: 'requestRemoval' })).toEqual({
      ok: true,
    })

    expect(await keyOf(id)).toBe('published_removal')
    const { version } = await latestVersion(id)
    expect(version.review).toMatchObject({ status: 'submitted', request: 'removal' })
    expect(await notesAbout(title, admin)).toHaveLength(1)
    expect(await notesAbout(title, owner)).toEqual([])
    expect(await notesAbout(title, stranger)).toEqual([])
    expect(await withdrawnNotes(title)).toEqual([])
    for (const person of [owner, stranger]) {
      expect(inbox.to(person.email).filter((m) => m.html.includes(title))).toEqual([])
    }
  })

  it('a withdraw notifies the admins and no one else', async () => {
    const title = uniq('Withdraw audience')
    const id = await submittedNew(title)

    expect(await ownerMove(payload, owner, target(id), { move: 'withdraw' })).toEqual({ ok: true })

    expect(await withdrawnNotes(title)).toHaveLength(1)
    expect(await notesAbout(title, owner)).toEqual([])
    expect(await notesAbout(title, stranger)).toEqual([])
  })

  it("an owner's withdraw is refused once an admin decided", async () => {
    const id = await submittedNew(uniq('Decided first'))
    await payload.update({
      collection: 'articles',
      id,
      data: { _status: 'published', review: { status: 'approved' } },
      ...as(admin),
    })

    expect(await ownerMove(payload, owner, target(id), { move: 'withdraw' })).toEqual({
      ok: false,
      reason: 'decided',
    })
  })

  it('a withdraw through REST by the owner is legal', async () => {
    const id = await submittedNew(uniq('Rest withdraw'))
    const body = new FormData()
    body.set('_payload', JSON.stringify({ review: { status: 'draft' } }))

    const response = await rest('PATCH', `articles/${id}`, { token: ownerToken, body })

    expect(response.status).toBe(200)
    expect(await keyOf(id)).toBe('draft')
  })

  it("an owner's approve through REST is still refused", async () => {
    const id = await submittedNew(uniq('Rest approve'))
    const body = new FormData()
    body.set('_payload', JSON.stringify({ review: { status: 'approved' } }))

    const response = await rest('PATCH', `articles/${id}`, { token: ownerToken, body })

    expect(response.status).toBe(403)
    expect(await keyOf(id)).toBe('submitted')
  })

  it('discard reads after the lock', async () => {
    const title = uniq('Lock order')
    const id = await live(title)
    const first = (await latestVersion(id)).id
    const holder = await holdRow(payload, 'articles', id)
    const saved = payload.update({
      collection: 'articles',
      id,
      data: { title: `${title}, W` },
      draft: true,
      ...as(owner),
    })
    void saved.catch(() => {})
    let discarded: ReturnType<typeof ownerMove> | undefined
    try {
      await waitForLockWaiters(payload, holder.pid, 1)
      discarded = ownerMove(payload, owner, target(id), { move: 'discard' })
      void discarded.catch(() => {})
      await waitForLockWaiters(payload, holder.pid, 2)
    } finally {
      await holder.release()
    }
    await saved
    const result = await discarded
    if (!result?.ok || result.restoreFrom === undefined) throw new Error('discard failed')
    expect(result.restoreFrom).not.toBe(first)

    expect(
      await ownerMove(payload, owner, target(id), { move: 'restore', from: result.restoreFrom }),
    ).toEqual({ ok: true })
    const { version } = await latestVersion(id)
    expect(version.title).toMatchObject({ en: `${title}, W` })
  })
})
