import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { createTracker, uniq } from '../../testing/payload.fixture'
import { rest } from '../../testing/payload-rest.test-utils'
import { trustedWrites, writePublishedArticle } from '../../testing/portal-lists.fixture'
import { account } from '../../testing/portal.fixture'
import { resendInbox } from '../../testing/resend.test-utils'
import { ownerMove } from './owner-moves'
import type { ReviewState } from './review'
import { reviewHistoryFor } from './review-history'

const inbox = resendInbox()
mockNetwork(inbox.handler, ...localServices)

const { track, cleanup } = createTracker()
let payload: Payload
let admin: User
let adminToken: string
let owner: User
let ownerToken: string
let other: User
const reviewerName = 'Review Events Reviewer'
const reviewerArabicName = 'مراجع سجل المراجعة'

const session = async ({ email, password }: { email: string; password: string }) => {
  const { user, token } = await payload.login({
    collection: 'users',
    data: { email, password },
    depth: 0,
  })
  if (!token || !user) throw new Error(`No session for ${email}`)
  return { user, token }
}

beforeAll(async () => {
  payload = await getPayload({ config })
  const adminAccount = await account(payload, track, 'admin', 'history-admin')
  const person = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name: reviewerName, slug: uniq('history-reviewer') },
    }),
  )
  await payload.update({
    collection: 'people',
    id: person.id,
    data: { name: reviewerArabicName },
    locale: 'ar',
  })
  admin = await payload.update({
    collection: 'users',
    id: adminAccount.id,
    data: { person: person.id },
    depth: 0,
  })
  adminToken = (await session(adminAccount)).token
  const member = await account(payload, track, 'student', 'history-owner')
  ;({ user: owner, token: ownerToken } = await session(member))
  const stranger = await account(payload, track, 'student', 'history-other')
  other = await payload.findByID({ collection: 'users', id: stranger.id, depth: 0 })
})

afterAll(async () => {
  if (!payload) return
  await cleanup(payload)
  await payload.destroy()
})

const draftArticle = (label: string) =>
  trustedWrites(payload, track).create('articles', {
    title: uniq(label),
    slug: uniq(label),
    authors: [owner.person],
    tier: 'owner',
    review: { status: 'draft' },
  })

const moveArticle = (id: number, user: User, status: ReviewState, review_note?: string) =>
  payload.update({
    collection: 'articles',
    id,
    data: { review: { status, review_note } },
    user,
    overrideAccess: false,
    depth: 0,
  })

