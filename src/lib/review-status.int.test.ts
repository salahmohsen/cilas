import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { createTracker, uniq, uniqEmail } from '../../testing/payload.fixture'
import { rest } from '../../testing/payload-rest.test-utils'
import { resendInbox } from '../../testing/resend.test-utils'

import type { ReviewState } from './review'
import type { ReviewedCollection } from './reviewed-fields'
import {
  KEY_WHERE,
  type ReviewedDoc,
  type StatusKey,
  statusInputOf,
  statusOf,
} from './review-status'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()

describe('review status over real writes', () => {
  let admin: User
  let author: User
  let other: User
  let fellow: User
  let personId: number
  let fellowPersonId: number

  const makeUser = async (base: string, roles: User['roles'], person?: number) =>
    track(
      'users',
      (await payload.create({
        collection: 'users',
        data: {
          email: uniqEmail(base),
          password: crypto.randomUUID(),
          roles,
          ...(person ? { person } : {}),
        },
        overrideAccess: true,
      })) as unknown as User,
    )

  const makePerson = async (name: string) =>
    track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name, slug: uniq(name.toLowerCase().replace(/\W+/g, '-')) },
        overrideAccess: true,
      }),
    ).id

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    admin = await makeUser('status-admin', ['admin'])
    personId = await makePerson('Status Author')
    author = await makeUser('status-author', ['member'], personId)
    other = await makeUser('status-other', ['member'], await makePerson('Status Other'))
    fellowPersonId = await makePerson('Status Fellow')
    fellow = await makeUser('status-fellow', ['fellow'], fellowPersonId)
  })

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  let slugs = 0
  const nextSlug = (base: string) => uniq(`${base}-${++slugs}`)

  const as = (user: User) => ({ user, overrideAccess: false }) as const

  const parentOf = (parent: unknown) =>
    typeof parent === 'object' && parent !== null
      ? (parent as { id: number }).id
      : (parent as number)

  const latestVersion = async (collection: ReviewedCollection, id: number, user: User) => {
    const { docs } = await payload.findVersions({
      collection: collection as 'articles',
      where: { parent: { equals: id }, latest: { equals: true } },
      sort: '-updatedAt',
      limit: 1,
      locale: 'all',
      depth: 0,
      ...as(user),
    })
    return docs[0] ?? null
  }

  const keyOf = async (collection: ReviewedCollection, id: number, user: User) => {
    const main = await payload.findByID({
      collection: collection as 'articles',
      id,
      draft: false,
      locale: 'all',
      depth: 0,
      ...as(user),
    })
    const version = await latestVersion(collection, id, user)
    const latest = version ? ({ ...version.version, id } as unknown as ReviewedDoc) : null
    return statusOf(
      statusInputOf({
        collection,
        main: main as unknown as ReviewedDoc,
        latest,
        read: 'full',
      }),
      () => undefined,
    )
  }

  const storedRequest = async (id: number) => {
    const version = await latestVersion('articles', id, admin)
    return (version?.version as { review?: { request?: string | null } }).review?.request ?? null
  }

  const published = async (title: string) =>
    track(
      'articles',
      await payload.create({
        collection: 'articles',
        data: {
          title,
          slug: nextSlug('status-probe'),
          authors: [personId],
          tier: 'public',
          review: { status: 'approved' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id

  const draftArticle = async (title: string) =>
    track(
      'articles',
      await payload.create({
        collection: 'articles',
        data: {
          title,
          slug: nextSlug('status-draft'),
          authors: [],
          tier: 'owner',
          review: { status: 'draft' },
        },
        ...as(author),
      }),
    ).id

  const edit = (id: number, data: Record<string, unknown>, user = author) =>
    payload.update({ collection: 'articles', id, data, draft: true, ...as(user) })

  const submit = (id: number, review: Record<string, unknown> = {}, data = {}, user = author) =>
    payload.update({
      collection: 'articles',
      id,
      data: { ...data, _status: 'draft', review: { status: 'submitted', ...review } },
      ...as(user),
    })

  const SAVES = {
    approved: { _status: 'published', status: 'approved' },
    changes_requested: { _status: 'draft', status: 'changes_requested' },
    rejected: { _status: 'draft', status: 'rejected' },
    removed: { _status: 'draft', status: 'draft' },
  } as const

  const decide = (id: number, to: keyof typeof SAVES, note = 'A note') =>
    payload.update({
      collection: 'articles',
      id,
      data: {
        _status: SAVES[to]._status,
        review: { status: SAVES[to].status, review_note: to === 'approved' ? null : note },
      },
      ...as(admin),
    })

  it('a clean published article', async () => {
    const id = await published('Clean Published')
    const version = await latestVersion('articles', id, admin)
    expect((version?.version as { _status?: string })._status).toBe('published')
    expect(await keyOf('articles', id, author)).toBe('published')
  })

  it('approval leaves no draft copy', async () => {
    const id = await published('Approval Leaves')
    await edit(id, { title: 'Approval Leaves, edited' })
    await submit(id, { request: 'changes' })
    await decide(id, 'approved')
    const version = await latestVersion('articles', id, admin)
    expect((version?.version as { _status?: string })._status).toBe('published')
    expect(await keyOf('articles', id, author)).toBe('published')
  })

  it('versions are gated', async () => {
    const id = await published('Gated Versions')
    const byOther = await payload.findVersions({
      collection: 'articles',
      where: { parent: { equals: id } },
      ...as(other),
    })
    expect(byOther.docs).toHaveLength(0)
    const byAdmin = await payload.findVersions({
      collection: 'articles',
      where: { parent: { equals: id } },
      ...as(admin),
    })
    expect(byAdmin.docs.length).toBeGreaterThan(0)
  })

  it('a fellow edits a published course', async () => {
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Status Place', slug: uniq('status-place'), city: uniq('Statusville') },
        overrideAccess: true,
      }),
    )
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2034, place: place.id, start_date: '2034-10-04' },
        overrideAccess: true,
      }),
    )
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Fellow Course',
          slug: uniq('fellow-course'),
          course_type: 'THEMATIC',
          tier: 'public',
          cycle: cycle.id,
          fellows: [fellowPersonId],
          registration: { mode: 'closed' },
          review: { status: 'approved' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    )
    expect(await keyOf('courses', course.id, fellow)).toBe('published')

    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { title: 'Fellow Course, edited' },
      draft: true,
      ...as(fellow),
    })
    expect(await keyOf('courses', course.id, fellow)).toBe('published_unsent')

    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { _status: 'draft', review: { status: 'submitted', request: 'changes' } },
      ...as(fellow),
    })
    expect(await keyOf('courses', course.id, fellow)).toBe('published_edits')

    const anonymous = await payload.find({
      collection: 'courses',
      where: { id: { equals: course.id } },
      overrideAccess: false,
    })
    expect(anonymous.docs.map((doc) => doc.title)).toEqual(['Fellow Course'])
  })

  it('KEY_WHERE finds the rows of its keys', async () => {
    const articles: number[] = []
    const expected = new Map<number, StatusKey>()
    const add = (id: number, key: StatusKey) => {
      articles.push(id)
      expected.set(id, key)
    }

    add(await draftArticle('Key Draft'), 'draft')

    const submitted = await draftArticle('Key Submitted')
    await submit(submitted)
    add(submitted, 'submitted')

    const returned = await draftArticle('Key Changes Requested')
    await submit(returned)
    await decide(returned, 'changes_requested')
    add(returned, 'changes_requested')

    const declined = await draftArticle('Key Rejected')
    await submit(declined)
    await decide(declined, 'rejected')
    add(declined, 'rejected')

    const edits = await published('Key Edits')
    await edit(edits, { title: 'Key Edits, edited' })
    await submit(edits, { request: 'changes' })
    add(edits, 'published_edits')

    const removal = await published('Key Removal')
    await submit(removal, { request: 'removal' })
    add(removal, 'published_removal')

    const editsReturned = await published('Key Edits Returned')
    await edit(editsReturned, { title: 'Key Edits Returned, edited' })
    await submit(editsReturned, { request: 'changes' })
    await decide(editsReturned, 'changes_requested')
    add(editsReturned, 'published_edits_returned')

    const approvedOff = await published('Key Approved Off')
    await payload.update({
      collection: 'articles',
      id: approvedOff,
      data: { _status: 'draft' },
      ...as(admin),
    })
    add(approvedOff, 'draft')

    add(await published('Key Clean'), 'published')

    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Key Place', slug: uniq('key-place'), city: uniq('Keyville') },
        overrideAccess: true,
      }),
    )
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2035, place: place.id, start_date: '2035-10-04' },
        overrideAccess: true,
      }),
    )
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Key No Status',
          slug: uniq('key-no-status'),
          course_type: 'THEMATIC',
          tier: 'owner',
          cycle: cycle.id,
          fellows: [fellowPersonId],
          _status: 'draft',
        },
        overrideAccess: true,
      }),
    )
    await payload.db.updateOne({
      collection: 'courses',
      id: course.id,
      data: { review: { status: null } },
    })
    const stored = await payload.findByID({
      collection: 'courses',
      id: course.id,
      draft: false,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored.review?.status ?? null).toBeNull()

    const keys = new Map<number, StatusKey>()
    for (const id of articles) keys.set(id, await keyOf('articles', id, admin))
    expect(Object.fromEntries(keys)).toEqual(Object.fromEntries(expected))
    expect(await keyOf('courses', course.id, admin)).toBe('draft')

    const found = async (collection: 'articles' | 'courses', ids: number[], key: StatusKey) => {
      const row = KEY_WHERE[key]!
      if (row.on === 'main') {
        const { docs } = await payload.find({
          collection,
          where: { and: [row.where, { id: { in: ids } }] },
          draft: false,
          pagination: false,
          depth: 0,
          ...as(admin),
        })
        return docs.map((doc) => doc.id).sort()
      }
      const { docs } = await payload.findVersions({
        collection,
        where: { and: [row.where, { parent: { in: ids } }] },
        pagination: false,
        depth: 0,
        ...as(admin),
      })
      return docs.map((doc) => parentOf(doc.parent)).sort()
    }

    const keyed = Object.keys(KEY_WHERE) as StatusKey[]
    for (const key of keyed) {
      const want = [...keys]
        .filter(([, k]) => k === key)
        .map(([id]) => id)
        .sort()
      expect({ key, ids: await found('articles', articles, key) }).toEqual({ key, ids: want })
    }
    expect(await found('courses', [course.id], 'draft')).toEqual([course.id])
    expect(await found('courses', [course.id], 'submitted')).toEqual([])
  })

  describe('the request rule', () => {
    const keptRemoval = async (title: string) => {
      const id = await published(title)
      await submit(id, { request: 'removal' })
      await decide(id, 'rejected')
      return id
    }

    it('a kept removal, then a resubmitted edit, asks for changes', async () => {
      const id = await keptRemoval('Rule One')
      expect(await keyOf('articles', id, admin)).toBe('published_removal_kept')
      await submit(id, {}, { title: 'Rule One, edited' })
      expect(await storedRequest(id)).toBe('changes')
      expect(await keyOf('articles', id, admin)).toBe('published_edits')
    })

    it('an admin save at submitted keeps removal', async () => {
      const id = await published('Rule Two')
      await submit(id, { request: 'removal' })
      await payload.update({
        collection: 'articles',
        id,
        data: { review: { status: 'submitted' } },
        ...as(admin),
      })
      expect(await storedRequest(id)).toBe('removal')
    })

    it('approval clears request', async () => {
      const id = await published('Rule Three')
      await edit(id, { title: 'Rule Three, edited' })
      await submit(id, { request: 'changes' })
      await decide(id, 'approved')
      expect(await storedRequest(id)).toBeNull()
      const main = await payload.findByID({
        collection: 'articles',
        id,
        draft: false,
        depth: 0,
        ...as(admin),
      })
      expect(main.review?.request ?? null).toBeNull()
    })

    it('a move to draft clears request', async () => {
      const id = await published('Rule Four')
      await submit(id, { request: 'removal' })
      await decide(id, 'removed')
      expect(await storedRequest(id)).toBeNull()
    })

    it('changes_requested on a live document keeps request', async () => {
      const id = await published('Rule Five')
      await edit(id, { title: 'Rule Five, edited' })
      await submit(id, { request: 'changes' })
      await decide(id, 'changes_requested')
      expect(await storedRequest(id)).toBe('changes')
      expect(await keyOf('articles', id, admin)).toBe('published_edits_returned')
    })

    it('rejected on a live document keeps request', async () => {
      const changes = await published('Rule Six Changes')
      await edit(changes, { title: 'Rule Six Changes, edited' })
      await submit(changes, { request: 'changes' })
      await decide(changes, 'rejected')
      expect(await storedRequest(changes)).toBe('changes')
      expect(await keyOf('articles', changes, admin)).toBe('published_edits_declined')

      const removal = await keptRemoval('Rule Six Removal')
      expect(await storedRequest(removal)).toBe('removal')
      expect(await keyOf('articles', removal, admin)).toBe('published_removal_kept')
    })

    it('a document that is not live stores no request', async () => {
      const id = await draftArticle('Rule Seven')
      await submit(id, { request: 'removal' })
      expect(await storedRequest(id)).toBeNull()
    })

    it('a decision after a kept removal is not told as a removal', async () => {
      const id = await keptRemoval('Rule Eight')
      await decide(id, 'approved')
      const { docs } = await payload.find({
        collection: 'notifications',
        where: { recipient: { equals: author.id } },
        sort: '-id',
        limit: 1,
        overrideAccess: true,
      })
      expect(docs[0]?.description).toContain('was approved and published')
    })

    it('an owner save on a declined copy keeps request', async () => {
      const id = await published('Rule Nine')
      await edit(id, { title: 'Rule Nine, edited' })
      await submit(id, { request: 'changes' })
      await decide(id, 'rejected')
      await edit(id, { review: { status: 'rejected' as ReviewState, request: 'removal' } })
      expect(await storedRequest(id)).toBe('changes')
      expect(await keyOf('articles', id, admin)).toBe('published_edits_declined')
    })

    it('an owner save on a declined copy from before 1b keeps its null request', async () => {
      const id = await published('Rule Ten')
      await edit(id, { title: 'Rule Ten, edited' })
      await submit(id, { request: 'changes' })
      await decide(id, 'rejected')
      const version = await latestVersion('articles', id, admin)
      await payload.db.updateVersion({
        collection: 'articles',
        id: version!.id,
        versionData: { version: { review: { request: null } } },
      })
      expect(await storedRequest(id)).toBeNull()
      await edit(id, { review: { status: 'rejected' as ReviewState, request: 'removal' } })
      expect(await storedRequest(id)).toBeNull()
      expect(await keyOf('articles', id, admin)).toBe('published_edits_declined')
    })

    it('a trusted write with no review key keeps removal on a submitted copy', async () => {
      const id = await published('Rule Eleven')
      await submit(id, { request: 'removal' })
      await payload.update({
        collection: 'articles',
        id,
        data: { title: 'Rule Eleven, touched' },
        draft: true,
        ...as(admin),
      })
      expect(await storedRequest(id)).toBe('removal')
      expect(await keyOf('articles', id, admin)).toBe('published_removal')
    })

    describe('a declined copy keeps its status and request', () => {
      const declined = async (title: string) => {
        const id = await published(title)
        await edit(id, { title: `${title}, edited` })
        await submit(id, { request: 'changes' })
        await decide(id, 'rejected')
        return id
      }

      it('over REST PATCH', async () => {
        const id = await declined('Rule Twelve')
        const password = crypto.randomUUID()
        const owner = await makeUser('status-rest', ['member'], personId)
        await payload.update({
          collection: 'users',
          id: owner.id,
          data: { password },
          overrideAccess: true,
        })
        const token = (
          await payload.login({ collection: 'users', data: { email: owner.email, password } })
        ).token!
        const body = new FormData()
        body.set('_payload', JSON.stringify({ title: 'Rule Twelve, patched' }))
        const response = await rest('PATCH', `articles/${id}?draft=true`, { token, body })
        expect(response.status).toBe(200)
        expect(await storedRequest(id)).toBe('changes')
        expect(await keyOf('articles', id, admin)).toBe('published_edits_declined')
      })

      it('over an autosave', async () => {
        const id = await declined('Rule Thirteen')
        await payload.update({
          collection: 'articles',
          id,
          data: { title: 'Rule Thirteen, autosaved' },
          draft: true,
          autosave: true,
          ...as(author),
        })
        expect(await storedRequest(id)).toBe('changes')
        expect(await keyOf('articles', id, admin)).toBe('published_edits_declined')
      })
    })
  })
})
