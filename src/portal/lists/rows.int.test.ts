import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  statusInputOf,
  statusOf,
  STATUS_KEYS,
  type ReviewedDoc,
  type StatusKey,
} from '@/lib/review-status'
import type { ReviewedCollection } from '@/lib/reviewed-fields'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../../testing/local-services.test-utils'
import { mockNetwork } from '../../../testing/msw-node.test-utils'
import { createTracker, uniq } from '../../../testing/payload.fixture'
import { resendInbox } from '../../../testing/resend.test-utils'
import { listWorld, type ListWorld } from '../../../testing/portal-lists.fixture'
import { portalWorld, type PortalAccount, type PortalWorld } from '../../../testing/portal.fixture'

import { listKindOf, loadList, type ListGroup, type ListQuery } from './rows'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()

describe('list rows', () => {
  let world: PortalWorld
  let lists: ListWorld

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    world = await portalWorld(payload, track)
    lists = await listWorld(payload, track, world)
  }, 300_000)

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  const keyOf = async (collection: ReviewedCollection, id: number) => {
    const main = await payload.findByID({
      collection: collection as 'articles',
      id,
      draft: false,
      locale: 'all',
      depth: 0,
      overrideAccess: true,
    })
    const { docs } = await payload.findVersions({
      collection: collection as 'articles',
      where: { parent: { equals: id }, latest: { equals: true } },
      sort: '-updatedAt',
      limit: 1,
      locale: 'all',
      depth: 0,
      overrideAccess: true,
    })
    const version = docs[0]
    return statusOf(
      statusInputOf({
        collection,
        main: main as unknown as ReviewedDoc,
        latest: version ? ({ ...version.version, id } as unknown as ReviewedDoc) : null,
        read: 'full',
      }),
      () => undefined,
    )
  }

  const userOf = async (account: PortalAccount) =>
    (await payload.findByID({
      collection: 'users',
      id: account.id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as User

  const ownerArticles = (overrides: Partial<ListQuery> = {}) =>
    ({
      collection: 'articles',
      kind: 'ownerArticles',
      search: null,
      only: null,
      pages: {},
      ...overrides,
    }) satisfies ListQuery

  const rowsOf = (groups: ListGroup[]) => groups.flatMap((group) => group.rows)

  const groupOfId = (groups: ListGroup[], id: number) =>
    groups.filter((group) => group.rows.some((row) => row.id === id)).map((group) => group.id)

  describe('the fixture', () => {
    it('listWorld makes each article key', async () => {
      expect(lists.bulk).toHaveLength(60)
      const keys = {} as Record<StatusKey, StatusKey>
      for (const key of STATUS_KEYS) keys[key] = await keyOf('articles', lists.articles[key])
      expect(keys).toEqual(Object.fromEntries(STATUS_KEYS.map((key) => [key, key])))
      expect(await keyOf('articles', lists.unpublished)).toBe('draft')
      for (const id of lists.manyDrafts) expect(await keyOf('articles', id)).toBe('draft')
      expect(lists.manyDrafts).toHaveLength(11)

      const { docs } = await payload.find({
        collection: 'articles',
        where: { id: { in: [...lists.bulk, ...Object.values(lists.articles)] } },
        draft: false,
        pagination: false,
        depth: 0,
        select: { updatedAt: true },
        overrideAccess: true,
      })
      const updated = new Map(docs.map((doc) => [doc.id, doc.updatedAt]))
      const newestBulk = Math.max(...lists.bulk.map((id) => Date.parse(updated.get(id)!)))
      Object.values(lists.articles).forEach((id) =>
        expect(Date.parse(updated.get(id)!)).toBeGreaterThanOrEqual(newestBulk),
      )
    })

    it('listWorld makes the courses and the accounts', async () => {
      const { courses } = lists
      expect({
        published_edits: await keyOf('courses', courses.published_edits),
        published_edits_returned: await keyOf('courses', courses.published_edits_returned),
        draft: await keyOf('courses', courses.draft),
        rejected: await keyOf('courses', courses.rejected),
        submittedWithSpace: await keyOf('courses', courses.submittedWithSpace),
        rejectedWithSpace: await keyOf('courses', courses.rejectedWithSpace),
      }).toEqual({
        published_edits: 'published_edits',
        published_edits_returned: 'published_edits_returned',
        draft: 'draft',
        rejected: 'rejected',
        submittedWithSpace: 'submitted',
        rejectedWithSpace: 'rejected',
      })

      const spaces = await payload.find({
        collection: 'spaces',
        where: { course: { in: Object.values(courses) } },
        depth: 0,
        pagination: false,
        select: { course: true },
        overrideAccess: true,
      })
      const spaced = spaces.docs.map((doc) => doc.course as number).sort()
      expect(spaced).toEqual(
        [
          courses.published_edits,
          courses.published_edits_returned,
          courses.submittedWithSpace,
          courses.rejectedWithSpace,
        ].sort(),
      )

      const sessions = await payload.count({
        collection: 'sessions',
        where: { course: { equals: courses.published_edits } },
        overrideAccess: true,
      })
      expect(sessions.totalDocs).toBe(12)
      expect(lists.teacher.person).not.toBeNull()
      expect(lists.writer.person).not.toBeNull()
    })
  })

  describe('the base where', () => {
    it('a student sees only their own articles', async () => {
      const student = await userOf(world.accounts.student)
      const other = (
        await payload.create({
          collection: 'articles',
          data: {
            title: 'Other author',
            slug: uniq('other-author'),
            authors: [world.poster.person!],
            tier: 'public',
            review: { status: 'approved' },
            _status: 'published',
          },
          overrideAccess: true,
        })
      ).id
      track('articles', other)
      const { groups, total } = await loadList(payload, student, ownerArticles(), 'en')
      const owned = await payload.find({
        collection: 'articles',
        where: { authors: { contains: world.accounts.student.person } },
        draft: false,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
      const ids = new Set(owned.docs.map((doc) => doc.id))
      rowsOf(groups).forEach((row) => expect(ids.has(row.id)).toBe(true))
      expect(rowsOf(groups).some((row) => row.id === other)).toBe(false)
      expect(total).toBe(ids.size)
    })

    it('a reader with no person owns no row', async () => {
      const nobody = { id: -1, roles: ['member'], person: null } as unknown as User
      expect(await loadList(payload, nobody, ownerArticles(), 'en')).toEqual({
        groups: [],
        total: 0,
      })
    })

    it('a co-author added in the copy does not see the row', async () => {
      const poster = await userOf(world.poster)
      const student = await userOf(world.accounts.student)
      const theirs = await loadList(payload, poster, ownerArticles(), 'en')
      expect(groupOfId(theirs.groups, lists.added)).toEqual([])
      const mine = await loadList(payload, student, ownerArticles(), 'en')
      const row = rowsOf(mine.groups).find((candidate) => candidate.id === lists.added)
      expect(row?.key).toBe('published_unsent')
    })

    it('listKindOf gives a kind only for the lists a reader may open', async () => {
      const admin = await userOf(world.accounts.admin)
      const fellow = await userOf(world.accounts.fellow)
      const student = await userOf(world.accounts.student)
      const none = { id: -2, roles: [], person: null } as unknown as User
      expect(listKindOf(admin, 'articles')).toBe('admin')
      expect(listKindOf(admin, 'courses')).toBe('admin')
      expect(listKindOf(fellow, 'articles')).toBe('ownerArticles')
      expect(listKindOf(fellow, 'courses')).toBe('fellowCourses')
      expect(listKindOf(student, 'articles')).toBe('ownerArticles')
      expect(listKindOf(student, 'courses')).toBeNull()
      expect(listKindOf(none, 'articles')).toBeNull()
      expect(listKindOf(none, 'courses')).toBeNull()
    })
  })
})
