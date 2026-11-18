import { readFile } from 'node:fs/promises'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getStudyCourses } from '@/api/courses.api'
import { getOpenNow } from '@/api/home.api'
import config from '@/payload.config'

import { runInRequest } from '../../testing/next-request.test-utils'
import { RUN, createTracker, uniq } from '../../testing/payload.fixture'

let payload: Payload
const { track, cleanup } = createTracker()
let courseId: number
let courseTitle: string
let courseCover: { url: string; alt: string }
let programmeTitle: string
let programmeCover: { url: string; alt: string }

const cover = async (name: string, alt: string, focalX: number, focalY: number) => {
  const data = await readFile(new URL('../../testing/files/pixel.png', import.meta.url))
  const media = track(
    'media',
    await payload.create({
      collection: 'media',
      data: { alt },
      file: { name: `${name}-${RUN}.png`, mimetype: 'image/png', data, size: data.length },
      overrideAccess: true,
    }),
  )
  await payload.update({
    collection: 'media',
    id: media.id,
    data: { focalX, focalY },
    overrideAccess: true,
  })
  return { id: media.id, url: media.url!, alt }
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Image probe', slug: uniq('registration-images-place'), city: uniq('Images') },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2036, place, start_date: '2036-10-04' },
      overrideAccess: true,
    }),
  ).id

  const courseImage = await cover('course-cover', 'Course cover', 0, 85)
  courseCover = courseImage
  courseTitle = `Registration image course ${RUN}`
  courseId = track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: courseTitle,
        slug: uniq('registration-images-course'),
        course_type: 'THEMATIC',
        tier: 'public',
        cycle,
        cover_image: courseImage.id,
        registration: { mode: 'own', method: 'external', url: 'https://example.org/apply' },
        _status: 'published',
      },
      overrideAccess: true,
    }),
  ).id
  const spaces = await payload.find({
    collection: 'spaces',
    where: { course: { equals: courseId } },
    depth: 0,
    overrideAccess: true,
  })
  for (const space of spaces.docs) {
    track('spaces', space)
    const posts = await payload.find({
      collection: 'space-posts',
      where: { space: { equals: space.id } },
      overrideAccess: true,
    })
    posts.docs.forEach((post) => track('space-posts', post))
  }

  const bridgeImage = await cover('bridge-cover', 'Bridge cover', 90, 0)
  programmeCover = bridgeImage
  programmeTitle = `Registration image programme ${RUN}`
  await payload
    .create({
      collection: 'programmes',
      data: {
        title: programmeTitle,
        slug: uniq('registration-images-programme'),
        kind: 'bridge',
        cover: bridgeImage.id,
        registration: { method: 'external', url: 'https://example.org/bridge' },
        _status: 'published',
      },
      overrideAccess: true,
    })
    .then((programme) => track('programmes', programme))
}, 120_000)

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('registration image metadata', () => {
  it('keeps the main cover and focal coordinates through the course index', async () => {
    const rows = await getStudyCourses(payload, 'en', (key) => key, ['public'])
    expect(rows.find((row) => row.id === courseId)).toMatchObject({
      image: courseCover.url,
      imageAlt: 'Course cover',
      imageFocalPoint: { focalX: 0, focalY: 85 },
    })
  })

  it('preserves the focal point for both programme and course posters', async () => {
    const { result: items } = await runInRequest(() => getOpenNow(payload, 'en'))
    expect(items.find((item) => item.title === programmeTitle)?.image).toEqual({
      src: programmeCover.url,
      alt: 'Bridge cover',
      focalX: 90,
      focalY: 0,
    })
    expect(items.find((item) => item.title === courseTitle)?.image).toEqual({
      src: courseCover.url,
      alt: 'Course cover',
      focalX: 0,
      focalY: 85,
    })
  })
})
