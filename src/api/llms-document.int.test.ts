import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import {
  courseDocument,
  articleDocument,
  documentToMarkdown,
  richTextToMarkdown,
} from '@/api/llms-document'
import { getCourseSessions } from '@/api/sessions.api'
import { llmsOptions } from '@/plugins/llms'
import { createLlmsFullTxtRouteHandler } from 'payload-plugin-llms-txt/next'
import type { Article, Course, Cycle, Person, Session } from '@/payload-types'

import { RUN, createTracker, uniq } from '../../testing/payload.fixture'

let payload: Payload
let person: Person
let course: Course
let sessions: Session[]
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
        tier: 'public',
        cycle: cycle.id,
        registration: { mode: 'closed' },
        _status: 'published',
      },
      overrideAccess: true,
    }),
  )
  for (const [title, date, bibliography] of [
    [
      'First session',
      '2031-03-04',
      [{ type: 'reading', title: 'A reading', href: 'https://example.org/reading' }],
    ],
    ['Second session', '2031-03-11', []],
  ] as const)
    track(
      'sessions',
      await payload.create({
        collection: 'sessions',
        data: {
          course: made.id,
          title,
          meetings: [{ date, start_time: '18:00', end_time: '20:00' }],
          bibliography: [...bibliography],
        },
        overrideAccess: true,
      }),
    )
  sessions =
    (await getCourseSessions(payload, [made.id], { locale: 'en', reader: null })).get(made.id) ?? []
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
  it("course doc contains its sessions' dates and weekly time, syllabus headings, bibliography absolute url, no object dump", async () => {
    const doc = await courseDocument(payload, course, sessions, 'en')
    const md = documentToMarkdown(doc)
    expect(md).toContain('**Starts:** 2031-03-04')
    expect(md).toContain('**Ends:** 2031-03-11')
    expect(md).toContain('**Meets:** Tuesday 18:00–20:00 (Cairo)')
    expect(md).toContain('### First session')
    expect(md).toContain('### Second session')
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
            pricing: {
              options: [{ amount: 1500, default: true }],
              note: 'Cycle contribution note',
            },
          },
        ],
      },
    }
    const md = documentToMarkdown(await courseDocument(payload, priced, sessions, 'en'))
    expect(md).toContain('1,500 EGP')
    expect(md).toContain('Cycle contribution note')
    expect(md).not.toContain('Unused course note')
  })

  it('article doc contains body text, footnote endnote, mention as link', async () => {
    const article = {
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
    } as unknown as Article
    const doc = await articleDocument(payload, article, article.body, 'en')
    const md = documentToMarkdown(doc)
    expect(md).toContain('Body text here')
    expect(md).toContain('[^1]')
    expect(md).toContain('[^1]:')
    expect(md).toContain('Footnote text')
    expect(md).toContain('/people/')
  })
  it("converts a body that holds a block and an inline block, which the plugin's default editor cannot read", async () => {
    const body = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Block body text' },
              {
                type: 'inlineBlock',
                fields: { id: 'fn2', blockType: 'footnote', note: note('Block footnote words') },
              },
            ],
          },
          { type: 'block', fields: { id: 'b1', blockType: 'cardStack', label: 'Reading list' } },
        ],
      },
    }
    const md = await richTextToMarkdown(payload, { body }, body, 'en', 'article')
    expect(md).toContain('Block body text')
    expect(md).toContain('[^1]: Block footnote words')
    expect(md).toContain('[Card: Reading list]')
  })

  it('llms-full.txt carries the text of an article whose body holds blocks', async () => {
    const title = `Llms Full ${RUN}`
    track(
      'articles',
      await payload.create({
        collection: 'articles',
        data: {
          title,
          slug: uniq('llms-full-article'),
          authors: [person.id],
          tier: 'public',
          _status: 'published',
          body: {
            root: {
              type: 'root',
              direction: null,
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  type: 'paragraph',
                  version: 1,
                  children: [
                    { type: 'text', version: 1, text: 'Full text with a footnote' },
                    {
                      type: 'inlineBlock',
                      version: 1,
                      fields: {
                        id: 'fn3',
                        blockType: 'footnote',
                        note: note('Distinct endnote words'),
                      },
                    },
                  ],
                },
              ],
            },
          },
        } as never,
        overrideAccess: true,
      }),
    )
    const response = await createLlmsFullTxtRouteHandler(config, llmsOptions)()
    const text = await response.text()
    expect(text).toContain(`## ${title}`)
    expect(text).toContain('Full text with a footnote')
    expect(text).toContain('[^1]: Distinct endnote words')
  })
})
