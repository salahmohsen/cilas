// @vitest-environment node
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import config from '@/payload.config'
import { env } from '@/env'
import { MCP_TOOLS } from '@/plugins/mcp'
import { expandSchedule } from '@/lib/schedule'
import { footnotesOf } from '@/lib/footnotes'
import { createTracker, uniq, uniqEmail } from './fixtures'

const { track, cleanup } = createTracker()
let payload: Payload
let admin: import('@/payload-types').User
let cycle: number
let person: number
async function call(name: string, data: Record<string, unknown>) {
  const req = await createLocalReq({ user: { ...admin, collection: 'users' } as never }, payload)
  const result = (await MCP_TOOLS.find((tool) => tool.name === name)!.handler(
    data,
    req,
    {},
  )) as import('@/plugins/mcp/types').ToolResult
  const text = result.content[0]!.text as string
  return { ...result, text, json: result.isError ? null : JSON.parse(text) }
}
const schedule = {
  start_date: '2024-09-22',
  start_precision: 'day',
  weeks: 8,
  slots: [{ weekday: 'sun', start_time: '17:30', end_time: '20:00' }],
  note: { en: 'First 4 online, last 4 offline', ar: 'أول أربع جلسات عبر الإنترنت وآخر أربع حضوريًا' },
}
const courseInput = () => ({
  title: { en: uniq('MCP schedule'), ar: 'دورة تجريبية' },
  cycle,
  course_type: 'THEMATIC',
  location: ['HYBRID'],
  schedule,
  sessions: Array.from({ length: 8 }, (_, i) => ({
    order: i + 1,
    delivery: i < 4 ? 'ONLINE' : 'OFFLINE',
    session_title: { en: `Session ${i + 1}`, ar: `جلسة ${i + 1}` },
    description: { en: 'Reading and discussion', ar: 'قراءة ومناقشة' },
  })),
})

