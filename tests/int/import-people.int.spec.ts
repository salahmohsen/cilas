// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { importCourses } from '../../migration/lib/import-courses'
import {
  importPeople,
  prunePeople,
  type ArchivePeopleData,
} from '../../migration/lib/import-people'

let payload: Payload

// Fixtures avoid the "/probe-" prefix and the fall 2031 Cairo cycle of the
// course import spec, so the two specs can run side by side.
const CYCLE_URL = '/probepeople-spring-2032.html'
const PROGRAMME = 'Probe People Bridge 2031–2032'
const PROBE = { name: { like: 'Probe People' } }

const data: ArchivePeopleData = {
  people: [
    {
      name: 'Probe People Student',
      name_ar: 'طالب',
      bio: 'A student.',
      email: null,
      photo: null,
      legacy_url: '/probepeople-cohort.html#student',
    },
    {
      name: 'Probe People Advisor',
      name_ar: null,
      bio: 'An advisor.',
      email: null,
      photo: null,
      legacy_url: '/probepeople-advisors.html#advisor',
    },
  ],
  programmes: [
    {
      title: PROGRAMME,
      year: '2031-2032',
      place: 'alexandria',
      verified: true,
      legacy_url: '/probepeople-cohort.html',
    },
  ],
  memberships: [
    {
      person: 'Probe People Student',
      programme: PROGRAMME,
      role: 'student',
      title: null,
      legacy_url: '/probepeople-cohort.html#student',
    },
  ],
  governance: [
    {
      person: 'Probe People Advisor',
      role: 'advisor',
      title: 'Professor of Probing',
      advises_on: 'probes',
      board_role: null,
      order: 1,
      legacy_url: '/probepeople-advisors.html#advisor',
    },
  ],
}

const probeIds = async (): Promise<number[]> =>
  (
    await payload.find({
      collection: 'people',
      where: PROBE,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
  ).docs.map((d) => d.id as number)

const cleanup = async () => {
  const ids = await probeIds()
  const del = (collection: Parameters<Payload['delete']>[0]['collection'], where: object) =>
    payload
      .delete({ collection, where, overrideAccess: true } as Parameters<Payload['delete']>[0])
      .catch(() => undefined)
  if (ids.length) {
    await del('memberships', { person: { in: ids } })
    await del('governance', { person: { in: ids } })
  }
  await del('programmes', { title: { like: 'Probe People' } })
  await del('cycles', { legacy_url: { like: '/probepeople-' } })
  await del('people', PROBE)
}

describe('archive people import', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
    // The cycle the probe programme should link to: academic year 2031–2032.
    await importCourses(payload, {
      cycles: [
        {
          key: 'probe',
          season: 'spring',
          start_year: 2032,
          space: 'al-Manshiya',
          legacy_url: CYCLE_URL,
        },
      ],
      courses: [],
    })
  })
  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  it('creates the people, and a second run creates nothing new', async () => {
    const first = await importPeople(payload, data)
    expect(first).toEqual({ people: 2, programmes: 1, memberships: 1, governance: 1 })

    const { docs } = await payload.find({
      collection: 'people',
      where: PROBE,
      depth: 0,
      overrideAccess: true,
      sort: 'name',
    })
    expect(docs.map((d) => d.name)).toEqual(['Probe People Advisor', 'Probe People Student'])
    const ar = await payload.findByID({
      collection: 'people',
      id: docs[1].id,
      locale: 'ar',
      fallbackLocale: false,
      overrideAccess: true,
    })
    expect(ar.name).toBe('طالب')

    const second = await importPeople(payload, data)
    expect(second).toEqual({ people: 0, programmes: 0, memberships: 0, governance: 0 })
    expect(await probeIds()).toHaveLength(2)
  })

  it('creates the programme as a draft with its cycle and two components per cycle', async () => {
    const cycle = (
      await payload.find({
        collection: 'cycles',
        where: { legacy_url: { equals: CYCLE_URL } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]
    expect(cycle.academic_year).toBe('2031–2032')

    const { docs } = await payload.find({
      collection: 'programmes',
      where: { title: { equals: PROGRAMME } },
      draft: true,
      depth: 0,
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ _status: 'draft', kind: 'bridge' })
    expect(docs[0].cycles).toContain(cycle.id)
    const mine = (docs[0].components ?? []).filter((c) => c.cycle === cycle.id)
    expect(mine.map((c) => [c.label, c.course_types])).toEqual([
      [`Core courses, ${cycle.title}`, ['CORE']],
      [`Thematic courses and labs, ${cycle.title}`, ['THEMATIC', 'LAB']],
    ])
  })

  it('keeps one membership per person and programme', async () => {
    const [student] = (
      await payload.find({
        collection: 'people',
        where: { name: { equals: 'Probe People Student' } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs
    const { docs } = await payload.find({
      collection: 'memberships',
      where: { person: { equals: student.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ role: 'student' })
    await expect(
      payload.create({
        collection: 'memberships',
        data: { person: student.id, programme: docs[0].programme as number, role: 'student' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('creates a governance row for the advisor', async () => {
    const { docs } = await payload.find({
      collection: 'governance',
      where: { legacy_url: { equals: '/probepeople-advisors.html#advisor' } },
      depth: 1,
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      role: 'advisor',
      title: 'Professor of Probing',
      advises_on: 'probes',
      order: 1,
    })
    expect((docs[0].person as { name: string }).name).toBe('Probe People Advisor')
  })

  it('prunes an unreferenced imported person, and keeps hand-added and referenced ones', async () => {
    for (const [name, legacy_url] of [
      ['Probe People Orphan', '/probe-people.html#orphan'],
      ['Probe People Reviewed', null],
    ] as const) {
      await payload.create({
        collection: 'people',
        data: {
          name,
          slug: name.toLowerCase().replaceAll(' ', '-'),
          ...(legacy_url ? { legacy_url } : {}),
        },
        overrideAccess: true,
      })
    }
    const pruned = await prunePeople(payload, { scope: PROBE })
    expect(pruned).toEqual(['Probe People Orphan'])

    const left = await payload.find({
      collection: 'people',
      where: PROBE,
      depth: 0,
      overrideAccess: true,
      sort: 'name',
    })
    expect(left.docs.map((d) => d.name)).toEqual([
      'Probe People Advisor',
      'Probe People Reviewed',
      'Probe People Student',
    ])
  })

  it('refuses to prune more than the limit', async () => {
    await payload.create({
      collection: 'people',
      data: {
        name: 'Probe People Orphan 2',
        slug: 'probe-people-orphan-2',
        legacy_url: '/probe-people.html#orphan-2',
      },
      overrideAccess: true,
    })
    await expect(prunePeople(payload, { scope: PROBE, limit: 0 })).rejects.toThrow(/refusing/)
    expect(await probeIds()).toHaveLength(4)
  })
})
