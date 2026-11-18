import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { postRemoveAction } from '@/lib/space-actions'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { navigationOutcome } from '../../testing/redirect.test-utils'
import { runInRequest } from '../../testing/next-request.test-utils'
import { createTracker, lockSpacesMode, uniq, uniqEmail } from '../../testing/payload.fixture'
import { signedInHeaders } from '../../testing/reader.test-utils'

let payload: Payload
const { track, cleanup } = createTracker()
let beforeMode: 'off' | 'trial' | 'on' | null | undefined
let unlock: (() => Promise<void>) | undefined
let space: number
let fellow: { person: number; headers: HeadersInit }
let student: { person: number; headers: HeadersInit }

const account = async (name: string, roles: User['roles']) => {
  const person = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name, slug: uniq(name) },
      overrideAccess: true,
    }),
  ).id
  const password = crypto.randomUUID()
  const email = uniqEmail(name)
  track(
    'users',
    await payload.create({
      collection: 'users',
      data: { email, password, roles, person },
      overrideAccess: true,
    }),
  )
  return { person, headers: await signedInHeaders(payload, { email, password }) }
}

const post = async () =>
  track(
    'space-posts',
    await payload.create({
      collection: 'space-posts',
      data: { space, kind: 'discussion', body: 'To delete', author: fellow.person },
      overrideAccess: true,
    }),
  ).id

const remove = (id: number, pathname: string, headers = fellow.headers) => {
  const form = new FormData()
  form.set('post', String(id))
  form.set('pathname', pathname)
  return runInRequest(() => navigationOutcome(() => postRemoveAction({ status: 'ok' }, form)), {
    headers,
  })
}

const exists = async (id: number) =>
  (
    await payload.count({
      collection: 'space-posts',
      where: { id: { equals: id } },
      overrideAccess: true,
    })
  ).totalDocs === 1

beforeAll(async () => {
  unlock = await lockSpacesMode()
  payload = await getPayload({ config: await config })
  beforeMode = (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true }))
    .spaces_mode
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { spaces_mode: 'on' },
    overrideAccess: true,
  })
  fellow = await account('remove-fellow', ['fellow'])
  student = await account('remove-student', ['member'])
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Remove place', slug: uniq('remove-place'), city: uniq('Remove') },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2038, place, start_date: '2038-10-04' },
      overrideAccess: true,
    }),
  ).id
  const course = track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: 'Remove probe',
        slug: uniq('remove-probe'),
        course_type: 'THEMATIC',
        tier: 'public',
        cycle,
        fellows: [fellow.person],
        registration: { mode: 'closed' },
        _status: 'published',
      },
      overrideAccess: true,
    }),
  ).id
  const spaces = await payload.find({
    collection: 'spaces',
    where: { course: { equals: course } },
    depth: 0,
    overrideAccess: true,
  })
  space = spaces.docs[0]!.id
  track('spaces', space)
  const posts = await payload.find({
    collection: 'space-posts',
    where: { space: { equals: space } },
    overrideAccess: true,
  })
  posts.docs.forEach((doc) => track('space-posts', doc))
  track(
    'enrollments',
    await payload.create({
      collection: 'enrollments',
      data: { person: student.person, course, status: 'confirmed', source: 'admin' },
      overrideAccess: true,
    }),
  )
}, 600_000)

afterAll(async () => {
  if (payload) {
    await cleanup(payload)
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: beforeMode ?? 'off' },
      overrideAccess: true,
    })
    await payload.destroy()
  }
  await unlock?.()
})

describe('deleting an open post', () => {
  it.each(['en/spaces/community/3', 'ar/spaces/course/my-course', 'en/spaces/cohort/autumn'])(
    'revalidates and redirects to /%s instead of rendering the missing post',
    async (feed) => {
      const id = await post()
      const { result, revalidated } = await remove(id, `/${feed}/posts/${id}`)
      expect(result).toEqual({ redirect: `/${feed}` })
      expect(revalidated).toContain('_N_T_/en/spaces/layout')
      expect(await exists(id)).toBe(false)
    },
  )

  it.each([
    '/en/spaces/community/3',
    '//evil.com/spaces/course/x/posts/POST',
    '/en/spaces/course/x/posts/OTHER',
  ])('does not redirect from an unrelated path: %s', async (template) => {
    const id = await post()
    const path = template.replace('POST', String(id)).replace('OTHER', String(id + 1))
    const { result } = await remove(id, path)
    expect(result).toEqual({ returned: { status: 'ok' } })
  })

  it('leaves the post open when deletion fails', async () => {
    const id = await post()
    const { result, revalidated } = await remove(
      id,
      `/en/spaces/community/3/posts/${id}`,
      student.headers,
    )
    expect(result).toEqual({ returned: { status: 'error', error: 'not-yours' } })
    expect(revalidated).toEqual([])
    expect(await exists(id)).toBe(true)
  })
})