const eventsOf = async (id: number) => {
  const { docs } = await payload.find({
    collection: 'review-events',
    where: { collection: { equals: 'articles' }, doc: { equals: id } },
    sort: ['at', 'id'],
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return docs.map((doc) => track('review-events', doc))
}

const sixMoves = async (id: number) => {
  const nextSecond = (Math.floor(Date.now() / 1000) + 1) * 1000
  const moves = [
    [owner, 'submitted'],
    [admin, 'changes_requested', 'Clarify the first paragraph.'],
    [owner, 'submitted'],
    [admin, 'changes_requested', 'Clarify the conclusion.'],
    [owner, 'submitted'],
    [admin, 'approved'],
  ] as const
  try {
    for (const [index, [user, status, note]] of moves.entries()) {
      vi.setSystemTime(nextSecond + index)
      await moveArticle(id, user, status, note)
    }
  } finally {
    vi.useRealTimers()
  }
}

const liveCopyAt = async (state: 'approved' | 'draft' | 'changes_requested' | 'rejected') => {
  const writes = trustedWrites(payload, track)
  const title = uniq(`review-event-copy-${state}`)
  const id = await writePublishedArticle(writes.create, Number(owner.person), title)
  if (state === 'approved') return id
  await writes.edit('articles', id, { title: `${title}, edited` })
  if (state === 'draft') return id
  await writes.submit('articles', id, 'changes')
  await writes.decide('articles', id, state)
  return id
}

const rowsAddedBy = async (id: number, run: () => Promise<unknown>) => {
  const before = (await eventsOf(id)).length
  await run()
  return (await eventsOf(id)).slice(before)
}

const ADMIN_FORM_SAVES = {
  approved: { _status: 'published', status: 'approved' },
  changes_requested: { _status: 'draft', status: 'changes_requested' },
  rejected: { _status: 'draft', status: 'rejected' },
  removed: { _status: 'draft', status: 'draft' },
} as const

const decideAsForm = (id: number, decision: keyof typeof ADMIN_FORM_SAVES, note: string | null) =>
  payload.update({
    collection: 'articles',
    id,
    data: {
      _status: ADMIN_FORM_SAVES[decision]._status,
      review: { status: ADMIN_FORM_SAVES[decision].status, review_note: note },
    },
    user: admin,
    overrideAccess: false,
    depth: 0,
  })

const patchArticle = async (id: number, token: string, query: string, data: object) => {
  const body = new FormData()
  body.set('_payload', JSON.stringify(data))
  const response = await rest('PATCH', `articles/${id}?${query}`, { token, body })
  expect(response.status).toBe(200)
}

const autosave = (id: number, title: string) =>
  payload.update({
    collection: 'articles',
    id,
    draft: true,
    autosave: true,
    data: { title },
    user: owner,
    overrideAccess: false,
    depth: 0,
  })

const latestVersionOf = async (id: number) => {
  const { docs } = await payload.findVersions({
    collection: 'articles',
    where: { parent: { equals: id }, latest: { equals: true } },
    limit: 1,
    depth: 0,
  })
  return docs[0]!
}

const asOwner = (id: number, move: 'withdraw' | 'requestRemoval' | 'discard') => async () =>
  expect(await ownerMove(payload, owner, { collection: 'articles', id }, { move })).toMatchObject({
    ok: true,
  })

describe('review-events: history', () => {
  it('six moves give six rows in order with distinct version ids', async () => {
    const id = await draftArticle('six-review-moves')
    await sixMoves(id)

    const events = await eventsOf(id)
    expect(events.map(({ from, to, note }) => [from, to, note])).toEqual([
      ['draft', 'submitted', null],
      ['submitted', 'changes_requested', 'Clarify the first paragraph.'],
      ['changes_requested', 'submitted', null],
      ['submitted', 'changes_requested', 'Clarify the conclusion.'],
      ['changes_requested', 'submitted', null],
      ['submitted', 'approved', null],
    ])
    const { docs: versions } = await payload.findVersions({
      collection: 'articles',
      where: { parent: { equals: id } },
      depth: 0,
      pagination: false,
      sort: 'id',
    })
    expect(events.map((event) => event.version)).toEqual(versions.slice(1).map(({ id }) => id))
    expect(new Set(events.map((event) => event.version)).size).toBe(6)
    expect(new Set(events.map((event) => event.at.slice(0, 19))).size).toBe(1)
  })

  it('the owner reads the history; another member reads none', async () => {
    const id = await draftArticle('review-event-readers')
    await sixMoves(id)
    const ownerName = (await payload.findByID({ collection: 'people', id: Number(owner.person) }))
      .name

    const rows = await reviewHistoryFor(payload, 'articles', id, owner, 'en')
    const at = expect.any(String)
    const sent = (from: ReviewState) => ({
      at,
      from,
      to: 'submitted',
      request: null,
      note: null,
      actorName: ownerName,
    })
    const decided = (to: ReviewState, note: string | null) => ({
      at,
      from: 'submitted',
      to,
      request: null,
      note,
      actorName: reviewerName,
    })
    expect(rows).toStrictEqual([
      sent('draft'),
      decided('changes_requested', 'Clarify the first paragraph.'),
      sent('changes_requested'),
      decided('changes_requested', 'Clarify the conclusion.'),
      sent('changes_requested'),
      decided('approved', null),
    ])
    expect(rows.map((row) => row.at)).toEqual(rows.map((row) => row.at).toSorted())

    expect(
      (await payload.findByID({ collection: 'articles', id, user: other, overrideAccess: false }))
        .id,
    ).toBe(id)
    expect(await reviewHistoryFor(payload, 'articles', id, other, 'en')).toEqual([])
    expect(
      await reviewHistoryFor(payload, 'articles', id, { ...other, person: null }, 'en'),
    ).toEqual([])
  })

  it('a move by the server has no actor name', async () => {
    const id = await liveCopyAt('approved')

    expect(await reviewHistoryFor(payload, 'articles', id, owner, 'en')).toMatchObject([
      { from: 'draft', to: 'approved', actorName: null },
    ])
  })

  it('a REST read of review-events as a member returns no docs', async () => {
    const response = await rest('GET', 'review-events', { token: ownerToken })
    if (response.status === 403) return
    expect(response.status).toBe(200)
    expect((await response.json()).docs).toEqual([])
  })

  it('an autosave and a save that keeps the status read no version and write no row', async () => {
    const id = await draftArticle('review-event-autosave')
    const findVersions = vi.spyOn(payload, 'findVersions')
    try {
      await payload.update({
        collection: 'articles',
        id,
        draft: true,
        autosave: true,
        data: { title: 'Autosaved title', review: { status: 'submitted' } },
        user: owner,
        overrideAccess: false,
        depth: 0,
      })
      await moveArticle(id, owner, 'draft')
      expect(findVersions).not.toHaveBeenCalled()
      await moveArticle(id, owner, 'submitted')
      expect(findVersions).toHaveBeenCalledTimes(1)
    } finally {
      findVersions.mockRestore()
    }
    expect(await eventsOf(id)).toMatchObject([{ from: 'draft', to: 'submitted' }])
  })

  it('submit tells the admins and writes one row with no note', async () => {
    const label = 'review-event-submit'
    const id = await draftArticle(label)
    await moveArticle(id, owner, 'submitted', 'This is not a decision note.')

    expect(inbox.to(admin.email).filter((mail) => mail.html.includes(uniq(label)))).toHaveLength(1)
    expect(await eventsOf(id)).toMatchObject([
      { from: 'draft', to: 'submitted', note: null, actor: owner.id },
    ])
  })

  it('a withdrawn new submission writes one row with no note', async () => {
    const id = await draftArticle('review-event-withdraw')
    await moveArticle(id, owner, 'submitted')

    expect(await rowsAddedBy(id, asOwner(id, 'withdraw'))).toMatchObject([
      { from: 'submitted', to: 'draft', request: null, note: null, actor: owner.id },
    ])
  })

  it('a withdrawn removal request writes one row that keeps the request', async () => {
    const id = await liveCopyAt('approved')
    await asOwner(id, 'requestRemoval')()

    expect(await rowsAddedBy(id, asOwner(id, 'withdraw'))).toMatchObject([
      { from: 'submitted', to: 'draft', request: 'removal', note: null, actor: owner.id },
    ])
  })

  it('discard writes one row from a returned or declined copy and none from another', async () => {
    for (const state of ['changes_requested', 'rejected', 'approved', 'draft'] as const) {
      const id = await liveCopyAt(state)
      const rows = await rowsAddedBy(id, asOwner(id, 'discard'))
      expect(
        rows.map(({ from, to, note, actor }) => ({ from, to, note, actor })),
        state,
      ).toEqual(
        state === 'changes_requested' || state === 'rejected'
          ? [{ from: state, to: 'draft', note: null, actor: owner.id }]
          : [],
      )
    }
  })

  it('a removed author reads no history; the other author and an admin read all of it', async () => {
    const id = await draftArticle('review-event-removed-author')
    await payload.update({
      collection: 'articles',
      id,
      data: { authors: [Number(owner.person), Number(other.person)] },
      depth: 0,
    })
    await moveArticle(id, owner, 'submitted')
    await moveArticle(id, admin, 'changes_requested', 'Two authors read this.')
    expect(await reviewHistoryFor(payload, 'articles', id, other, 'en')).toHaveLength(2)

    await payload.update({
      collection: 'articles',
      id,
      data: { authors: [Number(owner.person)] },
      user: admin,
      overrideAccess: false,
      depth: 0,
    })
    await moveArticle(id, owner, 'submitted')

    expect(await reviewHistoryFor(payload, 'articles', id, other, 'en')).toEqual([])
    expect(await reviewHistoryFor(payload, 'articles', id, owner, 'en')).toHaveLength(3)
    expect(await reviewHistoryFor(payload, 'articles', id, admin, 'en')).toHaveLength(3)
  })

  it('actor names come in the locale of the read', async () => {
    const id = await draftArticle('review-event-actor-locale')
    await moveArticle(id, owner, 'submitted')
    await moveArticle(id, admin, 'changes_requested', 'A note.')

    for (const [locale, name] of [
      ['en', reviewerName],
      ['ar', reviewerArabicName],
    ] as const) {
      const rows = await reviewHistoryFor(payload, 'articles', id, owner, locale)
      expect(rows[1]?.actorName, locale).toBe(name)
    }
  })

  it('an owner submit with ?select= writes the submit row', async () => {
    const id = await draftArticle('review-event-select-submit')

    const rows = await rowsAddedBy(id, () =>
      patchArticle(id, ownerToken, 'select[title]=true', { review: { status: 'submitted' } }),
    )
    expect(rows).toMatchObject([{ from: 'draft', to: 'submitted', actor: owner.id }])
  })

  it('an admin decision with ?select= writes the decision row with its note', async () => {
    const id = await draftArticle('review-event-select-decide')
    await moveArticle(id, owner, 'submitted')

    const rows = await rowsAddedBy(id, () =>
      patchArticle(id, adminToken, 'select[title]=true', {
        review: { status: 'changes_requested', review_note: 'Sent with a select.' },
      }),
    )
    expect(rows).toMatchObject([
      {
        from: 'submitted',
        to: 'changes_requested',
        note: 'Sent with a select.',
        actor: admin.id,
      },
    ])
  })

  it('an edit with ?select= that keeps the status writes no row', async () => {
    const id = await draftArticle('review-event-select-edit')
    await moveArticle(id, owner, 'submitted')
    await moveArticle(id, admin, 'changes_requested', 'Edit this.')

    const rows = await rowsAddedBy(id, () =>
      patchArticle(id, ownerToken, 'select[review]=false', { title: uniq('select-edited') }),
    )
    expect(rows).toEqual([])
  })

  it('a submit with ?autosave=true and no draft writes one row and its own version', async () => {
    const id = await draftArticle('review-event-autosave-submit')
    await autosave(id, uniq('autosaved-before-submit'))
    const autosaved = await latestVersionOf(id)
    expect(autosaved).toMatchObject({ autosave: true })

    const rows = await rowsAddedBy(id, () =>
      patchArticle(id, ownerToken, 'autosave=true', { review: { status: 'submitted' } }),
    )
    expect(rows).toMatchObject([{ from: 'draft', to: 'submitted' }])
    expect(rows[0]!.version).not.toBe(autosaved.id)
    expect(rows[0]!.version).toBe((await latestVersionOf(id)).id)
  })

  it('an owner submit with ?unpublishAllLocales=true keeps the version of the earlier row', async () => {
    const id = await draftArticle('review-event-unpublish-flag')
    await moveArticle(id, owner, 'submitted')
    const [returned] = await rowsAddedBy(id, () =>
      moveArticle(id, admin, 'changes_requested', 'Edit this.'),
    )

    const rows = await rowsAddedBy(id, () =>
      patchArticle(id, ownerToken, 'unpublishAllLocales=true', {
        title: uniq('resubmitted'),
        review: { status: 'submitted' },
      }),
    )
    expect(rows).toMatchObject([{ from: 'changes_requested', to: 'submitted' }])
    expect(rows[0]!.version).not.toBe(returned!.version)
    expect(rows[0]!.version).toBe((await latestVersionOf(id)).id)
  })

  it('an admin removal with ?unpublishAllLocales=true unpublishes and keeps the submitted version', async () => {
    const id = await liveCopyAt('approved')
    const [submitted] = await rowsAddedBy(id, asOwner(id, 'requestRemoval'))

    const rows = await rowsAddedBy(id, () =>
      patchArticle(id, adminToken, 'unpublishAllLocales=true', {
        _status: 'draft',
        review: { status: 'draft', review_note: 'Taken down as asked.' },
      }),
    )
    expect(rows).toMatchObject([{ from: 'submitted', to: 'draft', request: 'removal' }])
    expect(rows[0]!.version).not.toBe(submitted!.version)
    expect(rows[0]!.version).toBe((await latestVersionOf(id)).id)
    expect(await payload.findByID({ collection: 'articles', id, depth: 0 })).toMatchObject({
      _status: 'draft',
    })
  })

  it('an admin Unpublish takes a live article down while its unfinished draft has no title', async () => {
    const id = await liveCopyAt('approved')
    await autosave(id, '')
    const unfinished = await latestVersionOf(id)

    await patchArticle(id, adminToken, 'unpublishAllLocales=true', { _status: 'draft' })
    expect(await payload.findByID({ collection: 'articles', id, depth: 0 })).toMatchObject({
      _status: 'draft',
    })
    const kept = await payload.findVersionByID({
      collection: 'articles',
      id: unfinished.id,
      depth: 0,
    })
    expect(kept.version).toEqual(unfinished.version)
    const { docs: latest } = await payload.findVersions({
      collection: 'articles',
      where: { parent: { equals: id }, latest: { equals: true } },
      depth: 0,
    })
    expect(latest).toHaveLength(1)
    expect(latest[0]!.id).not.toBe(unfinished.id)
  })

  it('an owner cannot submit an unfinished draft with ?unpublishAllLocales=true', async () => {
    const id = await draftArticle('review-event-unfinished-submit')
    await autosave(id, '')

    const body = new FormData()
    body.set('_payload', JSON.stringify({ review: { status: 'submitted' } }))
    const response = await rest('PATCH', `articles/${id}?unpublishAllLocales=true`, {
      token: ownerToken,
      body,
    })
    expect(response.status).toBe(400)
    expect(await eventsOf(id)).toEqual([])
  })

  it('a new submission clears the old note, so no later row repeats it', async () => {
    const id = await draftArticle('review-event-old-note')
    await moveArticle(id, owner, 'submitted')
    await decideAsForm(id, 'changes_requested', 'An old note.')
    await moveArticle(id, owner, 'submitted')

    const stored = (await latestVersionOf(id)).version.review?.review_note ?? null
    expect(stored).toBeNull()

    const rows = await rowsAddedBy(id, () => decideAsForm(id, 'approved', stored))
    expect(rows).toMatchObject([{ from: 'submitted', to: 'approved', note: null }])
  })

  it('declining, keeping and removing each record the note', async () => {
    const declined = await draftArticle('review-event-note-declined')
    await moveArticle(declined, owner, 'submitted')
    expect(
      await rowsAddedBy(declined, () => decideAsForm(declined, 'rejected', 'Not for us.')),
    ).toMatchObject([{ from: 'submitted', to: 'rejected', note: 'Not for us.' }])

    for (const [decision, to, note] of [
      ['rejected', 'rejected', 'It stays on the site.'],
      ['removed', 'draft', 'Taken down as asked.'],
    ] as const) {
      const id = await liveCopyAt('approved')
      await asOwner(id, 'requestRemoval')()
      expect(await rowsAddedBy(id, () => decideAsForm(id, decision, note)), decision).toMatchObject(
        [{ from: 'submitted', to, request: 'removal', note }],
      )
    }
  })

  it('a publish of one locale records a version that is not the snapshot', async () => {
    const id = await liveCopyAt('approved')
    await trustedWrites(payload, track).edit('articles', id, { title: uniq('one-locale-edit') })
    await trustedWrites(payload, track).submit('articles', id, 'changes')

    const rows = await rowsAddedBy(id, () =>
      payload.update({
        collection: 'articles',
        id,
        data: { _status: 'published', review: { status: 'approved' } },
        publishSpecificLocale: 'en',
        user: admin,
        overrideAccess: false,
        depth: 0,
      }),
    )
    const { docs: versions } = await payload.db.findVersions<{ id: number }>({
      collection: 'articles',
      where: { parent: { equals: id } },
      pagination: false,
    })
    const snapshots = versions
      .filter((version) => (version as { snapshot?: boolean }).snapshot)
      .map((version) => Number(version.id))
    expect(snapshots).toHaveLength(1)
    expect(rows).toMatchObject([{ from: 'submitted', to: 'approved' }])
    expect(versions.map((version) => Number(version.id))).toContain(rows[0]!.version)
    expect(snapshots).not.toContain(rows[0]!.version)
  })

  it('a spec cleanup removes the history rows of the documents it deletes', async () => {
    const spec = createTracker()
    const id = await trustedWrites(payload, spec.track).create('articles', {
      title: uniq('review-event-cleanup'),
      slug: uniq('review-event-cleanup'),
      authors: [owner.person],
      tier: 'owner',
      review: { status: 'draft' },
    })
    await moveArticle(id, owner, 'submitted')
    const rows = () =>
      payload.count({
        collection: 'review-events',
        where: { collection: { equals: 'articles' }, doc: { equals: id } },
      })
    expect(await rows()).toEqual({ totalDocs: 1 })

    await spec.cleanup(payload)
    expect(await rows()).toEqual({ totalDocs: 0 })
  })

  it('an admin cannot create, change or delete a row through REST', async () => {
    const id = await draftArticle('review-event-rest-writes')
    await moveArticle(id, owner, 'submitted')
    const [row] = await eventsOf(id)
    const json = (data: object) => {
      const body = new FormData()
      body.set('_payload', JSON.stringify(data))
      return body
    }

    const created = await rest('POST', 'review-events', {
      token: adminToken,
      body: json({
        collection: 'articles',
        doc: id,
        from: 'draft',
        to: 'approved',
        at: new Date().toISOString(),
      }),
    })
    const changed = await rest('PATCH', `review-events/${row!.id}`, {
      token: adminToken,
      body: json({ note: 'Forged.' }),
    })
    const deleted = await rest('DELETE', `review-events/${row!.id}`, { token: adminToken })

    expect([created.status, changed.status, deleted.status]).toEqual([403, 403, 403])
    expect(await eventsOf(id)).toMatchObject([{ id: row!.id, note: null }])
  })
})
