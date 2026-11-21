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

import { localServices } from '../../../testing/local-services.test-utils'
import { mockNetwork } from '../../../testing/msw-node.test-utils'
import { createTracker } from '../../../testing/payload.fixture'
import { resendInbox } from '../../../testing/resend.test-utils'
import { listWorld, type ListWorld } from '../../../testing/portal-lists.fixture'
import { portalWorld, type PortalWorld } from '../../../testing/portal.fixture'

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
})