describe('complete MCP draft writes', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    admin = track(
      'users',
      await payload.create({
        collection: 'users',
        data: { email: uniqEmail('drafts-admin'), password: crypto.randomUUID(), roles: ['admin'] },
      }),
    )
    person = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: uniq('MCP author'), slug: uniq('mcp-author') },
      }),
    ).id
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: {
          name: uniq('MCP draft place'),
          slug: uniq('mcp-draft-place'),
          city: uniq('MCP draft city'),
        },
      }),
    )
    cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2088, place: place.id },
      }),
    ).id
  })
  afterAll(async () => {
    vi.restoreAllMocks()
    await cleanup(payload)
    await payload.destroy()
  })

  it('refuses Saturday/Sunday conflict before creating anything; saves corrected schedule and bilingual nested flow', async () => {
    const input = courseInput()
    const before = await payload.count({ collection: 'courses' })
    const refused = await call('create_course_draft', {
      ...input,
      schedule: { ...schedule, start_date: '2024-09-21' },
    })
    expect(refused.isError).toBe(true)
    expect(refused.text).toMatch(/2024-09-21.*Saturday.*Sunday/)
    expect((await payload.count({ collection: 'courses' })).totalDocs).toBe(before.totalDocs)
    const result = await call('create_course_draft', input)
    expect(result.isError, result.text).toBeFalsy()
    const id = track('courses', result.json).id
    for (const locale of ['en', 'ar'] as const) {
      const course = await payload.findByID({
        collection: 'courses',
        id,
        draft: true,
        locale,
        depth: 0,
        fallbackLocale: false,
      })
      expect(course.sessions).toHaveLength(8)
      expect(course.sessions!.map((session) => session.delivery)).toEqual([
        'ONLINE',
        'ONLINE',
        'ONLINE',
        'ONLINE',
        'OFFLINE',
        'OFFLINE',
        'OFFLINE',
        'OFFLINE',
      ])
      expect(course.location).toEqual(['HYBRID'])
      expect(course.schedule?.note).toBe(schedule.note[locale])
      expect(course.sessions![0]!.session_title).toBe(input.sessions[0]!.session_title[locale])
      const meetings = expandSchedule(course.schedule, course.sessions)
      expect(meetings).toHaveLength(8)
      expect(meetings.map((m) => m.date)).toEqual([
        '2024-09-22',
        '2024-09-29',
        '2024-10-06',
        '2024-10-13',
        '2024-10-20',
        '2024-10-27',
        '2024-11-03',
        '2024-11-10',
      ])
      expect(meetings.every((m) => m.start_time === '17:30' && m.end_time === '20:00')).toBe(true)
    }
  })

  it('preserves explicit session dates; validates pricing, times and conditional applicant questions', async () => {
    const input = courseInput()
    const dates = [{ date: '2024-09-25', start_time: '18:00', end_time: '21:00' }]
    const result = await call('create_course_draft', { ...input, sessions: [{ order: 1, dates }] })
    expect(result.isError, result.text).toBeFalsy()
    const id = track('courses', result.json).id
    const course = await payload.findByID({ collection: 'courses', id, draft: true })
    expect(expandSchedule(course.schedule, course.sessions)[0]).toMatchObject({
      date: '2024-09-25',
      start_time: '18:00',
      end_time: '21:00',
    })
    for (const changes of [
      { pricing_override: { options: [{ amount: 10, default: false }] } },
      { pricing_override: { options: [{ amount: -1, default: true }] } },
      {
        pricing_override: {
          options: [
            { amount: 10, default: true },
            { amount: 20, default: true },
          ],
        },
      },
      {
        schedule: {
          ...schedule,
          slots: [{ weekday: 'sun', start_time: '25:00', end_time: '20:00' }],
        },
      },
    ])
      expect((await call('update_course_draft', { id, ...changes })).isError).toBe(true)
    const external = await call('update_course_draft', {
      id,
      registration: { mode: 'own', method: 'external', url: 'https://example.org' },
      applicant_questions: [{ blockType: 'text', name: 'unused' }],
    })
    expect(external.isError, external.text).toBeFalsy()
    const questionsOnly = await call('update_course_draft', {
      id,
      applicant_questions: [{ blockType: 'text', name: 'still-unused' }],
    })
    expect(questionsOnly.isError, questionsOnly.text).toBeFalsy()
  })

  it.each([
    'Literal code: `[^n]` and `[example](javascript:example)`',
    'Escaped: \\[^n]',
    '~~~~\n[^n]: literal code\n```\n~~~~',
  ])('preserves literal footnote examples: %s', async (body) => {
    const result = await call('create_article_draft', {
      title: { en: uniq(`Literal footnote ${crypto.randomUUID()}`) },
      authors: [person],
      body: { en: body },
    })
    expect(result.isError, result.text).toBeFalsy()
    const id = track('articles', result.json).id
    const article = await payload.findByID({ collection: 'articles', id, draft: true, depth: 0 })
    expect(JSON.stringify(article.body)).toContain('[^n]')
    expect(footnotesOf(article.body)).toHaveLength(0)
  })

  it('rejects rolled-over timestamps without creating a course', async () => {
    const before = await payload.count({ collection: 'courses' })
    for (const start_date of ['2026-02-30T12:00:00Z', '2026-04-31T10:00:00+02:00']) {
      const result = await call('create_course_draft', {
        ...courseInput(),
        schedule: { ...schedule, start_date },
      })
      expect(result.isError, result.text).toBe(true)
      expect(result.text).toContain('valid calendar day')
    }
    expect((await payload.count({ collection: 'courses' })).totalDocs).toBe(before.totalDocs)
  })

  it('retains authors when a correction tries to remove all required authors', async () => {
    const result = await call('create_article_draft', {
      title: { en: uniq('Required author') },
      authors: [person],
      body: { en: 'Text' },
    })
    const id = track('articles', result.json).id
    const update = await call('update_article_draft', { id, authors: [] })
    expect(update.isError).toBe(true)
    const article = await payload.findByID({ collection: 'articles', id, draft: true, depth: 0 })
    expect(article.authors).toEqual([person])
  })

  it('uses Markdown label semantics for real footnotes and refuses unsafe reference links', async () => {
    const result = await call('create_article_draft', {
      title: { en: uniq('Markdown notes') },
      authors: [person],
      body: { en: 'Text[^N].\n\n[^n]: A real note.' },
    })
    expect(result.isError, result.text).toBeFalsy()
    const id = track('articles', result.json).id
    const article = await payload.findByID({ collection: 'articles', id, draft: true, depth: 0 })
    expect(footnotesOf(article.body)).toHaveLength(1)
    const bad = await call('update_article_draft', {
      id,
      body: { en: '[unsafe][link]\n\n[link]: javascript:example' },
    })
    expect(bad.isError).toBe(true)
    expect(
      JSON.stringify(
        (await payload.findByID({ collection: 'articles', id, draft: true, depth: 0 })).body,
      ),
    ).toBe(JSON.stringify(article.body))
  })

  it('stores real footnotes in both locales and every article relationship shape', async () => {
    const input = {
      title: { en: uniq('MCP footnotes'), ar: 'مقالة تجريبية' },
      authors: [person],
      body: {
        en: 'Text[^n].\n\n[^n]: A **real** note with [a link](https://example.org).',
        ar: 'نص[^n].\n\n[^n]: ملاحظة حقيقية.',
      },
      credits: [
        { role: 'translator', people: [person], label: { en: 'Translation', ar: 'ترجمة' } },
      ],
      tags: [{ tag: 'test' }],
      translation: {
        original_language: 'en',
        original_authors: [person],
        original_source: 'Source',
        note: { en: 'Original', ar: 'الأصل' },
      },
    }
    const result = await call('create_article_draft', input)
    expect(result.isError, result.text).toBeFalsy()
    const id = track('articles', result.json).id
    for (const locale of ['en', 'ar'] as const) {
      const article = await payload.findByID({
        collection: 'articles',
        id,
        draft: true,
        locale,
        depth: 0,
        fallbackLocale: false,
      })
      const notes = footnotesOf(article.body)
      expect(notes).toHaveLength(1)
      expect(JSON.stringify(notes[0]!.note)).toContain(locale === 'en' ? 'real' : 'حقيقية')
      expect(article.credits![0]!.label).toBe(input.credits[0]!.label[locale])
      expect(article.credits![0]!.people).toEqual([person])
      expect(article.translation?.note).toBe(input.translation.note[locale])
    }
  })

  it.each(['courses', 'articles'] as const)(
    'updates %s beside a published version without changing any live locale',
    async (collection) => {
      const result = await call(
        collection === 'courses' ? 'create_course_draft' : 'create_article_draft',
        collection === 'courses'
          ? courseInput()
          : {
              title: { en: uniq('MCP live'), ar: 'حي' },
              authors: [person],
              body: { en: 'Original', ar: 'الأصل' },
            },
      )
      expect(result.isError, result.text).toBeFalsy()
      const id = track(collection, result.json).id
      await payload.update({
        collection,
        id,
        data: {
          _status: 'published',
          tier: 'public',
          ...(collection === 'courses' ? { registration: { mode: 'closed' } } : {}),
        } as never,
      })
      const read = () =>
        Promise.all(
          (['en', 'ar'] as const).map((locale) =>
            payload.findByID({
              collection,
              id,
              draft: false,
              locale,
              depth: 0,
              fallbackLocale: false,
            }),
          ),
        )
      const before = await read()
      const update = await call(
        collection === 'courses' ? 'update_course_draft' : 'update_article_draft',
        { id, title: { en: 'Changed draft', ar: 'مسودة معدلة' } },
      )
      expect(update.isError, update.text).toBeFalsy()
      expect(await read()).toEqual(before)
      expect((await payload.findByID({ collection, id, draft: true })).title).toBe('Changed draft')
    },
  )

  it('keeps omitted fields, clears explicitly and reports unmapped source facts as incomplete', async () => {
    const result = await call('create_course_draft', {
      ...courseInput(),
      summary: { en: 'Keep this', ar: 'احتفظ' },
    })
    expect(result.isError, result.text).toBeFalsy()
    const id = track('courses', result.json).id
    const update = await call('update_course_draft', {
      id,
      summary: { en: null },
      source_unmapped: [{ field: 'source_extra', reason: 'No destination' }],
    })
    expect(update.isError, update.text).toBeFalsy()
    expect(update.json.completeness).toBe('incomplete')
    expect(update.json.fields.not_saved).toEqual([
      { field: 'source_extra', reason: 'No destination' },
    ])
    expect(
      (
        await payload.findByID({
          collection: 'courses',
          id,
          draft: true,
          locale: 'en',
          fallbackLocale: false,
        })
      ).summary,
    ).toBeNull()
    expect(
      (
        await payload.findByID({
          collection: 'courses',
          id,
          draft: true,
          locale: 'ar',
          fallbackLocale: false,
        })
      ).summary,
    ).toBe('احتفظ')
  })

  it('fills cover, bibliography, questions, pricing, registration and SEO with their real nested shapes', async () => {
    const media = (await payload.find({ collection: 'media', limit: 1, depth: 0 })).docs[0]!
    expect(media).toBeDefined()
    const input = {
      ...courseInput(),
      cover_image: media.id,
      syllabus_tentative: true,
      bibliography: [
        {
          type: 'reading',
          title: { en: 'Reading', ar: 'قراءة' },
          href: 'https://example.org/reading',
          note: { en: 'Pages 1–5', ar: 'صفحات' },
        },
      ],
      facilitator_note: { en: 'Bring a pen', ar: 'أحضر قلمًا' },
      content_warning: { en: 'Sensitive text' },
      registration: { mode: 'closed', deadline: '2024-09-20' },
      applicant_questions: [
        {
          blockType: 'textarea',
          name: 'motivation',
          label: { en: 'Why?', ar: 'لماذا؟' },
          minWords: 10,
          image: media.id,
          required: true,
        },
      ],
      pricing_override: {
        options: [
          { amount: 100, default: true },
          { amount: 200, default: false },
        ],
        need_based_deductions: true,
        note: { en: 'Sliding scale', ar: 'حسب القدرة' },
      },
      meta: {
        title: { en: 'SEO title', ar: 'عنوان البحث' },
        description: { en: 'Search description' },
        image: { en: media.id },
      },
    }
    const result = await call('create_course_draft', input)
    expect(result.isError, result.text).toBeFalsy()
    const id = track('courses', result.json).id
    for (const locale of ['en', 'ar'] as const) {
      const course = await payload.findByID({
        collection: 'courses',
        id,
        draft: true,
        locale,
        depth: 0,
        fallbackLocale: false,
      })
      expect(course.cover_image).toBe(media.id)
      expect(course.syllabus_tentative).toBe(true)
      expect(course.bibliography![0]!.href).toBe('https://example.org/reading')
      expect(course.bibliography![0]!.title).toBe(input.bibliography[0]!.title[locale])
      expect(course.applicant_questions![0]).toMatchObject({
        blockType: 'textarea',
        name: 'motivation',
        label: input.applicant_questions[0]!.label[locale],
        minWords: 10,
        image: media.id,
      })
      expect(course.pricing_override?.options).toMatchObject(input.pricing_override.options)
      expect(course.pricing_override?.note).toBe(input.pricing_override.note[locale])
      expect(course.meta?.title).toBe(input.meta.title[locale])
    }
    expect(
      (
        await call('update_course_draft', {
          id,
          pricing_override: { options: [{ amount: 50, default: false }] },
        })
      ).isError,
    ).toBe(true)
    const clear = await call('update_course_draft', { id, facilitator_note: null })
    expect(clear.isError, clear.text).toBeFalsy()
    for (const locale of ['en', 'ar'] as const)
      expect(
        (
          await payload.findByID({
            collection: 'courses',
            id,
            draft: true,
            locale,
            fallbackLocale: false,
          })
        ).facilitator_note,
      ).toBeNull()
  })

  it('converts only explicit unambiguous article mention links', async () => {
    const author = await payload.findByID({ collection: 'people', id: person, depth: 0 })
    const origin = env.NEXT_PUBLIC_SERVER_URL.replace(/\/$/, '')
    const result = await call('create_article_draft', {
      title: { en: uniq('mentions') },
      authors: [person],
      body: {
        en: `[Known author](${origin}/en/people/${author.slug}) and ambiguous Name and [missing](${origin}/en/people/no-such-person-${crypto.randomUUID()}).`,
      },
    })
    expect(result.isError, result.text).toBeFalsy()
    const id = track('articles', result.json).id
    const article = await payload.findByID({ collection: 'articles', id, draft: true, depth: 0 })
    expect(JSON.stringify(article.body)).toContain('"blockType":"mention"')
    expect(JSON.stringify(article.body)).toContain('ambiguous Name')
    expect(JSON.stringify(article.body)).toContain('no-such-person-')
  })

  it('rolls back both locale writes when the second write fails', async () => {
    const count = (await payload.count({ collection: 'articles' })).totalDocs
    const update = vi
      .spyOn(payload, 'update')
      .mockRejectedValueOnce(new Error('Arabic write failed'))
    const result = await call('create_article_draft', {
      title: { en: uniq('atomic'), ar: 'ذري' },
      authors: [person],
    })
    update.mockRestore()
    expect(result.isError).toBe(true)
    expect((await payload.count({ collection: 'articles' })).totalDocs).toBe(count)
  })
})
