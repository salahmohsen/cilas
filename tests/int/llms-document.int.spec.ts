// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { courseDocument, articleDocument, documentToMarkdown } from '@/lib/llms-document'
import type { Article, Course, Person } from '@/payload-types'

let payload: Payload
let person: Person
let course: Course

const note = (text: string) => ({
  root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text }] }] },
})

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  person = (await payload.create({
    collection: 'people',
    data: { name: 'Test Person', slug: 'test-person-llms-' + Date.now() },
    overrideAccess: true,
  })) as Person
  const found = await payload.find({
    collection: 'courses',
    where: { tier: { equals: 'public' }, _status: { equals: 'published' } },
    limit: 20,
    depth: 2,
    overrideAccess: true,
  })
  course = (found.docs.find((d: any) => d.sessions?.length) ?? found.docs[0]) as Course
})

afterAll(async () => {
  await payload
    .delete({ collection: 'people', id: person.id, overrideAccess: true })
    .catch(() => {})
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

  it('article doc contains body text, footnote endnote, mention as link', async () => {
    const article: any = {
      id: 1,
      title: 'Test Article',
      slug: 'test-article-llms',
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
