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
    expect(dataForLocale(fields, source, 'ar', blocks)).toEqual({
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
    expect(dataForLocale(fields, { title: { en: 'Only' } }, 'ar', blocks)).toEqual({ title: null })
  })

  it('skips a field the source does not hold', () => {
    expect(dataForLocale(fields, { tier: 'owner' }, 'en', blocks)).toEqual({ tier: 'owner' })
  })
})
