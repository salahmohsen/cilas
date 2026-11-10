// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { courseDocument, articleDocument, documentToMarkdown } from '@/api/llms-document'
import type { Course, Cycle, Person } from '@/payload-types'

import { RUN, createTracker, uniq } from './fixtures'

let payload: Payload
let person: Person
let course: Course
const { track, cleanup } = createTracker()

const note = (text: string) => ({
  root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text }] }] },
})

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  person = track(
    'people',
    (await payload.create({
      collection: 'people',
      data: { name: 'Test Person', slug: uniq('test-person-llms') },
      overrideAccess: true,
    })) as Person,
  )
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Llms Place', slug: uniq('llms-place'), city: `Llmsville ${RUN}` },
      overrideAccess: true,
    }),
  )
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'spring', start_year: 2031, place: place.id, start_date: '2031-03-04' },
      overrideAccess: true,
    }),
  )
  const made = track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: 'Llms Course',
        slug: uniq('llms-course'),
        course_type: 'THEMATIC',
        session_unit: 'session',
        tier: 'public',
        cycle: cycle.id,
        _status: 'published',
        schedule: {
          start_date: '2031-03-04',
          weeks: 2,
          slots: [{ weekday: 'tue', start_time: '18:00', end_time: '20:00' }],
        },
        sessions: [
          {
            order: 1,
            session_title: 'First session',
            bibliography: [
              { type: 'reading', title: 'A reading', href: 'https://example.org/reading' },
            ],
          },
          { order: 2, session_title: 'Second session' },
        ],
      },
      overrideAccess: true,
    }),
  )
  course = (await payload.findByID({
    collection: 'courses',
    id: made.id,
    depth: 2,
    overrideAccess: true,
  })) as Course
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('llms-document', () => {
  it('course doc contains schedule slot, syllabus heading, bibliography absolute url, no object dump', async () => {
    const doc = await courseDocument(payload, course, 'en')
    const md = documentToMarkdown(doc)
    expect(md).toMatch(/\d{2}:\d{2}–\d{2}:\d{2}.*Cairo/)
    expect(md).toContain('Readings')
    expect(md).toContain('http')
    expect(md).not.toContain('[object Object]')
  })

  it('prints the note belonging to the inherited cycle price', async () => {
    const priced = {
      ...course,
      pricing_override: { note: 'Unused course note' },
      cycle: {
        ...(course.cycle as Cycle),
        pricing: [
          {
            course_types: [course.course_type],
            pricing: { min: 1500, note: 'Cycle contribution note' },
          },
        ],
      },
    }
    const md = documentToMarkdown(await courseDocument(payload, priced, 'en'))
    expect(md).toContain('EGP 1,500')
    expect(md).toContain('Cycle contribution note')
    expect(md).not.toContain('Unused course note')
  })

  it('article doc contains body text, footnote endnote, mention as link', async () => {
    const article: any = {
      id: 1,
      title: 'Test Article',
      slug: uniq('test-article-llms'),
      authors: [person],
      published_date: '2026-01-01',
      body: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Body text here' },
                {
                  type: 'inlineBlock',
                  fields: { id: 'fn1', blockType: 'footnote', note: note('Footnote text') },
                },
                {
                  type: 'inlineBlock',
                  fields: {
                    id: 'm1',
                    blockType: 'mention',
                    type: 'person',
                    person: person.id,
                    label: 'Mona',
                  },
                },
              ],
            },
          ],
        },
      },
    }
    const doc = await articleDocument(payload, article, article.body, 'en')
    const md = documentToMarkdown(doc)
    expect(md).toContain('Body text here')
    expect(md).toContain('[^1]')
    expect(md).toContain('[^1]:')
    expect(md).toContain('Footnote text')
    expect(md).toContain('/people/')
  })
})
