// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Course } from '@/payload-types'
import {
  importCourses,
  type ArchiveCourse,
  type ArchiveCycle,
} from '../../migration/lib/import-courses'
import { importFlows, NOTES_HEADING, NOTES_HEADING_AR } from '../../migration/lib/import-flows'
import type { Syllabus } from '../../migration/lib/syllabus-schema'
import { RUN } from './fixtures'

let payload: Payload

// Fixtures use the "/probeflows-" prefix and a 2033 cycle, apart from the
// other import specs, so they can run side by side.
const P = `/probeflows-${RUN}`
const CYCLE_URL = `${P}-fall-2033.html`
// The place is matched by name, so a unique one keeps old runs' cycles out.
const PLACE = `Probe Flows Space ${RUN}`
const url = (name: string) => `${CYCLE_URL}#${name}`
const cycles: ArchiveCycle[] = [
  {
    key: 'fall-2033-probe',
    season: 'fall',
    start_year: 2033,
    space: PLACE,
    legacy_url: CYCLE_URL,
  },
]
const course = (name: string): ArchiveCourse => ({
  legacy_url: url(name),
  cycle: 'fall-2033-probe',
  title: `Probe Flows ${name} ${RUN}`,
  title_ar: null,
  subtitle: null,
  course_type: 'SHORT',
  fellows: [],
  location: ['ONLINE'],
  schedule: { start_precision: 'day', slots: [] },
  description: 'The course.',
  flow_uploads: [],
  register_url: null,
})
const archived = ['english', 'arabic'].map(course)

const english: Syllabus = {
  session_unit: 'week',
  sessions: [
    {
      order: 1,
      title: 'Walking the city',
      description: 'Why walk?\n\nWhere to?',
      meetings: null,
      materials: [
        {
          type: 'reading',
          title: 'The Arcades Project',
          note: 'Benjamin, pp. 1-20',
          href: 'https://example.org/arcades',
        },
      ],
      activities: [{ kind: 'field_visit', description: 'A walk through al-Ghuria' }],
    },
    {
      order: 2,
      title: 'Mapping',
      description: '',
      meetings: 2,
      materials: [{ type: 'watch', title: 'A film', note: null, href: null }],
      activities: [],
    },
  ],
  bibliography: [
    { type: 'reading', title: 'General reading', note: null, href: 'https://example.org/general' },
  ],
  notes: 'Assessment by essay.',
}

const arabic: Syllabus = {
  session_unit: 'session',
  sessions: [
    {
      order: 1,
      title: 'تاريخ القضاء',
      description: 'كيف تطور النظام القضائي؟',
      meetings: null,
      materials: [
        {
          type: 'reading',
          title: 'تاريخ القضاء المصري الحديث',
          note: 'لطيفة سالم',
          href: 'https://example.org/qada',
        },
      ],
      activities: [{ kind: 'discussion', description: 'نقاش مفتوح' }],
    },
    {
      order: 2,
      title: 'محاكم الشريعة',
      description: '',
      meetings: null,
      materials: [],
      activities: [],
    },
  ],
  bibliography: [{ type: 'reading', title: 'قراءة عامة', note: null, href: null }],
  notes: 'التقييم بالمقالة.',
}

const flows = [
  { id: 'probe-english', courses: [url('english')] },
  { id: 'probe-arabic', courses: [url('arabic')] },
  { id: 'probe-unextracted', courses: [url('english')] },
]
const syllabi = new Map([
  ['probe-english', english],
  ['probe-arabic', arabic],
])
const run = () => importFlows(payload, { flows, syllabi, courses: archived })

const find = async (name: string, locale: 'en' | 'ar' = 'en'): Promise<Course> => {
  const { docs } = await payload.find({
    collection: 'courses',
    where: { legacy_url: { equals: url(name) } },
    draft: true,
    depth: 0,
    locale,
    fallbackLocale: false,
    overrideAccess: true,
  })
  return docs[0]
}
const plain = (doc: unknown): string => JSON.stringify(doc ?? null)
// Either heading counts: Arabic flows get the Arabic one.
const headings = (c: Course): number => {
  const text = plain(c.description)
  return text.split(NOTES_HEADING).length - 1 + text.split(NOTES_HEADING_AR).length - 1
}

const cleanup = async () => {
  for (const [collection, where] of [
    ['courses', { legacy_url: { like: P } }],
    ['cycles', { legacy_url: { like: P } }],
    ['places', { name: { equals: PLACE } }],
  ] as const) {
    await payload.delete({ collection, where, overrideAccess: true }).catch(() => undefined)
  }
}

