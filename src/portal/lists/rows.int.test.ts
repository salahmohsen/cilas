import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mediaThumbnail } from '@/lib/media-image'
import {
  ADMIN_VISIBLE,
  KEY_WHERE,
  statusInputOf,
  statusOf,
  STATUS_KEYS,
  type ReviewedDoc,
  type StatusKey,
} from '@/lib/review-status'
import type { ReviewedCollection } from '@/lib/reviewed-fields'
import config from '@/payload.config'
import type { Media, User } from '@/payload-types'

import { localServices } from '../../../testing/local-services.test-utils'
import { mockNetwork } from '../../../testing/msw-node.test-utils'
import { createTracker, uniq } from '../../../testing/payload.fixture'
import { resendInbox } from '../../../testing/resend.test-utils'
import { makeMedia } from '../../../testing/media.fixture'
import { listWorld, type ListWorld } from '../../../testing/portal-lists.fixture'
import {
  holdSpacesMode,
  portalWorld,
  type PortalAccount,
  type PortalWorld,
} from '../../../testing/portal.fixture'

import { groupOf } from './groups'
import { loadList, type ListGroup, type ListQuery } from './rows'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()

describe('list rows', () => {
  let world: PortalWorld
  let lists: ListWorld
  let spaces: Awaited<ReturnType<typeof holdSpacesMode>>

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    spaces = await holdSpacesMode(payload)
    await spaces.set('on')
    world = await portalWorld(payload, track)
    lists = await listWorld(payload, track, world)
  }, 300_000)

  afterAll(async () => {
    await cleanup(payload)
    await spaces.release()
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
          courses.othersPublished,
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

    it('a reader who may open no list of the collection gets nothing, before any read', async () => {
      const student = await userOf(world.accounts.student)
      const none = { id: -2, roles: [], person: null } as unknown as User
      const courses = { collection: 'courses', search: null, only: null, pages: {} } as const
      expect(await loadList(payload, student, courses, 'en')).toEqual({ groups: [], total: 0 })
      expect(await loadList(payload, none, courses, 'en')).toEqual({ groups: [], total: 0 })
      expect(await loadList(payload, none, ownerArticles(), 'en')).toEqual({
        groups: [],
        total: 0,
      })
    })
  })

  describe('the owner work set', () => {
    const own = (user: User) => ({ user, overrideAccess: false }) as const

    const thumbnailOf = async (media: Media) =>
      mediaThumbnail(
        (await payload.findByID({
          collection: 'media',
          id: media.id,
          depth: 0,
          overrideAccess: true,
        })) as Media,
      )

    const studentList = async (overrides: Partial<ListQuery> = {}) =>
      loadList(payload, await userOf(world.accounts.student), ownerArticles(overrides), 'en')

    it('an unpublished approved article reads draft in In progress', async () => {
      const { groups } = await studentList()
      const rows = rowsOf(groups).filter((row) => row.id === lists.unpublished)
      expect(rows.map((row) => [row.key, row.group])).toEqual([['draft', 'inProgress']])
    })

    it('each article reads its key and sits in its group', async () => {
      const { groups } = await studentList({ pages: { published: 2 } })
      const rows = rowsOf(groups)
      for (const key of STATUS_KEYS) {
        const row = rows.find((candidate) => candidate.id === lists.articles[key])
        expect({ key, found: row?.key, group: row?.group }).toEqual({
          key,
          found: key,
          group: groupOf(key, 'ownerArticles', { hasSpace: false }),
        })
      }
    })

    it('Needs you holds the KEY_WHERE rows of the owner keys', async () => {
      const ids = [
        ...lists.bulk,
        ...lists.manyDrafts,
        ...Object.values(lists.articles),
        lists.unpublished,
        lists.shared,
        lists.added,
      ]
      const returned = KEY_WHERE.changes_requested!.where
      const edits = KEY_WHERE.published_edits_returned!.where
      const mains = await payload.find({
        collection: 'articles',
        where: { and: [returned, { id: { in: ids } }] },
        draft: false,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
      const copies = await payload.findVersions({
        collection: 'articles',
        where: { and: [edits, { parent: { in: ids } }] },
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
      const expected = [
        ...mains.docs.map((doc) => doc.id),
        ...copies.docs.map((doc) => doc.parent as number),
      ].sort()
      const { groups } = await studentList()
      const needsYou = groups.find((group) => group.id === 'needsYou')?.rows ?? []
      expect(
        needsYou
          .map((row) => row.id)
          .filter((id) => ids.includes(id))
          .sort(),
      ).toEqual(expected)
      expect(expected).toHaveLength(2)
    })

    it('the row shows the newest title and cover', async () => {
      const student = await userOf(world.accounts.student)
      const media = await makeMedia(payload, track, 'list-newest')
      await payload.update({
        collection: 'articles',
        id: lists.articles.draft,
        data: { title: 'Autosaved title', cover_image: media.id },
        draft: true,
        autosave: true,
        locale: 'en',
        ...own(student),
      })
      const { groups } = await studentList()
      const row = rowsOf(groups).find((candidate) => candidate.id === lists.articles.draft)
      expect(row?.title).toBe('Autosaved title')
      expect(row?.cover).toBe(await thumbnailOf(media))
      expect(row?.cover).toBeTruthy()
    })

    it("a live article's copy changes its cover on the owner's row", async () => {
      const student = await userOf(world.accounts.student)
      const media = await makeMedia(payload, track, 'list-copy-cover')
      const id = lists.articles.published_unsent
      await payload.update({
        collection: 'articles',
        id,
        data: { cover_image: media.id },
        draft: true,
        autosave: true,
        locale: 'en',
        ...own(student),
      })
      const { groups } = await studentList()
      const row = rowsOf(groups).find((candidate) => candidate.id === id)
      expect(row?.title).toBe(lists.titles.beta)
      expect(row?.cover).toBe(await thumbnailOf(media))
    })

    it('finds the draft copy of a live article', async () => {
      const { groups } = await studentList()
      expect(groupOfId(groups, lists.articles.published_unsent)).toEqual(['inProgress'])
      expect(groupOfId(groups, lists.articles.published_edits)).toEqual(['withEditors'])
    })

    it('work rows are newest first', async () => {
      const { groups } = await studentList()
      for (const group of groups) {
        const times = group.rows.map((row) => Date.parse(row.updatedAt))
        expect(times).toEqual([...times].sort((a, b) => b - a))
      }
    })

    it('a reader with more than 10 work rows sees every one', async () => {
      const { groups } = await studentList()
      const inProgress = groups.find((group) => group.id === 'inProgress')!
      const ids = inProgress.rows.map((row) => row.id)
      lists.manyDrafts.forEach((id) => expect(ids).toContain(id))
      expect(inProgress.total).toBe(inProgress.rows.length)
    })
  })

  describe('the paged groups', () => {
    const studentList = async (overrides: Partial<ListQuery> = {}) =>
      loadList(payload, await userOf(world.accounts.student), ownerArticles(overrides), 'en')

    it('an equal draft copy sits in Published', async () => {
      const { groups } = await studentList()
      const row = rowsOf(groups).find(
        (candidate) => candidate.id === lists.articles.published_removal_kept,
      )
      expect([row?.key, row?.group]).toEqual(['published_removal_kept', 'published'])
      expect(row?.cover).toBeTruthy()
      expect(groupOfId(groups, lists.articles.published_removal_kept)).toEqual(['published'])
    })

    it('Published shows 50 rows and has more', async () => {
      const { groups } = await studentList()
      const published = groups.find((group) => group.id === 'published')!
      expect(published.rows).toHaveLength(50)
      expect(published.total).toBeGreaterThanOrEqual(62)
      expect(published.hasMore).toBe(true)
      const ids = published.rows.map((row) => row.id)
      expect(ids).toContain(lists.articles.published)
      expect(ids).toContain(lists.articles.published_removal_kept)

      const more = await studentList({ pages: { published: 2 } })
      const all = more.groups.find((group) => group.id === 'published')!
      lists.bulk.forEach((id) => expect(all.rows.map((row) => row.id)).toContain(id))
      expect(all.hasMore).toBe(false)
      const seen = rowsOf(more.groups).map((row) => row.id)
      expect(new Set(seen).size).toBe(seen.length)
    })

    it('a co-author removed in the copy reads published', async () => {
      const poster = await loadList(payload, await userOf(world.poster), ownerArticles(), 'en')
      const theirs = rowsOf(poster.groups).find((row) => row.id === lists.shared)
      expect([theirs?.key, theirs?.group]).toEqual(['published', 'published'])
      const mine = await studentList()
      const row = rowsOf(mine.groups).find((candidate) => candidate.id === lists.shared)
      expect([row?.key, row?.group]).toEqual(['published_unsent', 'inProgress'])
      expect(theirs?.title).not.toBeNull()
    })

    it('every paged row belongs to its group', async () => {
      const { groups } = await studentList({ pages: { published: 2 } })
      for (const group of groups)
        for (const row of group.rows)
          expect(groupOf(row.key, 'ownerArticles', { hasSpace: false })).toBe(group.id)
    })

    it('every counted row sits in one group', async () => {
      const { groups, total } = await studentList({ pages: { published: 20, closed: 20 } })
      expect(groups.reduce((sum, group) => sum + group.total, 0)).toBe(total)
      const ids = rowsOf(groups).map((row) => row.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toHaveLength(total)
    })
  })

  describe('only', () => {
    const studentList = async (overrides: Partial<ListQuery> = {}) =>
      loadList(payload, await userOf(world.accounts.student), ownerArticles(overrides), 'en')

    it('only published leaves out the work rows', async () => {
      const { groups } = await studentList({ only: 'published' })
      expect(groups.map((group) => group.id)).toEqual(['published'])
      const ids = rowsOf(groups).map((row) => row.id)
      expect(ids).toContain(lists.articles.published)
      expect(ids).toContain(lists.articles.published_removal_kept)
      for (const key of [
        'published_unsent',
        'published_edits',
        'published_edits_declined',
      ] as const)
        expect(ids).not.toContain(lists.articles[key])
    })

    it('only closed shows the declined row only', async () => {
      const { groups } = await studentList({ only: 'closed' })
      const mine = new Set([...lists.bulk, ...lists.manyDrafts, ...Object.values(lists.articles)])
      expect(
        rowsOf(groups)
          .map((row) => row.id)
          .filter((id) => mine.has(id)),
      ).toEqual([lists.articles.rejected])
    })
  })

  describe('course rows', () => {
    const teacherList = async (overrides: Partial<ListQuery> = {}) =>
      loadList(
        payload,
        await userOf(lists.teacher),
        {
          collection: 'courses',
          search: null,
          only: null,
          pages: {},
          ...overrides,
        },
        'en',
      )

    const rowOfCourse = (groups: ListGroup[], id: number) =>
      rowsOf(groups).find((row) => row.id === id)

    it("the teacher's live course with edits waiting is teaching now and reads published_edits", async () => {
      const { groups } = await teacherList()
      const row = rowOfCourse(groups, lists.courses.published_edits)
      expect([row?.key, row?.group]).toEqual(['published_edits', 'teachingNow'])
    })

    it('only teachingNow leaves out a live course that waits on the teacher', async () => {
      const returned = lists.courses.published_edits_returned
      const only = await teacherList({ only: 'teachingNow' })
      expect(rowOfCourse(only.groups, returned)).toBeUndefined()
      const all = await teacherList()
      expect(groupOfId(all.groups, returned)).toEqual(['needsYou'])
    })

    it('a course row has its type, season, year and session counts', async () => {
      const { groups } = await teacherList()
      const row = rowOfCourse(groups, lists.courses.published_edits)
      expect(row?.course).toEqual({
        type: 'THEMATIC',
        season: 'spring',
        year: 2035,
        held: 3,
        total: 12,
      })
    })

    it('a submitted course with a space is teaching now', async () => {
      const { groups } = await teacherList()
      const row = rowOfCourse(groups, lists.courses.submittedWithSpace)
      expect([row?.key, row?.group]).toEqual(['submitted', 'teachingNow'])
      expect(groupOfId(groups, lists.courses.submittedWithSpace)).toEqual(['teachingNow'])
    })

    it('a declined course with a space is teaching now, not closed', async () => {
      const { groups } = await teacherList()
      expect(groupOfId(groups, lists.courses.rejectedWithSpace)).toEqual(['teachingNow'])
      expect(groupOfId(groups, lists.courses.rejected)).toEqual(['closed'])
      expect(groupOfId(groups, lists.courses.draft)).toEqual(['proposals'])
    })

    it("another fellow's published course is not on the teacher's list", async () => {
      const { groups, total } = await teacherList()
      expect(rowOfCourse(groups, lists.courses.othersPublished)).toBeUndefined()
      const { othersPublished, ...theirs } = lists.courses
      expect(othersPublished).toBeGreaterThan(0)
      expect(total).toBe(Object.keys(theirs).length)
      const listed = await payload.count({
        collection: 'courses',
        where: { fellows: { contains: lists.teacher.person } },
        overrideAccess: true,
      })
      expect(total).toBe(listed.totalDocs)
    })

    it('a fellow who cannot read the space keeps the course in Proposals', async () => {
      await spaces.set('off')
      try {
        const { groups } = await teacherList()
        expect(groupOfId(groups, lists.courses.submittedWithSpace)).toEqual(['proposals'])
        expect(groupOfId(groups, lists.courses.rejectedWithSpace)).toEqual(['closed'])
      } finally {
        await spaces.set('on')
      }
    })
  })

  describe('the admin list', () => {
    const adminList = async (overrides: Partial<ListQuery> = {}) =>
      loadList(
        payload,
        await userOf(lists.writer),
        {
          collection: 'articles',
          search: null,
          only: null,
          pages: { published: 20, closed: 20 },
          ...overrides,
        },
        'en',
      )

    const fixtureIds = () => [
      ...lists.bulk,
      ...lists.manyDrafts,
      ...Object.values(lists.articles),
      lists.unpublished,
      lists.shared,
      lists.added,
      lists.writerDraft,
      lists.writerUnpublished,
    ]

    const found = async (keys: StatusKey[], ids: number[]) => {
      const out: number[] = []
      for (const key of keys) {
        const row = KEY_WHERE[key]!
        if (row.on === 'main') {
          const { docs } = await payload.find({
            collection: 'articles',
            where: { and: [row.where, { id: { in: ids } }] },
            draft: false,
            pagination: false,
            depth: 0,
            overrideAccess: true,
          })
          out.push(...docs.map((doc) => doc.id))
        } else {
          const { docs } = await payload.findVersions({
            collection: 'articles',
            where: { and: [row.where, { parent: { in: ids } }] },
            pagination: false,
            depth: 0,
            overrideAccess: true,
          })
          out.push(...docs.map((doc) => doc.parent as number))
        }
      }
      return out.sort()
    }

    const idsIn = (groups: ListGroup[], id: string) =>
      (groups.find((group) => group.id === id)?.rows ?? [])
        .map((row) => row.id)
        .filter((candidate) => fixtureIds().includes(candidate))
        .sort()

    it("an admin does not see another owner's draft", async () => {
      const { groups } = await adminList()
      const ids = rowsOf(groups).map((row) => row.id)
      expect(ids).not.toContain(lists.articles.draft)
      expect(ids).not.toContain(lists.unpublished)
      expect(groupOfId(groups, lists.articles.submitted)).toEqual(['needsYou'])
      expect(groupOfId(groups, lists.writerDraft)).toEqual(['inProgress'])
      expect(groupOfId(groups, lists.writerUnpublished)).toEqual(['inProgress'])
    })

    it("the admin's Needs you and Waiting on the author hold the KEY_WHERE rows", async () => {
      const { groups } = await adminList()
      const ids = fixtureIds()
      expect(idsIn(groups, 'needsYou')).toEqual(
        await found(['submitted', 'published_edits', 'published_removal'], ids),
      )
      expect(idsIn(groups, 'waitingOnAuthor')).toEqual(
        await found(['changes_requested', 'published_edits_returned'], ids),
      )
    })

    it('every fixture row on the admin list sits in one group', async () => {
      const { groups } = await adminList()
      const admitted = await payload.find({
        collection: 'articles',
        where: {
          and: [
            { id: { in: fixtureIds() } },
            {
              or: [ADMIN_VISIBLE, { authors: { contains: lists.writer.person } }],
            },
          ],
        },
        draft: false,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
      admitted.docs.forEach((doc) => expect(groupOfId(groups, doc.id)).toHaveLength(1))
      expect(admitted.docs.length).toBeGreaterThan(60)
    })

    it('an admin row shows the live title unless it waits on the admin', async () => {
      const { groups } = await adminList()
      const rows = rowsOf(groups)
      const unsent = rows.find((row) => row.id === lists.articles.published_unsent)
      expect(unsent?.title).toBe(lists.titles.alpha)
      const edits = rows.find((row) => row.id === lists.articles.published_edits)
      const copy = await payload.findVersions({
        collection: 'articles',
        where: {
          and: [
            { parent: { equals: lists.articles.published_edits } },
            { latest: { equals: true } },
          ],
        },
        locale: 'en',
        depth: 0,
        overrideAccess: true,
      })
      expect(edits?.title).toBe((copy.docs[0]!.version as { title: string }).title)
      expect(edits?.title).not.toBe(
        (
          await payload.findByID({
            collection: 'articles',
            id: lists.articles.published_edits,
            draft: false,
            locale: 'en',
            depth: 0,
            overrideAccess: true,
          })
        ).title,
      )
    })

    it("an admin row's cover follows its title", async () => {
      const media = await makeMedia(payload, track, 'list-admin-copy-cover')
      await payload.update({
        collection: 'articles',
        id: lists.articles.published_edits,
        data: { cover_image: media.id },
        draft: true,
        locale: 'en',
        overrideAccess: true,
      })
      const { groups } = await adminList()
      const rows = rowsOf(groups)
      const unsent = rows.find((row) => row.id === lists.articles.published_unsent)
      expect(unsent?.cover).toBeNull()
      const edits = rows.find((row) => row.id === lists.articles.published_edits)
      expect(edits?.cover).toBe(
        mediaThumbnail(
          (await payload.findByID({
            collection: 'media',
            id: media.id,
            depth: 0,
            overrideAccess: true,
          })) as Media,
        ),
      )
      expect(edits?.cover).toBeTruthy()
    })

    it('an admin total counts the rows the admin list may hold', async () => {
      const { total } = await adminList()
      const visible = await payload.count({
        collection: 'articles',
        where: { or: [ADMIN_VISIBLE, { authors: { contains: lists.writer.person } }] },
        overrideAccess: true,
      })
      const every = await payload.count({ collection: 'articles', overrideAccess: true })
      expect(total).toBe(visible.totalDocs)
      expect(total).toBeLessThan(every.totalDocs)
    })

    it('an admin with more than 10 work rows sees every one', async () => {
      const { groups } = await adminList()
      const inProgress = groups.find((group) => group.id === 'inProgress')!
      const ids = inProgress.rows.map((row) => row.id)
      lists.writerManyDrafts.forEach((id) => expect(ids).toContain(id))
      expect(inProgress.rows.length).toBeGreaterThan(10)
      expect(inProgress.total).toBe(inProgress.rows.length)
    })

    it('an admin row names its owners, an owner row does not', async () => {
      const person = await payload.findByID({
        collection: 'people',
        id: world.accounts.student.person!,
        depth: 0,
        overrideAccess: true,
      })
      const { groups } = await adminList()
      const row = rowsOf(groups).find(
        (candidate) => candidate.id === lists.articles.published_edits,
      )
      expect(row?.owners).toEqual([person.name])
      const mine = await loadList(
        payload,
        await userOf(world.accounts.student),
        ownerArticles(),
        'en',
      )
      rowsOf(mine.groups).forEach((candidate) => expect(candidate.owners).toEqual([]))
    })
  })

  describe('search', () => {
    const search = async (term: string, overrides: Partial<ListQuery> = {}) =>
      loadList(
        payload,
        await userOf(world.accounts.student),
        ownerArticles({ search: term, pages: { published: 20 }, ...overrides }),
        'en',
      )

    const makeArticle = async (title: string, extra: Record<string, unknown> = {}) =>
      (
        track(
          'articles',
          await payload.create({
            collection: 'articles',
            data: {
              title,
              slug: uniq(`search-${title.slice(0, 20).toLowerCase().replace(/\W+/g, '-')}`),
              authors: [world.accounts.student.person!],
              tier: 'public',
              review: { status: 'approved' },
              ...extra,
            },
            locale: 'en',
            overrideAccess: true,
          }),
        ) as { id: number }
      ).id

    it('search finds a row by its draft title', async () => {
      const student = await userOf(world.accounts.student)
      const oldTitle = uniq('Search draft old')
      const newTitle = uniq('Search draft new')
      const id = await makeArticle(oldTitle, { review: { status: 'draft' } })
      await payload.update({
        collection: 'articles',
        id,
        data: { title: newTitle },
        draft: true,
        autosave: true,
        locale: 'en',
        user: student,
        overrideAccess: false,
      })
      const byNew = await search(newTitle)
      expect(groupOfId(byNew.groups, id)).toEqual(['inProgress'])
      const byOld = await search(oldTitle)
      expect(groupOfId(byOld.groups, id)).toEqual(['inProgress'])
    })

    it('search finds a row by its title in the other language', async () => {
      const id = (
        await payload.create({
          collection: 'articles',
          data: {
            title: uniq('Arabic probe'),
            slug: uniq('arabic-probe'),
            authors: [world.accounts.student.person!],
            tier: 'public',
            review: { status: 'approved' },
            _status: 'published',
          },
          locale: 'en',
          overrideAccess: true,
        })
      ).id
      track('articles', id)
      const arabic = `عنوان فريد ${uniq('ar')}`
      await payload.update({
        collection: 'articles',
        id,
        data: { title: arabic },
        locale: 'ar',
        overrideAccess: true,
      })
      const { groups } = await search(arabic)
      expect(groupOfId(groups, id)).toEqual(['published'])
      expect(rowsOf(groups).find((row) => row.id === id)?.title).toBe(uniq('Arabic probe'))
    })

    it('search by the live title of an article whose copy changes the title keeps it in In progress', async () => {
      const id = lists.articles.published_unsent
      const live = await search(lists.titles.alpha)
      expect(groupOfId(live.groups, id)).toEqual(['inProgress'])
      expect(rowsOf(live.groups).find((row) => row.id === id)?.key).toBe('published_unsent')
      const copy = await search(lists.titles.beta)
      expect(groupOfId(copy.groups, id)).toEqual(['inProgress'])
    })

    it('a search with more than 10 hits finds every hit', async () => {
      const { groups } = await search(uniq('Bulk'))
      const ids = groups.find((group) => group.id === 'published')!.rows.map((row) => row.id)
      lists.bulk.forEach((id) => expect(ids).toContain(id))
      expect(rowsOf(groups).every((row) => row.title === uniq('Bulk'))).toBe(true)
    })

    describe('a search does not leak', () => {
      const searchAs = async (account: PortalAccount, term: string) =>
        loadList(
          payload,
          await userOf(account),
          ownerArticles({ search: term, pages: { published: 20 } }),
          'en',
        )

      it('a co-author removed in the copy finds nothing by the copy title', async () => {
        const poster = await searchAs(world.poster, lists.titles.sharedCopy)
        expect(rowsOf(poster.groups)).toEqual([])
        const own = await searchAs(world.accounts.student, lists.titles.sharedCopy)
        expect(groupOfId(own.groups, lists.shared)).toEqual(['inProgress'])
      })

      it('a co-author added in the copy finds nothing by the copy title', async () => {
        const poster = await searchAs(world.poster, lists.titles.addedCopy)
        expect(rowsOf(poster.groups)).toEqual([])
        const own = await searchAs(world.accounts.student, lists.titles.addedCopy)
        expect(groupOfId(own.groups, lists.added)).toEqual(['inProgress'])
      })

      it("an admin finds nothing by another owner's never-published draft title", async () => {
        const title = uniq('Leak probe draft')
        const id = await makeArticle(title, { review: { status: 'draft' } })
        const admin = await userOf(lists.writer)
        const query = { collection: 'articles', only: null, pages: { published: 20 } } as const
        const quiet = await loadList(payload, admin, { ...query, search: null }, 'en')
        const found = await loadList(payload, admin, { ...query, search: title }, 'en')
        expect(rowsOf(found.groups)).toEqual([])
        expect(found.total).toBe(quiet.total)
        const owner = await search(title)
        expect(groupOfId(owner.groups, id)).toEqual(['inProgress'])
      })
    })

    describe('a search is capped', () => {
      it('a term of one character is no search', async () => {
        const everything = await search('')
        const one = await search('a')
        expect(one).toEqual(everything)
        expect(rowsOf(one.groups).length).toBeGreaterThan(1)
      })

      it('a term reads as its first five words', async () => {
        const title = `${uniq('Words')} two three four five`
        const id = await makeArticle(title, { _status: 'published' })
        const { groups } = await search(`${title} six seven eight`)
        expect(groupOfId(groups, id)).toEqual(['published'])
      })

      it('a term reads as its first 100 characters', async () => {
        const title = uniq('Long').padEnd(100, 'k')
        const id = await makeArticle(title, { _status: 'published' })
        const { groups } = await search(`${title}${'z'.repeat(150)}`)
        expect(groupOfId(groups, id)).toEqual(['published'])
      })
    })
  })

  describe('filter and total', () => {
    const studentList = async (overrides: Partial<ListQuery> = {}) =>
      loadList(payload, await userOf(world.accounts.student), ownerArticles(overrides), 'en')

    it('only loads one group, and total still counts every row', async () => {
      const { groups, total } = await studentList({ only: 'needsYou' })
      expect(groups).toHaveLength(1)
      expect(groups[0]!.id).toBe('needsYou')
      expect(groups[0]!.rows).toHaveLength(2)
      expect(total).toBeGreaterThan(6)
    })

    it('only with a search loads one group of the hits', async () => {
      const everything = await studentList()
      const work = await studentList({ only: 'inProgress', search: lists.titles.alpha })
      expect(work.groups.map((group) => group.id)).toEqual(['inProgress'])
      expect(rowsOf(work.groups).map((row) => row.id)).toEqual([lists.articles.published_unsent])
      expect(work.total).toBe(everything.total)
      const paged = await studentList({
        only: 'published',
        search: uniq('Bulk'),
        pages: { published: 20 },
      })
      expect(paged.groups.map((group) => group.id)).toEqual(['published'])
      const ids = rowsOf(paged.groups).map((row) => row.id)
      lists.bulk.forEach((id) => expect(ids).toContain(id))
      expect(rowsOf(paged.groups).every((row) => row.title === uniq('Bulk'))).toBe(true)
      expect(paged.total).toBe(everything.total)
    })

    it('a page that is not a whole number from 1 to 20 reads as a page that is', async () => {
      const idsOf = async (published: number) =>
        rowsOf((await studentList({ only: 'published', pages: { published } })).groups).map(
          (row) => row.id,
        )
      const first = await idsOf(1)
      const last = await idsOf(20)
      expect(first).toHaveLength(50)
      expect(last.length).toBeGreaterThan(first.length)
      for (const page of [0, -1, Number.NaN, -0.5]) expect(await idsOf(page)).toEqual(first)
      for (const page of [999, Number.POSITIVE_INFINITY]) expect(await idsOf(page)).toEqual(last)
    })

    it('a search keeps total', async () => {
      const everything = await studentList()
      const { groups, total } = await studentList({ search: lists.titles.alpha })
      expect(rowsOf(groups)).toHaveLength(1)
      expect(total).toBe(everything.total)
      expect(total).toBeGreaterThan(6)
    })
  })
})
