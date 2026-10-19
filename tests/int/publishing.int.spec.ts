// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

type Tracked = 'people' | 'articles' | 'publications' | 'press' | 'spaces' | 'cycles' | 'courses'

let payload: Payload
const created: Array<{ collection: Tracked; id: number }> = []
const track = <T extends { id: number }>(collection: Tracked, doc: T): T => {
  created.push({ collection, id: doc.id })
  return doc
}

describe('publishing', () => {
  let personId: number
  let author: User
  const admin = { id: -1, roles: ['admin'] } as unknown as User

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    personId = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Author Probe', slug: 'author-probe' },
        overrideAccess: true,
      }),
    ).id
    author = { id: -2, roles: ['member'], person: personId } as unknown as User
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
    }
    await payload.destroy()
  })

  describe('article review', () => {
    let articleId: number

    it('adds the author to their own new article', async () => {
      const article = track(
        'articles',
        await payload.create({
          collection: 'articles',
          data: {
            title: 'Review Probe',
            slug: 'review-probe',
            authors: [],
            requested_tier: 'public',
            tier: 'owner',
            review: { status: 'draft' },
          },
          user: author,
          overrideAccess: false,
        }),
      )
      articleId = article.id
      expect(article.authors?.map((a) => (typeof a === 'object' ? a.id : a))).toEqual([personId])
    })

    it('refuses an author approving their own article', async () => {
      await expect(
        payload.update({
          collection: 'articles',
          id: articleId,
          data: { review: { status: 'approved' } },
          user: author,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/Only an admin/)
    })

    it('lets the author submit, emails admins, then locks the article to them', async () => {
      const send = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined)
      await payload.update({
        collection: 'articles',
        id: articleId,
        data: { review: { status: 'submitted' } },
        user: author,
        overrideAccess: false,
      })
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Submitted for review: Review Probe' }),
      )

      await expect(
        payload.update({
          collection: 'articles',
          id: articleId,
          data: { title: 'Sneaky edit' },
          user: author,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })

    it('publishes on approval at the requested tier', async () => {
      const approved = await payload.update({
        collection: 'articles',
        id: articleId,
        data: { review: { status: 'approved' } },
        user: admin,
        overrideAccess: false,
      })
      expect(approved._status).toBe('published')
      expect(approved.tier).toBe('public')
      expect(approved.published_date).toBeTruthy()

      const { docs } = await payload.find({
        collection: 'articles',
        where: { id: { equals: articleId } },
        overrideAccess: false,
      })
      expect(docs).toHaveLength(1)
    })

    it('duplicates an approved article as a fresh draft', async () => {
      const copy = track(
        'articles',
        await payload.duplicate({
          collection: 'articles',
          id: articleId,
          data: { slug: 'review-probe-copy' },
          user: admin,
          overrideAccess: true,
        }),
      )
      expect(copy.review?.status).toBe('draft')
      expect(copy._status).toBe('draft')
      expect(copy.published_date ?? null).toBeNull()
      expect(copy.featured ?? false).toBe(false)
      expect(copy.tier).toBe('owner')
    })

    it('refuses a draft save that changes the review status', async () => {
      const draft = track(
        'articles',
        await payload.create({
          collection: 'articles',
          data: {
            title: 'Draft Save Probe',
            slug: 'draft-save-probe',
            authors: [],
            tier: 'owner',
            review: { status: 'draft' },
          },
          user: author,
          overrideAccess: false,
        }),
      )
      await expect(
        payload.update({
          collection: 'articles',
          id: draft.id,
          data: { review: { status: 'submitted' } },
          draft: true,
          user: author,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/Submit for review/)
    })

    it('keeps the review status on an autosave that changes it', async () => {
      const draft = track(
        'articles',
        await payload.create({
          collection: 'articles',
          data: {
            title: 'Autosave Probe',
            slug: 'autosave-probe',
            authors: [],
            tier: 'owner',
            review: { status: 'draft' },
          },
          user: author,
          overrideAccess: false,
        }),
      )
      const saved = await payload.update({
        collection: 'articles',
        id: draft.id,
        data: { title: 'Autosave Probe, edited', review: { status: 'submitted' } },
        draft: true,
        autosave: true,
        user: author,
        overrideAccess: false,
      })
      expect(saved.title).toBe('Autosave Probe, edited')
      expect(saved.review?.status).toBe('draft')
    })
  })

  it('lets a fellow read the versions of a course they teach', async () => {
    const space = track(
      'spaces',
      await payload.create({
        collection: 'spaces',
        data: {
          name: 'Publishing Probe Space',
          slug: 'publishing-probe-space',
          city: 'Probeville',
        },
        overrideAccess: true,
      }),
    )
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2033, space: space.id, start_date: '2033-10-04' },
        overrideAccess: true,
      }),
    )
    const fellowPerson = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Fellow Probe', slug: 'fellow-probe' },
        overrideAccess: true,
      }),
    )
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Versions Probe',
          slug: 'versions-probe',
          course_type: 'THEMATIC',
          session_unit: 'session',
          tier: 'owner',
          cycle: cycle.id,
          fellows: [fellowPerson.id],
        },
        overrideAccess: true,
      }),
    )
    const fellow = { id: -3, roles: ['fellow'], person: fellowPerson.id } as unknown as User

    const versions = await payload.findVersions({
      collection: 'courses',
      where: { parent: { equals: course.id } },
      user: fellow,
      overrideAccess: false,
    })
    expect(versions.totalDocs).toBeGreaterThanOrEqual(1)
  })

  it('lists an article’s publications through the join', async () => {
    const article = track(
      'articles',
      await payload.create({
        collection: 'articles',
        data: {
          title: 'Joined Probe',
          slug: 'joined-probe',
          authors: [personId],
          tier: 'public',
          review: { status: 'approved' },
        },
        overrideAccess: true,
      }),
    )
    const publication = track(
      'publications',
      await payload.create({
        collection: 'publications',
        data: {
          kind: 'other',
          title: 'Publication Probe',
          slug: 'publication-probe',
          articles: [article.id],
        },
        overrideAccess: true,
      }),
    )
    const read = await payload.findByID({
      collection: 'articles',
      id: article.id,
      overrideAccess: true,
    })
    expect(read.publications?.docs?.map((p) => (typeof p === 'object' ? p.id : p))).toContain(
      publication.id,
    )
  })

  it('refuses a press author with neither a person nor a name', async () => {
    await expect(
      payload.create({
        collection: 'press',
        data: {
          kind: 'coverage',
          title: 'Press Probe',
          authors: [{}],
          links: [{ url: 'https://example.org/probe' }],
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
