import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { memberEmails, segmentDiff } from '@/lib/list-members'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { createTracker, uniq, uniqEmail } from '../../testing/payload.fixture'

let payload: Payload
const { track, cleanup } = createTracker()

let course: number
let programme: number
const emailOf = new Map<string, string>()
const account = new Map<string, number>()

const makeAccount = async (name: string, roles: User['roles'], withPerson = true) => {
  const person = withPerson
    ? track(
        'people',
        await payload.create({
          collection: 'people',
          data: { name, slug: uniq(name) },
          overrideAccess: true,
        }),
      ).id
    : undefined
  const email = uniqEmail(name)
  const user = track(
    'users',
    await payload.create({
      collection: 'users',
      data: { email, password: crypto.randomUUID(), roles, person },
      overrideAccess: true,
    }),
  )
  emailOf.set(name, email.toLowerCase())
  account.set(name, user.id)
  return { person, user }
}

const emails = (...names: string[]) => names.map((name) => emailOf.get(name)!).sort()

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const fellow = await makeAccount('listfellow', ['fellow'])
  const student = await makeAccount('liststudent', ['member'])
  const applicant = await makeAccount('listapplicant', ['member'])
  const bridge = await makeAccount('listbridge', ['member'])
  await makeAccount('listchosen', ['member'], false)
  await makeAccount('listother', ['member'])
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'List place', slug: uniq('list-place'), city: uniq('Probe') },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2037, place, start_date: '2037-10-04' },
      overrideAccess: true,
    }),
  ).id
  course = track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: 'List members probe',
        slug: uniq('list-members'),
        course_type: 'THEMATIC',
        tier: 'public',
        cycle,
        fellows: [fellow.person!],
        registration: { mode: 'closed' },
        _status: 'published',
      },
      overrideAccess: true,
    }),
  ).id
  for (const [who, status] of [
    [student, 'accepted'],
    [applicant, 'applied'],
  ] as const)
    track(
      'enrollments',
      await payload.create({
        collection: 'enrollments',
        data: { person: who.person!, course, status, source: 'admin' },
        overrideAccess: true,
      }),
    )
  programme = track(
    'programmes',
    await payload.create({
      collection: 'programmes',
      data: { kind: 'bridge', title: 'List probe', slug: uniq('list-probe') },
      overrideAccess: true,
    }),
  ).id
  track(
    'memberships',
    await payload.create({
      collection: 'memberships',
      data: { person: bridge.person!, programme, role: 'student' },
      overrideAccess: true,
    }),
  )
})

afterAll(() => cleanup(payload))

describe('memberEmails', () => {
  it('unions programmes and chosen accounts, each address once', async () => {
    const found = await memberEmails(payload, {
      programmes: [programme],
      users: [{ id: account.get('listchosen')! }, account.get('listfellow')!],
    })
    expect(found).toEqual(emails('listbridge', 'listchosen', 'listfellow'))
  })

  it('adds every account that holds a role', async () => {
    const found = await memberEmails(payload, { roles: ['fellow'] })
    expect(found).toContain(emailOf.get('listfellow'))
    expect(found).not.toContain(emailOf.get('listother'))
    expect(new Set(found).size).toBe(found.length)
  })

  it('takes a course’s enrolled students and its fellows, not its applicants', async () => {
    expect(await memberEmails(payload, { courses: [course] })).toEqual(
      emails('listfellow', 'liststudent'),
    )
    expect(await memberEmails(payload, { courses: [course], course_people: ['students'] })).toEqual(
      emails('liststudent'),
    )
  })

  it('holds nobody without a rule, and every account with “everyone”', async () => {
    expect(await memberEmails(payload, {})).toEqual([])
    const everyone = await memberEmails(payload, { everyone: true })
    const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })
    expect(everyone).toHaveLength(totalDocs)
    expect(everyone).toContain(emailOf.get('listother'))
  })
})

describe('segmentDiff', () => {
  it('adds the missing and removes who left, ignoring case', () => {
    expect(
      segmentDiff(['a@x.org', 'b@x.org'], [{ email: 'B@x.org' }, { email: 'c@x.org' }]),
    ).toEqual({ add: ['a@x.org'], remove: ['c@x.org'] })
  })
})
