import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ownsViaAuthors } from '@/access'
import {
  ADMIN_LIST_KEYS,
  candidateIds,
  keyedRows,
  keyOrNull,
  waitingSet,
} from '@/lib/review-candidates'
import { ADMIN_VISIBLE, LIVE_MAIN, type StatusInput } from '@/lib/review-status'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { needsWorld, type NeedsWorld } from '../../testing/needs.fixture'
import { createTracker } from '../../testing/payload.fixture'
import { holdSpacesMode, portalWorld } from '../../testing/portal.fixture'
import { resendInbox } from '../../testing/resend.test-utils'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()

describe('the candidate reader', () => {
  let world: NeedsWorld
  let student: User
  let spaces: Awaited<ReturnType<typeof holdSpacesMode>>

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    spaces = await holdSpacesMode(payload)
    await spaces.set('on')
    const portal = await portalWorld(payload, track)
    world = await needsWorld(payload, track, portal)
    student = (await payload.findByID({
      collection: 'users',
      id: portal.accounts.student.id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as User
  }, 300_000)

  afterAll(async () => {
    await cleanup(payload)
    await spaces.release()
    await payload.destroy()
  })

  const nothing = { select: { main: {}, version: {} }, read: 'keys' } as const

  it('a main candidate outside base is out of scope', async () => {
    const ctx = { payload, user: null, collection: 'articles', base: LIVE_MAIN } as const
    const id = world.lists.articles.submitted
    expect((await keyedRows(ctx, [id], nothing)).has(id)).toBe(false)
    const set = await waitingSet(ctx, { side: 'admin', keys: ['submitted'] })
    expect(set.has(id)).toBe(false)
  })

  it('a not-live version parent is no candidate', async () => {
    const ctx = { payload, user: null, collection: 'articles', base: ADMIN_VISIBLE } as const
    const ids = await candidateIds(ctx, ADMIN_LIST_KEYS)
    const { notLive } = world
    expect(ids).toContain(notLive.takenDownResubmitted)
    expect(ids).toContain(notLive.changesRequestedCopySubmitted)
    expect(ids).not.toContain(notLive.rejectedCopySubmitted)
    expect(ids).not.toContain(notLive.takenDownCopySubmitted)
  })

  it('a null key is out of the set', async () => {
    const base = ownsViaAuthors(student)
    if (base === false) throw new Error('the world student has no person')
    const ctx = { payload, user: student, collection: 'articles', base } as const
    const id = world.lists.articles.published_unsent
    const rows = await keyedRows(ctx, [id], nothing)
    expect(rows.get(id)?.key).toBeNull()
    const keys = ['submitted', 'changes_requested', 'published_unsent'] as const
    expect(await candidateIds(ctx, keys)).toContain(id)
    const set = await waitingSet(ctx, { side: 'owner', keys })
    expect(set.has(id)).toBe(false)
    expect(set.get(world.lists.articles.changes_requested)).toBe('changes_requested')
  })

  describe('keyOrNull', () => {
    const live = { id: 1, _status: 'published', updatedAt: '2026-01-01T00:00:00.000Z' } as const

    it('gives null for a row that needs a field compare', () => {
      const input = {
        collection: 'articles',
        doc: live,
        draft: { ...live, _status: 'draft', review: { status: null } },
        read: 'keys',
      } satisfies StatusInput
      expect(keyOrNull(input)).toBeNull()
    })

    it('rethrows an error that is not the keys-read error', () => {
      const input = { collection: 'articles', doc: undefined, draft: null, read: 'keys' }
      expect(() => keyOrNull(input as unknown as StatusInput)).toThrow(TypeError)
    })
  })
})
