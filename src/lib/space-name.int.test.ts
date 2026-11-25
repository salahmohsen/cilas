import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { createTracker, uniq } from '../../testing/payload.fixture'
import { resendInbox } from '../../testing/resend.test-utils'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()

const storedTitleReadAlone = async (id: number, locale: 'en' | 'ar' = 'en') =>
  (
    await payload.findByID({
      collection: 'spaces',
      id,
      locale,
      depth: 0,
      overrideAccess: true,
      select: { display_name: true },
    })
  ).display_name

describe('a space’s stored name', () => {
  let cycle: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Name Place', slug: uniq('name-place'), city: uniq('Nameville') },
        overrideAccess: true,
      }),
    )
    cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: {
          season: 'spring',
          start_year: 2032,
          place: place.id,
          start_date: '2032-03-02',
          registration: { method: 'closed' },
        },
        overrideAccess: true,
      }),
    ).id
  })

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  it('names a community by its own name, falls back to English for Arabic, and follows a rename', async () => {
    const title = uniq('Name hall')
    const space = track(
      'spaces',
      await payload.create({
        collection: 'spaces',
        data: { kind: 'community', name: title } as never,
        overrideAccess: true,
      }),
    )
    expect(await storedTitleReadAlone(space.id)).toBe(title)
    expect(await storedTitleReadAlone(space.id, 'ar')).toBe(title)

    await payload.update({
      collection: 'spaces',
      id: space.id,
      locale: 'ar',
      data: { name: 'قاعة' } as never,
      overrideAccess: true,
    })
    expect(await storedTitleReadAlone(space.id, 'ar')).toBe('قاعة')
    expect(await storedTitleReadAlone(space.id)).toBe(title)
  })

  it('follows a published course rename, and ignores a draft one', async () => {
    const title = uniq('Name course')
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title,
          slug: uniq('name-course'),
          course_type: 'THEMATIC',
          cycle,
          _status: 'published',
        } as never,
        overrideAccess: true,
      }),
    )
    const { docs } = await payload.find({
      collection: 'spaces',
      where: { course: { equals: course.id } },
      depth: 0,
      overrideAccess: true,
    })
    const space = track('spaces', docs[0]!)
    expect(await storedTitleReadAlone(space.id)).toBe(title)

    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { title: `${title} draft` },
      draft: true,
      overrideAccess: true,
    })
    expect(await storedTitleReadAlone(space.id)).toBe(title)

    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { title: `${title} renamed`, _status: 'published' } as never,
      overrideAccess: true,
    })
    expect(await storedTitleReadAlone(space.id)).toBe(`${title} renamed`)
  })

  it('cannot be written by an admin', async () => {
    const space = track(
      'spaces',
      await payload.create({
        collection: 'spaces',
        data: { kind: 'community', name: uniq('Locked name') } as never,
        overrideAccess: true,
      }),
    )
    const before = await storedTitleReadAlone(space.id)
    const admin = track(
      'users',
      await payload.create({
        collection: 'users',
        data: {
          email: `${uniq('name-admin')}@cilas.test`,
          password: crypto.randomUUID(),
          roles: ['admin'],
        },
        overrideAccess: true,
      }),
    )
    await payload.update({
      collection: 'spaces',
      id: space.id,
      data: { display_name: 'Typed by hand' } as never,
      user: admin,
      overrideAccess: false,
    })
    expect(await storedTitleReadAlone(space.id)).toBe(before)
  })
})
