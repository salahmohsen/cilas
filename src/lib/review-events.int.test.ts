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

const inbox = resendInbox()
mockNetwork(inbox.handler, ...localServices)

const { track, cleanup } = createTracker()
let payload: Payload
let admin: User
let owner: User
let ownerToken: string
const reviewerName = 'Review Events Reviewer'

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
  admin = await payload.update({
    collection: 'users',
    id: adminAccount.id,
    data: { person: person.id },
    depth: 0,
  })
  const member = await account(payload, track, 'student', 'history-owner')
  const { user, token } = await payload.login({
    collection: 'users',
    data: { email: member.email, password: member.password },
    depth: 0,
  })
  if (!token || !user) throw new Error('No owner session')
  owner = user
  ownerToken = token
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
})
