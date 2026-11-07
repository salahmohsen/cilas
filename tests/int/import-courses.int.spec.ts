// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import {
  importCourses,
  type ArchiveCourse,
  type ArchiveCycle,
} from '../../migration/lib/import-courses'
import { RUN, uniq } from './fixtures'

let payload: Payload

// Every fixture carries the run suffix: legacy URLs, titles (so slugs), the
// fellow and the place. A leftover from another run never collides.
const P = `/probe-${RUN}`
const CYCLE_URL = `${P}-fall-2031.html`
const COURSE_URL = `${CYCLE_URL}#probe-course`
const PLACE = `Probe Import Space ${RUN}`
const FELLOW = `Probe Import Fellow ${RUN}`
const TWIN = `Probe Import Twin ${RUN}`
const TWIN_SLUG = uniq('probe-import-twin')

const cycles: ArchiveCycle[] = [
  {
    key: 'fall-2031-probe',
    season: 'fall',
    start_year: 2031,
    space: PLACE,
    legacy_url: CYCLE_URL,
  },
]
const course = (over: Partial<ArchiveCourse> = {}): ArchiveCourse => ({
  legacy_url: COURSE_URL,
  cycle: 'fall-2031-probe',
  title: `Probe Import Course ${RUN}`,
  title_ar: null,
  subtitle: null,
  course_type: 'SHORT',
  fellows: [{ name: FELLOW, email: null, bio: 'A fellow.' }],
  location: ['ONLINE'],
  schedule: { start_precision: 'day', slots: [], note: 'Tuesdays' },
  description: 'First paragraph.\n\nSecond paragraph.',
  flow_uploads: [],
  register_url: 'https://forms.gle/probe',
  ...over,
})

const cleanup = async () => {
  for (const [collection, where] of [
    ['courses', { legacy_url: { like: P } }],
    ['cycles', { legacy_url: { like: P } }],
    ['people', { name: { equals: FELLOW } }],
    ['places', { name: { equals: PLACE } }],
  ] as const) {
    await payload.delete({ collection, where, overrideAccess: true }).catch(() => undefined)
  }
}

describe('archive course import', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })
  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  it('imports a course published but needing review, with its cycle and fellow', async () => {
    const result = await importCourses(payload, { cycles, courses: [course()] })
    expect(result).toMatchObject({ cycles: 1, courses: 1, people: 1, skipped: [] })

    const { docs } = await payload.find({
      collection: 'courses',
      where: { legacy_url: { equals: COURSE_URL } },
      draft: true,
      overrideAccess: true,
      depth: 1,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ _status: 'published', tier: 'public' })
    expect(docs[0].registration?.archived_registration_url).toBe('https://forms.gle/probe')
    expect((docs[0].fellows as Array<{ name: string }>).map((f) => f.name)).toEqual([FELLOW])
  })

  it('is idempotent', async () => {
    await importCourses(payload, { cycles, courses: [course()] })
    const { totalDocs } = await payload.count({
      collection: 'courses',
      where: { legacy_url: { like: P } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(1)
  })

  it('skips a course with no cycle, and reports it', async () => {
    const result = await importCourses(payload, {
      cycles,
      courses: [course({ legacy_url: `${P}-orphan.html`, cycle: null })],
    })
    expect(result.skipped).toEqual([`${P}-orphan.html`])
  })

  it('lands two courses with one title, the second under a year-suffixed slug', async () => {
    const twin = (n: number) =>
      course({
        legacy_url: `${P}-twin-${n}.html`,
        title: TWIN,
        fellows: [],
        title_ar: n === 1 ? 'توأم' : null,
      })
    await importCourses(payload, { cycles, courses: [twin(1), twin(2)] })
    const { docs } = await payload.find({
      collection: 'courses',
      where: { legacy_url: { like: `${P}-twin-` } },
      draft: true,
      overrideAccess: true,
      sort: 'legacy_url',
    })
    expect(docs.map((d) => d.slug)).toEqual([TWIN_SLUG, `${TWIN_SLUG}-2031`])

    const ar = await payload.findByID({
      collection: 'courses',
      id: docs[0].id,
      draft: true,
      locale: 'ar',
      overrideAccess: true,
    })
    expect(ar.title).toBe('توأم')

    // A re-run updates both in place and keeps their slugs.
    await importCourses(payload, { cycles, courses: [twin(1), twin(2)] })
    const again = await payload.find({
      collection: 'courses',
      where: { legacy_url: { like: `${P}-twin-` } },
      draft: true,
      overrideAccess: true,
      sort: 'legacy_url',
    })
    expect(again.docs.map((d) => d.slug)).toEqual([TWIN_SLUG, `${TWIN_SLUG}-2031`])
  })
})
