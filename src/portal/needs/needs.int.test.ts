import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LIVE_COPY } from '@/lib/review-status'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../../testing/local-services.test-utils'
import { mockNetwork } from '../../../testing/msw-node.test-utils'
import { needsWorld, recordingPayload, type NeedsWorld } from '../../../testing/needs.fixture'
import { createTracker, uniq } from '../../../testing/payload.fixture'
import { trustedWrites, writePublishedArticle } from '../../../testing/portal-lists.fixture'
import {
  holdSpacesMode,
  portalWorld,
  type PortalAccount,
  type PortalWorld,
} from '../../../testing/portal.fixture'
import { resendInbox } from '../../../testing/resend.test-utils'
import { groupOf } from '../lists/groups'
import { loadList } from '../lists/rows'
import { ownRows, ownSet } from './owner-rows'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()

describe('needs', () => {
  let portal: PortalWorld
  let world: NeedsWorld
  let spaces: Awaited<ReturnType<typeof holdSpacesMode>>

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    spaces = await holdSpacesMode(payload)
    await spaces.set('on')
    portal = await portalWorld(payload, track)
    world = await needsWorld(payload, track, portal)
  }, 300_000)

  afterAll(async () => {
    await cleanup(payload)
    await spaces.release()
    await payload.destroy()
  })

  const userOf = async (account: PortalAccount) =>
    (await payload.findByID({
      collection: 'users',
      id: account.id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as User

  describe('the owner sources', () => {
    it("a student's needs hold their changes_requested and returned-edits articles", async () => {
      const set = await ownSet(payload, await userOf(portal.accounts.student), 'articles')
      expect(set.get(world.lists.articles.changes_requested)).toBe('changes_requested')
      expect(set.get(world.lists.articles.published_edits_returned)).toBe(
        'published_edits_returned',
      )
    })

    it("the world fellow's needs hold their changes_requested course", async () => {
      const set = await ownSet(payload, await userOf(portal.accounts.fellow), 'courses')
      expect(set.size).toBeGreaterThanOrEqual(1)
      expect(set.get(world.fellowCourses.changes_requested)).toBe('changes_requested')
    })

    it("an owner's set is their own 1b list's Needs you group", async () => {
      const cases = [
        { account: portal.accounts.student, collection: 'articles', kind: 'ownerArticles' },
        { account: portal.accounts.fellow, collection: 'articles', kind: 'ownerArticles' },
        { account: portal.accounts.fellow, collection: 'courses', kind: 'fellowCourses' },
        { account: world.lists.teacher, collection: 'courses', kind: 'fellowCourses' },
      ] as const
      for (const { account, collection, kind } of cases) {
        const user = await userOf(account)
        const set = await ownSet(payload, user, collection)
        const { groups } = await loadList(
          payload,
          user,
          {
            collection,
            search: null,
            only: null,
            pages: { published: 20, closed: 20, teachingNow: 20 },
          },
          'en',
        )
        const needsYou = groupOf('changes_requested', kind, { hasSpace: false })
        const listed = new Set(groups.find((g) => g.id === needsYou)?.rows.map((row) => row.id))
        for (const id of world.ids[collection])
          expect(listed.has(id), `${account.email} ${collection} ${id}`).toBe(set.has(id))
      }
    })

    it("an owner's set is their own waiting rows only", async () => {
      const loner = await userOf(portal.loners.student)
      const set = await ownSet(payload, loner, 'articles')
      for (const id of world.ids.articles) expect(set.has(id), String(id)).toBe(false)
    })

    it('a co-author removed in the copy has no published_edits_returned row', async () => {
      const { create, edit, submit, decide } = trustedWrites(payload, track)
      const student = portal.accounts.student.person!
      const poster = portal.poster.person!
      const id = await writePublishedArticle(create, student, uniq('Co-authored'), {
        authors: [student, poster],
      })
      await edit('articles', id, { authors: [student], title: uniq('Co-authored, edited') })
      await submit('articles', id, 'changes')
      await decide('articles', id, 'changes_requested')
      expect(
        (await ownSet(payload, await userOf(portal.accounts.student), 'articles')).get(id),
      ).toBe('published_edits_returned')
      expect((await ownSet(payload, await userOf(portal.poster), 'articles')).has(id)).toBe(false)
    })

    it('a declined article is not in needs(owner)', async () => {
      const set = await ownSet(payload, await userOf(portal.accounts.student), 'articles')
      expect(set.has(world.lists.articles.rejected)).toBe(false)
    })

    it('declined edits and a kept removal are not in needs(owner)', async () => {
      const set = await ownSet(payload, await userOf(portal.accounts.student), 'articles')
      expect(set.has(world.lists.articles.published_edits_declined)).toBe(false)
      expect(set.has(world.lists.articles.published_removal_kept)).toBe(false)
    })

    it('unsent edits are not in needs(owner) and do not throw', async () => {
      const set = await ownSet(payload, await userOf(portal.accounts.student), 'articles')
      expect(set.has(world.lists.articles.published_unsent)).toBe(false)
    })

    it("an owner's set reads no all-copies row", async () => {
      for (const account of [portal.accounts.student, portal.accounts.fellow]) {
        const { payload: recording, calls } = recordingPayload(payload)
        const user = await userOf(account)
        await ownSet(recording, user, 'articles')
        await ownSet(recording, user, 'courses')
        const copies = calls.filter((call) => call.method === 'findVersions')
        expect(copies.length).toBeGreaterThan(0)
        for (const call of copies) expect(call.args.where).not.toEqual(LIVE_COPY)
      }
    })

    it('a member with no person has no rows and runs no query', async () => {
      const nobody = { id: -1, roles: ['member'], person: null } as unknown as User
      const { payload: recording, calls } = recordingPayload(payload)
      expect((await ownSet(recording, nobody, 'articles')).size).toBe(0)
      expect((await ownSet(recording, nobody, 'courses')).size).toBe(0)
      expect(await ownRows(recording, nobody, 'articles', new Map(), 'en')).toEqual([])
      expect(calls.filter((call) => call.method === 'find')).toHaveLength(0)
    })
  })
})
