import { describe, expect, it } from 'vitest'
import { programmeEditorial, type EditorDocument } from '@/migrations/lib/programme-editorial'

const overview: EditorDocument = {
  root: {
    type: 'root',
    version: 1,
    format: '',
    indent: 0,
    direction: null,
    children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Original overview' }] }],
  },
}

describe('programme editorial migration', () => {
  it('moves highlights and every testimonial into ordered editor blocks without changing the source', () => {
    const source = {
      overview: { en: overview },
      highlights: [{ text: { en: 'First highlight' } }],
      testimonials: [
        { quote: { en: 'First quote' }, attribution: { en: 'CILASian' }, person: 2 },
        { quote: { en: 'Second quote' } },
      ],
    }
    const before = structuredClone(source)
    const result = programmeEditorial(source, { 2: { en: 'The author' } })
    expect(result.en?.root.children.map((n) => n.type)).toEqual([
      'list',
      'paragraph',
      'quote',
      'quote',
    ])
    expect(result.en?.root.children[1]).toEqual(overview.root.children[0])
    const json = JSON.stringify(result)
    for (const text of ['First highlight', 'First quote', 'Second quote', 'CILASian'])
      expect(json).toContain(text)
    expect(json).toContain('"blockType":"mention"')
    expect(json).toContain('"person":2')
    expect(source).toEqual(before)
  })

  it('keeps a missing Arabic translation missing so English fallback still works', () => {
    const result = programmeEditorial({
      overview: { en: overview, ar: null },
      highlights: [{ text: { en: 'English only', ar: null } }],
    })
    expect(result.ar).toBeNull()
    expect(JSON.stringify(result.en)).toContain('English only')
  })

  it('preserves existing per-field fallback when Arabic has its own overview', () => {
    const result = programmeEditorial(
      {
        overview: { en: overview, ar: overview },
        highlights: [{ text: { en: 'Shared fallback', ar: null } }],
        testimonials: [{ quote: { en: 'English quote', ar: 'النص العربي' }, person: 2 }],
      },
      { 2: { en: 'Author', ar: 'الكاتب' } },
    )
    expect(JSON.stringify(result.ar)).toContain('Shared fallback')
    expect(JSON.stringify(result.ar)).toContain('النص العربي')
    expect(JSON.stringify(result.ar)).toContain('الكاتب')
  })

  it('leaves arbitrary existing editor nodes intact when there is nothing to move', () => {
    expect(programmeEditorial({ overview: { en: overview, ar: null } })).toEqual({
      en: overview,
      ar: null,
    })
  })

  it('does not infer a public attribution from a person absent from the visible-person map', () => {
    const result = programmeEditorial({
      testimonials: [{ quote: { en: 'Anonymous quote' }, person: 2 }],
    })
    expect(JSON.stringify(result)).toContain('Anonymous quote')
    expect(JSON.stringify(result)).not.toContain('—')
    expect(JSON.stringify(result)).toContain('"person":2')
  })
})
