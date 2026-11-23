import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { waitingApplicantChoices } from '@/forms/applicants'
import { LIVE_COPY } from '@/lib/review-status'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../../testing/local-services.test-utils'
import { mockNetwork } from '../../../testing/msw-node.test-utils'
import { needsWorld, recordingPayload, type NeedsWorld } from '../../../testing/needs.fixture'
import { createTracker, uniq } from '../../../testing/payload.fixture'
import { trustedWrites, writePublishedArticle } from '../../../testing/portal-lists.fixture'
import { portalWorld, type PortalAccount, type PortalWorld } from '../../../testing/portal.fixture'
import { resendInbox } from '../../../testing/resend.test-utils'
import { groupOf } from '../lists/groups'
import { loadList } from '../lists/rows'
import { countsOf, needsTotal, rowsOf, workIn, workSetsOf, type NeedsResult } from './needs'
import { ownRows, ownSet } from './owner-rows'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()

describe('needs', () => {
  let portal: PortalWorld
  let world: NeedsWorld

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    portal = await portalWorld(payload, track)
    world = await needsWorld(payload, track, portal)
  }, 300_000)

  afterAll(async () => {
    await cleanup(payload)
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

  describe('needs and needsCounts', () => {
    const idOf = (href: string) => Number(href.split('/').pop())
    const nobody = { id: -1, roles: ['member'], person: null } as unknown as User

    const idsOf = (result: NeedsResult, collection: string, ids: number[]) =>
      result.rows
        .filter((row) => row.collection === collection && ids.includes(idOf(row.href)))
        .map((row) => idOf(row.href))
        .sort()

    it('two User objects of one account share one read of the work sets', async () => {
      const admin = await userOf(portal.accounts.admin)
      const student = await userOf(portal.accounts.student)
      const store = new Map()
      const first = workIn(store, payload, admin)
      expect(workIn(store, payload, { ...admin })).toBe(first)
      expect(workIn(store, payload, student)).not.toBe(first)
      expect(store.size).toBe(2)
    })

    it('an owner with articles and courses gets one list, oldest first', async () => {
      const fellow = await userOf(portal.accounts.fellow)
      const { create, submit, decide } = trustedWrites(payload, track)
      const article = await create('articles', {
        title: uniq('Fellow article returned'),
        slug: uniq('fellow-article'),
        authors: [portal.accounts.fellow.person],
        tier: 'owner',
        review: { status: 'draft' },
      })
      await submit('articles', article)
      await decide('articles', article, 'changes_requested')
      const { rows } = await rowsOf(payload, fellow, await workSetsOf(payload, fellow), 'en')
      const at = (collection: string, id: number) =>
        rows.findIndex((row) => row.collection === collection && idOf(row.href) === id)
      expect(at('courses', world.fellowCourses.changes_requested)).toBeGreaterThanOrEqual(0)
      expect(at('articles', article)).toBeGreaterThan(
        at('courses', world.fellowCourses.changes_requested),
      )
    })

    it('the rows of needs(admin) hold every fixture document that waits on the admin, plus one applicants row', async () => {
      const admin = await userOf(portal.accounts.admin)
      const result = await rowsOf(payload, admin, await workSetsOf(payload, admin), 'en')
      const waiting = world.adminWaiting
      const fixtureRows = [
        ...(['articles', 'courses', 'publications'] as const).flatMap((collection) =>
          result.rows.filter(
            (row) =>
              row.collection === collection && world.ids[collection].includes(idOf(row.href)),
          ),
        ),
        ...result.rows.filter((row) => row.kind === 'applicants'),
      ]
      const adminWaitingCount =
        waiting.articles.length + waiting.courses.length + waiting.publications.length
      expect(fixtureRows).toHaveLength(adminWaitingCount + 1)
      for (const collection of ['articles', 'courses', 'publications'] as const)
        expect(idsOf(result, collection, world.ids[collection])).toEqual(
          [...waiting[collection]].sort(),
        )
      const applicants = result.rows.filter((row) => row.kind === 'applicants')
      expect(applicants).toHaveLength(1)
      expect(applicants[0]).toMatchObject({ href: '/admin/applicants', collection: null })
      const fixtureApplications = new Set(Object.values(world.applications))
      const waitingFixture = (await waitingApplicantChoices(payload, admin)).filter(
        ({ submission }) => fixtureApplications.has(submission),
      )
      expect(waitingFixture).toHaveLength(2)
      expect(waitingFixture).toEqual(
        expect.arrayContaining([
          { submission: world.applications.course, course: world.fellowCourses.changes_requested },
          { submission: world.applications.course, course: world.fellowCourses.published_removal },
        ]),
      )
      expect(applicants[0]!.count).toBeGreaterThanOrEqual(waitingFixture.length)
    })

    it('names the owner of an article whose person is hidden', async () => {
      const admin = await userOf(portal.accounts.admin)
      const result = await rowsOf(payload, admin, await workSetsOf(payload, admin), 'en')
      const row = result.rows.find(
        (candidate) =>
          candidate.collection === 'articles' && idOf(candidate.href) === world.hiddenOwnerArticle,
      )
      const article = await payload.findByID({
        collection: 'articles',
        id: world.hiddenOwnerArticle,
        depth: 1,
        draft: true,
        overrideAccess: true,
      })
      const names = (article.authors as Array<{ name?: string }>).map((person) => person.name)
      expect(row?.owners).toEqual(names)
    })

    it.each(['admin', 'fellow', 'student'] as const)(
      'countsOf and rowsOf of one WorkSets agree for the %s',
      async (role) => {
        const user = await userOf(portal.accounts[role])
        const sets = await workSetsOf(payload, user)
        const result = await rowsOf(payload, user, sets, 'en')
        const counts = countsOf(sets)
        expect(counts.total).toBe(needsTotal(result))
        if (role !== 'admin') {
          expect(counts.total).toBeGreaterThanOrEqual(1)
          expect(counts.by.ownArticles).toBe(
            result.rows.filter((row) => row.collection === 'articles').length,
          )
        }
      },
    )

    it('a non-admin never reads the admin queue', async () => {
      const adminKeys = new Set(
        Object.entries(world.adminWaiting).flatMap(([collection, ids]) =>
          ids.map((id) => `${collection}:${id}`),
        ),
      )
      const users = [
        await userOf(portal.accounts.student),
        await userOf(portal.accounts.fellow),
        nobody,
        { id: -2, roles: ['Admin'], person: null } as unknown as User,
      ]
      for (const user of users) {
        const { payload: recording, calls } = recordingPayload(payload)
        const sets = await workSetsOf(recording, user)
        const result = await rowsOf(recording, user, sets, 'en')
        expect(sets.reviewQueue).toBeUndefined()
        expect(sets.applicants).toBeUndefined()
        for (const row of result.rows)
          expect(adminKeys.has(`${row.collection}:${idOf(row.href)}`)).toBe(false)
        for (const call of calls) expect(call.args.overrideAccess).not.toBe(true)
      }
    })

    it('rowsOf reads no work set', async () => {
      const empty = recordingPayload(payload)
      await rowsOf(empty.payload, nobody, { failed: [] }, 'en')
      expect(empty.calls).toHaveLength(0)
      for (const account of [portal.accounts.admin, portal.accounts.student]) {
        const user = await userOf(account)
        const sets = await workSetsOf(payload, user)
        const { payload: recording, calls } = recordingPayload(payload)
        await rowsOf(recording, user, sets, 'en')
        for (const call of calls) {
          expect(call.args.select).not.toEqual({ id: true })
          if (call.method === 'findVersions')
            expect(call.args.where).toEqual({
              and: [{ parent: { in: expect.any(Array) } }, { latest: { equals: true } }],
            })
        }
      }
    })

    it('a source that fails leaves the others', async () => {
      const admin = await userOf(portal.accounts.admin)
      const { payload: refusing } = recordingPayload(
        payload,
        (call) => call.method === 'find' && call.args.collection === 'form-submissions',
      )
      const sets = await workSetsOf(refusing, admin)
      const result = await rowsOf(refusing, admin, sets, 'en')
      expect(sets.failed).toEqual(['applicants'])
      expect(result.failed).toEqual(['applicants'])
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.rows.some((row) => row.kind === 'applicants')).toBe(false)
      expect(needsTotal(result)).toBeNull()
      expect(countsOf(sets).total).toBeNull()
    })

    it('a publication with changes requested is not in needs(owner)', async () => {
      const student = portal.accounts.student.person!
      const id = track(
        'publications',
        await payload.create({
          collection: 'publications',
          data: {
            title: uniq('Needs returned publication'),
            slug: uniq('needs-returned-publication'),
            kind: 'other',
            editors: [student],
            review: { status: 'draft' },
          },
          overrideAccess: true,
        }),
      ).id
      await payload.update({
        collection: 'publications',
        id,
        data: { _status: 'draft', review: { status: 'submitted' } } as never,
        overrideAccess: true,
      })
      await payload.update({
        collection: 'publications',
        id,
        data: {
          _status: 'draft',
          review: { status: 'changes_requested', review_note: 'A note' },
        } as never,
        overrideAccess: true,
      })
      const user = await userOf(portal.accounts.student)
      const result = await rowsOf(payload, user, await workSetsOf(payload, user), 'en')
      expect(result.rows.every((row) => row.collection !== 'publications')).toBe(true)
    })
  })
})
