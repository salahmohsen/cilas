import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { createTracker, uniq, uniqEmail } from '../../testing/payload.fixture'

type Role = User['roles'][number]

let payload: Payload
let cycle: number
const { track, cleanup } = createTracker()

const person = async (name: string) =>
  track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name, slug: uniq(name.toLowerCase().replace(/\W+/g, '-')) },
      overrideAccess: true,
    }),
  ).id

const teacher = async (name: string) => {
  const id = await person(name)
  track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: `${name} course`,
        slug: uniq(`user-link-${Math.random().toString(36).slice(2, 6)}`),
        course_type: 'THEMATIC',
        tier: 'public',
        cycle,
        fellows: [id],
        registration: { mode: 'closed' },
        _status: 'published',
      },
      overrideAccess: true,
    }),
  )
  return id
}

const account = async (name: string, roles: Role[], linked?: number) =>
  track(
    'users',
    (await payload.create({
      collection: 'users',
      data: {
        email: uniqEmail(name.toLowerCase().replace(/\W+/g, '-')),
        password: crypto.randomUUID(),
        roles,
        ...(linked === undefined ? {} : { person: linked }),
      },
      overrideAccess: true,
    })) as unknown as User,
  )

const rolesOf = async (user: User) =>
  (await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true }))
    .roles

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'User link place', slug: uniq('user-link-place'), city: uniq('Probe') },
      overrideAccess: true,
    }),
  ).id
  cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2036, place, start_date: '2036-10-04' },
      overrideAccess: true,
    }),
  ).id
})

afterAll(async () => {
  await cleanup(payload)
})

describe('syncFellowRoleOnLink', () => {
  it('grants fellow when linked to a person who teaches', async () => {
    const user = await account('Link grants', ['member'])
    const teaching = await teacher('Link grants teacher')
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { person: teaching },
      overrideAccess: true,
    })
    expect(await rolesOf(user)).toEqual(['member', 'fellow'])
  })

  it('leaves roles alone when the person does not teach', async () => {
    const user = await account('Link idle', ['member'])
    const idle = await person('Link idle person')
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { person: idle },
      overrideAccess: true,
    })
    expect(await rolesOf(user)).toEqual(['member'])
  })

  it('revokes fellow when unlinked', async () => {
    const teaching = await teacher('Link revokes teacher')
    const user = await account('Link revokes', ['member', 'fellow'], teaching)
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { person: null },
      overrideAccess: true,
    })
    expect(await rolesOf(user)).toEqual(['member'])
  })

  it('ignores saves that do not touch person', async () => {
    const teaching = await teacher('Link ignores teacher')
    const user = await account('Link ignores', ['member'], teaching)
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { roles: ['admin'] },
      overrideAccess: true,
    })
    expect(await rolesOf(user)).toEqual(['admin'])
  })

  it('uses roles from the same save when present', async () => {
    const teaching = await teacher('Link same save teacher')
    const user = await account('Link same save', ['admin'], teaching)
    expect(await rolesOf(user)).toEqual(['admin', 'fellow'])
  })
})
