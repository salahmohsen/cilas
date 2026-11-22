import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { adminQueue, adminReviewRows, countReviewQueue, getReviewQueue } from '@/lib/review-queue'
import { REVIEWED } from '@/lib/reviewed-collections'
import type { ReviewedCollection } from '@/lib/reviewed-fields'
import config from '@/payload.config'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { needsWorld, type NeedsWorld } from '../../testing/needs.fixture'
import { createTracker } from '../../testing/payload.fixture'
import { portalWorld } from '../../testing/portal.fixture'
import { resendInbox } from '../../testing/resend.test-utils'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()

describe('the review queue', () => {
  let world: NeedsWorld

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    world = await needsWorld(payload, track, await portalWorld(payload, track))
  }, 300_000)

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  const collections = REVIEWED.map(({ collection }) => collection)

  it('the admin set holds exactly the documents that wait on the admin, for every state', async () => {
    const sets = await adminQueue(payload)
    for (const collection of collections) {
      const inSet = world.ids[collection].filter((id) => sets[collection].has(id)).sort()
      expect(inSet, collection).toEqual([...world.adminWaiting[collection]].sort())
    }
    const { lists, notLive, fellowCourses } = world
    expect(world.adminWaiting.articles).toEqual(
      expect.arrayContaining([
        lists.articles.submitted,
        lists.articles.published_edits,
        lists.articles.published_removal,
        notLive.takenDownResubmitted,
        notLive.changesRequestedCopySubmitted,
      ]),
    )
    expect(world.adminWaiting.courses).toEqual(
      expect.arrayContaining([lists.courses.published_edits, fellowCourses.published_removal]),
    )
    expect(world.adminWaiting.publications).toEqual([world.publication])
  })

  it('the near misses are not in the admin set', async () => {
    const sets = await adminQueue(payload)
    const { lists, notLive } = world
    for (const id of [
      lists.articles.draft,
      lists.articles.changes_requested,
      lists.articles.rejected,
      lists.articles.published,
      lists.articles.published_unsent,
      lists.articles.published_edits_returned,
      lists.articles.published_edits_declined,
      lists.articles.published_removal_kept,
      lists.unpublished,
      notLive.rejectedCopySubmitted,
      notLive.takenDownCopySubmitted,
    ])
      expect(sets.articles.has(id), String(id)).toBe(false)
  })

  it('adminReviewRows makes one row per id of the set', async () => {
    const sets = await adminQueue(payload)
    const rows = await adminReviewRows(payload, sets, 'en')
    for (const collection of collections) {
      const own = rows.filter((row) => row.collection === collection)
      expect(own.map((row) => row.id).sort(), collection).toEqual(
        [...sets[collection].keys()].sort(),
      )
      for (const row of own) expect(row.key).toBe(sets[collection].get(row.id))
    }
    const total = Object.values(sets).reduce((sum, set) => sum + set.size, 0)
    expect(rows).toHaveLength(total)
  })

  it('countReviewQueue counts at least the fixture documents that wait', async () => {
    const waiting = Object.values(world.adminWaiting).reduce((sum, ids) => sum + ids.length, 0)
    expect(await countReviewQueue(payload)).toBeGreaterThanOrEqual(waiting)
  })

  describe('getReviewQueue', () => {
    const itemOf = (items: Awaited<ReturnType<typeof getReviewQueue>>, kind: string, id: number) =>
      items.find((item) => item.kind === kind && item.id === id)

    const copyTitle = async (collection: ReviewedCollection, id: number) => {
      const { docs } = await payload.findVersions({
        collection: collection as 'articles',
        where: { parent: { equals: id }, latest: { equals: true } },
        sort: '-updatedAt',
        limit: 1,
        locale: 'en',
        depth: 0,
        overrideAccess: true,
      })
      return (docs[0]?.version as { title?: string } | undefined)?.title
    }

    it('keeps its shape', async () => {
      const items = await getReviewQueue(payload)
      const item = itemOf(items, 'article', world.lists.articles.submitted)!
      expect(item).toEqual({
        kind: 'article',
        id: world.lists.articles.submitted,
        title: expect.any(String),
        removal: false,
        by: expect.any(String),
        since: expect.any(String),
        href: `/admin/collections/articles/${world.lists.articles.submitted}`,
      })
      expect(items.map((i) => i.since)).toEqual([...items.map((i) => i.since)].sort())
    })

    it('marks only a removal request as a removal', async () => {
      const items = await getReviewQueue(payload)
      expect(itemOf(items, 'article', world.lists.articles.published_removal)?.removal).toBe(true)
      expect(itemOf(items, 'course', world.fellowCourses.published_removal)?.removal).toBe(true)
      expect(itemOf(items, 'article', world.lists.articles.published_edits)?.removal).toBe(false)
      expect(itemOf(items, 'publication', world.publication)?.removal).toBe(false)
    })

    it("titles a document by its copy, not by the live row's title", async () => {
      const items = await getReviewQueue(payload)
      const id = world.lists.articles.published_edits
      const title = await copyTitle('articles', id)
      expect(title).toContain('edited')
      expect(itemOf(items, 'article', id)?.title).toBe(title)
    })

    it('names the owners although a person is hidden', async () => {
      const items = await getReviewQueue(payload)
      const article = await payload.findByID({
        collection: 'articles',
        id: world.hiddenOwnerArticle,
        depth: 1,
        draft: true,
        overrideAccess: true,
      })
      const names = (article.authors as Array<{ name?: string }>).map((person) => person.name)
      expect(names[0]).toBeTruthy()
      expect(itemOf(items, 'article', world.hiddenOwnerArticle)?.by).toBe(names.join(', '))
    })
  })
})