describe('course flow import', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await importCourses(payload, { cycles, courses: archived })
  })
  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  it('writes an English syllabus into its course', async () => {
    const result = await run()
    expect(result).toEqual({ courses: 2, sessions: 4, skipped: [] })

    const c = await find('english')
    expect(c.session_unit).toBe('week')
    expect(c.sessions?.map((s) => [s.order, s.session_title, s.meetings ?? null])).toEqual([
      [1, 'Walking the city', null],
      [2, 'Mapping', 2],
    ])
    expect(c.sessions?.[0].bibliography).toMatchObject([
      {
        type: 'reading',
        title: 'The Arcades Project',
        note: 'Benjamin, pp. 1-20',
        href: 'https://example.org/arcades',
      },
    ])
    expect(c.sessions?.[0].activities).toMatchObject([
      { kind: 'field_visit', description: 'A walk through al-Ghuria' },
    ])
    expect(plain(c.sessions?.[0].description)).toContain('Where to?')
    expect(c.bibliography).toMatchObject([
      { type: 'reading', title: 'General reading', href: 'https://example.org/general' },
    ])
    expect(plain(c.description)).toContain('The course.')
    // The flow's notes are the fellow's note, not part of the description.
    expect(c.facilitator_note).toBe('Assessment by essay.')
    expect(headings(c)).toBe(0)
  })

  it('writes an Arabic syllabus into the ar locale, on the same rows', async () => {
    const ar = await find('arabic', 'ar')
    expect(ar.sessions?.map((s) => s.session_title)).toEqual(['تاريخ القضاء', 'محاكم الشريعة'])
    expect(ar.sessions?.[0].bibliography).toMatchObject([
      {
        type: 'reading',
        title: 'تاريخ القضاء المصري الحديث',
        note: 'لطيفة سالم',
        href: 'https://example.org/qada',
      },
    ])
    expect(ar.sessions?.[0].activities).toMatchObject([
      { kind: 'discussion', description: 'نقاش مفتوح' },
    ])
    expect(plain(ar.sessions?.[0].description)).toContain('"direction":"rtl"')
    expect(ar.bibliography).toMatchObject([{ type: 'reading', title: 'قراءة عامة' }])
    expect(ar.facilitator_note).toBe('التقييم بالمقالة.')
    expect(headings(ar)).toBe(0)

    const en = await find('arabic', 'en')
    expect(en.session_unit).toBe('session')
    expect(en.sessions).toHaveLength(2)
    expect(en.sessions?.map((s) => s.id)).toEqual(ar.sessions?.map((s) => s.id))
    // The English side is not given the Arabic notes.
    expect(plain(en.description)).toContain('The course.')
    expect(en.facilitator_note ?? null).toBeNull()
  })

  it('keeps English text when an ar update lands on the same rows', async () => {
    const before = await find('arabic', 'en')
    await payload.update({
      collection: 'courses',
      id: before.id,
      data: {
        sessions: (before.sessions ?? []).map((s, i) => ({
          ...s,
          session_title: `English ${i + 1}`,
        })),
      },
      locale: 'en',
      draft: true,
      overrideAccess: true,
    })
    const en = await find('arabic', 'en')
    expect(en.sessions?.map((s) => s.session_title)).toEqual(['English 1', 'English 2'])
    const ar = await find('arabic', 'ar')
    await payload.update({
      collection: 'courses',
      id: ar.id,
      data: {
        sessions: (ar.sessions ?? []).map((s) => ({ ...s, session_title: `${s.session_title}!` })),
      },
      locale: 'ar',
      draft: true,
      overrideAccess: true,
    })
    expect((await find('arabic', 'en')).sessions?.map((s) => s.session_title)).toEqual(
      en.sessions?.map((s) => s.session_title),
    )
    expect((await find('arabic', 'ar')).sessions?.map((s) => s.session_title)).toEqual([
      'تاريخ القضاء!',
      'محاكم الشريعة!',
    ])
  })

  it('does not duplicate sessions or notes on a re-run', async () => {
    await run()
    const en = await find('english')
    expect(en.sessions).toHaveLength(2)
    expect(en.sessions?.[0].bibliography).toHaveLength(1)
    expect(en.bibliography).toHaveLength(1)
    expect(en.facilitator_note).toBe('Assessment by essay.')

    const ar = await find('arabic', 'ar')
    expect(ar.sessions?.map((s) => s.session_title)).toEqual(['تاريخ القضاء', 'محاكم الشريعة'])
    expect(ar.facilitator_note).toBe('التقييم بالمقالة.')
    expect((await find('arabic', 'en')).sessions).toHaveLength(2)
  })
})
