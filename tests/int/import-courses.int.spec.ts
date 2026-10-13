// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { importCourses, type ArchiveCourse, type ArchiveCycle } from '../../migration/lib/import-courses'

let payload: Payload

const cycles: ArchiveCycle[] = [
  { key: 'fall-2031-Darb el-Labbana', season: 'fall', start_year: 2031, space: 'Darb el-Labbana', legacy_url: '/probe-fall-2031.html' },
]
const course = (over: Partial<ArchiveCourse> = {}): ArchiveCourse => ({
  legacy_url: '/probe-fall-2031.html#probe-course',
  cycle: 'fall-2031-Darb el-Labbana',
  title: 'Probe Import Course',
  title_ar: null,
  subtitle: null,
  course_type: 'SHORT',
  fellows: [{ name: 'Probe Import Fellow', email: null, bio: 'A fellow.' }],
  location: ['ONLINE'],
  schedule: { start_precision: 'day', slots: [], note: 'Tuesdays' },
  description: 'First paragraph.\n\nSecond paragraph.',
  flow_uploads: [],
  register_url: 'https://forms.gle/probe',
  ...over,
})

const cleanup = async () => {
  for (const [collection, where] of [
    ['courses', { legacy_url: { like: '/probe-' } }],
    ['cycles', { legacy_url: { like: '/probe-' } }],
    ['people', { name: { like: 'Probe Import' } }],
  ] as const) {
    await payload.delete({ collection, where, overrideAccess: true }).catch(() => undefined)
  }
}

describe('archive course import', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
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
      where: { legacy_url: { equals: '/probe-fall-2031.html#probe-course' } },
      draft: true,
      overrideAccess: true,
      depth: 1,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ _status: 'published', tier: 'public' })
    expect(docs[0].registration?.archived_registration_url).toBe('https://forms.gle/probe')
    expect((docs[0].fellows as Array<{ name: string }>).map((f) => f.name)).toEqual(['Probe Import Fellow'])
  })

  it('is idempotent', async () => {
    await importCourses(payload, { cycles, courses: [course()] })
    const { totalDocs } = await payload.count({
      collection: 'courses',
      where: { legacy_url: { like: '/probe-' } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(1)
  })

  it('skips a course with no cycle, and reports it', async () => {
    const result = await importCourses(payload, {
      cycles,
      courses: [course({ legacy_url: '/probe-orphan.html', cycle: null })],
    })
    expect(result.skipped).toEqual(['/probe-orphan.html'])
  })

  it('lands two courses with one title, the second under a year-suffixed slug', async () => {
    const twin = (n: number) =>
      course({ legacy_url: `/probe-twin-${n}.html`, title: 'Probe Import Twin', fellows: [], title_ar: n === 1 ? 'توأم' : null })
    await importCourses(payload, { cycles, courses: [twin(1), twin(2)] })
    const { docs } = await payload.find({
      collection: 'courses',
      where: { legacy_url: { like: '/probe-twin-' } },
      draft: true,
      overrideAccess: true,
      sort: 'legacy_url',
    })
    expect(docs.map((d) => d.slug)).toEqual(['probe-import-twin', 'probe-import-twin-2031'])

    const ar = await payload.findByID({ collection: 'courses', id: docs[0].id, draft: true, locale: 'ar', overrideAccess: true })
    expect(ar.title).toBe('توأم')

    // A re-run updates both in place and keeps their slugs.
    await importCourses(payload, { cycles, courses: [twin(1), twin(2)] })
    const again = await payload.find({
      collection: 'courses',
      where: { legacy_url: { like: '/probe-twin-' } },
      draft: true,
      overrideAccess: true,
      sort: 'legacy_url',
    })
    expect(again.docs.map((d) => d.slug)).toEqual(['probe-import-twin', 'probe-import-twin-2031'])
  })
})
