import { describe, expect, it } from 'vitest'

import { dataForLocale, type SplitField } from './locale-split'

const fields: SplitField[] = [
  { name: 'title', type: 'text', localized: true },
  { name: 'tier', type: 'select' },
  { name: 'authors', type: 'relationship' },
  {
    name: 'credits',
    type: 'array',
    flattenedFields: [
      { name: 'role', type: 'select' },
      { name: 'label', type: 'text', localized: true },
      { name: 'id', type: 'text' },
    ],
  },
  {
    name: 'meta',
    type: 'group',
    flattenedFields: [
      { name: 'title', type: 'text', localized: true },
      { name: 'image', type: 'upload', localized: true },
    ],
  },
  {
    name: 'questions',
    type: 'blocks',
    blocks: [
      {
        slug: 'text',
        flattenedFields: [
          { name: 'name', type: 'text' },
          { name: 'label', type: 'text', localized: true },
        ],
      },
    ],
  },
  { name: 'refQuestions', type: 'blocks', blockReferences: ['text'] },
]

const blocks = {
  text: { slug: 'text', flattenedFields: fields[5].blocks![0].flattenedFields },
}

const locales = ['en', 'ar']

const source = {
  title: { en: 'Hello', ar: 'مرحبا' },
  tier: 'owner',
  authors: [3, 4],
  credits: [{ id: 'c1', role: 'editor', label: { en: 'Editor', ar: 'محرر' } }],
  meta: { title: { en: 'Meta' }, image: null },
  questions: [
    {
      id: 'q1',
      blockType: 'text',
      blockName: null,
      name: 'why',
      label: { en: 'Why?', ar: 'لماذا؟' },
    },
  ],
  refQuestions: [{ id: 'q2', blockType: 'text', name: 'how', label: { en: 'How?' } }],
}

describe('dataForLocale', () => {
  it('takes one locale of every localized field and keeps the rest', () => {
    expect(dataForLocale(fields, source, 'ar', locales, blocks)).toEqual({
      title: 'مرحبا',
      tier: 'owner',
      authors: [3, 4],
      credits: [{ id: 'c1', role: 'editor', label: 'محرر' }],
      meta: { title: null, image: null },
      questions: [{ id: 'q1', blockType: 'text', blockName: null, name: 'why', label: 'لماذا؟' }],
      refQuestions: [{ id: 'q2', blockType: 'text', name: 'how', label: null }],
    })
  })

  it('writes null for a locale the source has no value in', () => {
    expect(dataForLocale(fields, { title: { en: 'Only' } }, 'ar', locales, blocks)).toEqual({
      title: null,
    })
  })

  it('skips a field the source does not hold', () => {
    expect(dataForLocale(fields, { tier: 'owner' }, 'en', locales, blocks)).toEqual({
      tier: 'owner',
    })
  })

  it('leaves a localized field alone when its value is not a map of locales', () => {
    const plain = {
      title: 'Hello',
      body: { root: { type: 'root', children: [] } },
      credits: [{ id: 'c1', role: 'editor', label: 'Editor' }],
    }
    expect(
      dataForLocale(
        [...fields, { name: 'body', type: 'richText', localized: true }],
        plain,
        'ar',
        locales,
        blocks,
      ),
    ).toEqual({ credits: [{ id: 'c1', role: 'editor' }] })
  })

  it('still clears a localized field the source holds as null or an empty map', () => {
    expect(
      dataForLocale(fields, { title: {}, meta: { title: null } }, 'ar', locales, blocks),
    ).toEqual({
      title: null,
      meta: { title: null },
    })
  })
})
