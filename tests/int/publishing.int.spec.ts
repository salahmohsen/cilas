// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getReviewQueue } from '@/lib/review-queue'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { createTracker, uniq, uniqEmail } from './fixtures'

let payload: Payload
const { track, cleanup } = createTracker()

describe('publishing', () => {
  let personId: number
  let author: User
  // Real accounts: a save stamps its editor on the document (a foreign key).
  let admin: User

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    admin = track(
      'users',
      (await payload.create({
        collection: 'users',
        data: {
          email: uniqEmail('publishing-admin'),
          password: crypto.randomUUID(),
          roles: ['admin'],
        },
      })) as unknown as User,
    )
    personId = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Author Probe', slug: uniq('author-probe') },
        overrideAccess: true,
      }),
    ).id
    author = track(
      'users',
      (await payload.create({
        collection: 'users',
        data: {
          email: uniqEmail('publishing-author'),
          password: crypto.randomUUID(),
          roles: ['member'],
          person: personId,
        },
        overrideAccess: true,
      })) as unknown as User,
    )
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    await cleanup(payload)
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
            slug: uniq('review-probe'),
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
          data: { slug: uniq('review-probe-copy') },
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
            slug: uniq('draft-save-probe'),
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
            slug: uniq('autosave-probe'),
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

  describe('a published article', () => {
    let liveId: number
    const live = () =>
      payload.findByID({ collection: 'articles', id: liveId, draft: false, overrideAccess: true })
    // `author` is set in beforeAll, after this describe is collected.
    const as = (user: User) => ({ user, overrideAccess: false }) as const

    beforeAll(async () => {
      vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined)
      liveId = track(
        'articles',
        await payload.create({
          collection: 'articles',
          data: {
            title: 'Live Probe',
            slug: uniq('live-probe'),
            authors: [personId],
            tier: 'public',
            review: { status: 'approved' },
            _status: 'published',
          },
          overrideAccess: true,
        }),
      ).id
      expect((await live()).review?.status).toBe('approved')
    })

    it('keeps the published version when its author edits it', async () => {
      const saved = await payload.update({
        collection: 'articles',
        id: liveId,
        data: { title: 'Live Probe, edited' },
        ...as(author),
      })
      expect(saved.title).toBe('Live Probe, edited')
      const doc = await live()
      expect(doc._status).toBe('published')
      expect(doc.title).toBe('Live Probe')
    })

    it('refuses its author deleting it', async () => {
      await expect(
        payload.delete({ collection: 'articles', id: liveId, ...as(author) }),
      ).rejects.toThrow()
      expect((await live()).id).toBe(liveId)
    })

    it('refuses its author a bulk edit', async () => {
      await expect(
        payload.update({
          collection: 'articles',
          where: { id: { equals: liveId } },
          data: { title: 'Bulk' },
          ...as(author),
        }),
      ).rejects.toThrow(/one document at a time/)
    })

    it('queues a submitted change and locks it, while the site keeps the published one', async () => {
      await payload.update({
        collection: 'articles',
        id: liveId,
        data: { review: { status: 'submitted', request: 'changes' } },
        ...as(author),
      })
      expect((await live()).title).toBe('Live Probe')
      const queued = (await getReviewQueue(payload)).find(
        (i) => i.kind === 'article' && i.id === liveId,
      )
      expect(queued?.title).toBe('Live Probe, edited')

      await expect(
        payload.update({
          collection: 'articles',
          id: liveId,
          data: { title: 'Sneaky edit' },
          ...as(author),
        }),
      ).rejects.toThrow(/waits for review/)
    })

    it('keeps the published version when an admin asks for changes', async () => {
      await payload.update({
        collection: 'articles',
        id: liveId,
        data: { _status: 'draft', review: { status: 'changes_requested', review_note: 'Shorter' } },
        ...as(admin),
      })
      const doc = await live()
      expect(doc._status).toBe('published')
      expect(doc.title).toBe('Live Probe')
    })

    it('publishes the change only when an admin approves it', async () => {
      await payload.update({
        collection: 'articles',
        id: liveId,
        data: { title: 'Live Probe, shorter', review: { status: 'submitted', request: 'changes' } },
        ...as(author),
      })
      expect((await live()).title).toBe('Live Probe')
      await payload.update({
        collection: 'articles',
        id: liveId,
        data: { _status: 'published', review: { status: 'approved' } },
        ...as(admin),
      })
      const doc = await live()
      expect(doc.title).toBe('Live Probe, shorter')
      expect(doc.review?.request ?? null).toBeNull()
    })

    it('takes it down only when an admin approves a removal, then lets the author delete it', async () => {
      await payload.update({
        collection: 'articles',
        id: liveId,
        data: { review: { status: 'submitted', request: 'removal' } },
        ...as(author),
      })
      expect((await live())._status).toBe('published')
      const queued = (await getReviewQueue(payload)).find(
        (i) => i.kind === 'article' && i.id === liveId,
      )
      expect(queued).toMatchObject({ title: 'Live Probe, shorter', removal: true })

      await payload.update({
        collection: 'articles',
        id: liveId,
        data: { _status: 'draft', review: { status: 'draft' } },
        ...as(admin),
      })
      expect((await live())._status).toBe('draft')
      await payload.delete({ collection: 'articles', id: liveId, ...as(author) })
    })
  })

  it('lets a fellow read the versions of a course they teach', async () => {
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: {
          name: 'Publishing Probe Place',
          slug: uniq('publishing-probe-place'),
          city: uniq('Probeville'),
        },
        overrideAccess: true,
      }),
    )
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2033, place: place.id, start_date: '2033-10-04' },
        overrideAccess: true,
      }),
    )
    const fellowPerson = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Fellow Probe', slug: uniq('fellow-probe') },
        overrideAccess: true,
      }),
    )
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Versions Probe',
          slug: uniq('versions-probe'),
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
          slug: uniq('joined-probe'),
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
          slug: uniq('publication-probe'),
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
