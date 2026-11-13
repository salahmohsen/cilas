import { describe, expect, it } from 'vitest'

import { searchParametersOf } from '@/lib/search-config'
import { fieldsOf, physicalNameOf } from '@/plugins/typesense/schema'
import {
  contributorsOf,
  lexicalText,
  syllabusText,
  toSearchDocument,
} from '@/plugins/typesense/documents'

const paragraph = (...children: object[]) => ({ type: 'paragraph', children })
const text = (value: string) => ({ type: 'text', text: value })
const richText = (...children: object[]) => ({ root: { type: 'root', children } })

const person = (id: number, name: string | null, photo?: string) => ({
  id,
  name,
  photo: photo ? { url: photo } : null,
})

describe('lexicalText', () => {
  it('keeps inline runs together and ends each block on its own line', () => {
    const body = richText(paragraph(text('un'), text('believ'), text('able')), {
      type: 'heading',
      children: [text('Next')],
    })
    expect(lexicalText(body)).toBe('unbelievable\nNext')
  })

  it('reads line breaks and skips empty blocks', () => {
    const body = richText(paragraph(text('one'), { type: 'linebreak' }, text('two')), paragraph())
    expect(lexicalText(body)).toBe('one\ntwo')
  })
})

describe('syllabusText', () => {
  it('reads sessions in time order, then activities and bibliographies, each line once', () => {
    const course = {
      syllabus: {
        docs: [
          { title: 'Reading Aristotle', meetings: [{ date: '2026-03-10' }] },
          {
            title: 'Reading Plato',
            description: 'Book one',
            meetings: [{ date: '2026-03-03' }],
            activities: [{ description: 'Walk' }],
            bibliography: [{ title: 'Republic', note: 'Chapter 1' }],
          },
        ],
      },
      bibliography: [{ title: 'Republic' }, { title: 'Laws' }],
    }
    expect(syllabusText(course)).toBe(
      'Reading Plato\nBook one\nWalk\nRepublic\nChapter 1\nReading Aristotle\nLaws',
    )
  })

  it('reads nothing of a course with no session', () => {
    expect(syllabusText({ syllabus: { docs: [] } })).toBe('')
    expect(syllabusText({})).toBe('')
  })
})

describe('contributorsOf', () => {
  it('matches each person across languages by id', () => {
    const en = {
      authors: [person(1, 'Iman Mersal', 'https://cdn/iman.webp')],
      credits: [{ people: [person(2, 'Ali')] }],
    }
    const ar = { authors: [person(1, 'إيمان مرسال')], credits: [{ people: [person(2, null)] }] }
    expect(contributorsOf('articles', { en, ar })).toEqual([
      { name: { en: 'Iman Mersal', ar: 'إيمان مرسال' }, photo: 'https://cdn/iman.webp' },
      { name: { en: 'Ali' } },
    ])
  })

  it('ignores relations that stayed ids', () => {
    expect(contributorsOf('courses', { en: { fellows: [3, 4] }, ar: {} })).toEqual([])
  })
})

describe('toSearchDocument', () => {
  it('carries focal coordinates into search results without discarding zero', () => {
    const document = toSearchDocument('courses', {
      en: { id: 1, title: 'A course', cover_image: { url: '/cover.webp', focalX: 0, focalY: 80 } },
      ar: {},
    })
    expect(document).toMatchObject({ coverImage: '/cover.webp', focalX: 0, focalY: 80 })
  })
  const course = {
    id: 7,
    slug: 'reading-plato',
    updatedAt: '2026-01-02T00:00:00.000Z',
    course_type: 'CORE',
    cover_image: { url: 'https://cdn/cover.webp' },
    title: 'Reading Plato',
    fellows: [person(1, 'Iman Mersal')],
    syllabus: { docs: [{ title: 'Shared title' }] },
  }

  it('folds both language copies into one record', () => {
    const document = toSearchDocument('courses', {
      en: course,
      ar: { ...course, title: 'قراءة أفلاطون', fellows: [person(1, 'إيمان مرسال')] },
    })
    expect(document).toMatchObject({
      id: '7',
      slug: 'reading-plato',
      updatedAt: Date.parse('2026-01-02T00:00:00.000Z'),
      courseType: 'CORE',
      coverImage: 'https://cdn/cover.webp',
      title_en: 'Reading Plato',
      title_ar: 'قراءة أفلاطون',
      owner_en: 'Iman Mersal',
      owner_ar: 'إيمان مرسال',
      sortTitle_en: 'reading plato',
      sortTitle_ar: 'قراءة أفلاطون',
      // Unlocalized text lives in the English field only.
      syllabus_en: 'Shared title',
      syllabus_ar: '',
    })
  })

  it('falls back to the other title for sorting', () => {
    const document = toSearchDocument('courses', { en: course, ar: { ...course, title: null } })
    expect(document?.title_ar).toBe('')
    expect(document?.sortTitle_ar).toBe('reading plato')
  })

  it('keeps an Arabic-only document', () => {
    const document = toSearchDocument('people', {
      en: { id: 2, name: null },
      ar: { id: 2, name: 'علي' },
    })
    expect(document).toMatchObject({ name_en: '', name_ar: 'علي', sortTitle_en: 'علي' })
  })

  it('drops a document with no title in either language', () => {
    expect(toSearchDocument('articles', { en: { id: 3, title: '' }, ar: {} })).toBeNull()
  })

  it('fills every schema field', () => {
    const document = toSearchDocument('courses', { en: course, ar: {} })!
    for (const field of fieldsOf('courses')) expect(document).toHaveProperty(field.name)
  })
})

describe('search schema', () => {
  it('queries both languages of every field, weights aligned', () => {
    const { query_by, query_by_weights } = searchParametersOf('articles')
    expect(query_by).toBe('title_en,title_ar,owner_en,owner_ar,body_en,body_ar')
    expect(query_by_weights).toBe('10,10,5,5,3,3')
  })

  it('names the physical collection after its schema', () => {
    expect(physicalNameOf('people')).toMatch(/^people_[0-9a-f]{8}$/)
    expect(physicalNameOf('people')).not.toBe(physicalNameOf('articles'))
  })
})

describe('mentions in rich text', () => {
  it('keep their words in the searchable text', async () => {
    const { lexicalText } = await import('@/plugins/typesense/documents')
    const body = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'A course by ' },
              {
                type: 'inlineBlock',
                fields: {
                  blockType: 'mention',
                  label: 'Ghosoun Ismail',
                  type: 'person',
                  person: 3,
                },
              },
              { type: 'text', text: ', with a note.' },
              { type: 'inlineBlock', fields: { blockType: 'footnote', note: {} } },
            ],
          },
        ],
      },
    }
    expect(lexicalText(body)).toBe('A course by Ghosoun Ismail, with a note.')
  })
})
