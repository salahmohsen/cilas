import { describe, expect, it } from 'vitest'

import { pathOf } from '@/lib/paths'
import { SEO_COLLECTIONS, seoDefaults } from '@/lib/seo'
import { lexical } from '../../seed/seed.utils'

const long = 'word '.repeat(60).trim()

describe('pathOf', () => {
  it('places courses under /study', () => {
    expect(pathOf('courses', { slug: 'writing-the-self' })).toBe('/study/writing-the-self')
  })

  it('is null for collections without a page yet, or without a slug', () => {
    expect(pathOf('programmes', { slug: 'bridge' })).toBeNull()
    expect(pathOf('courses', { slug: null })).toBeNull()
  })
})

describe('seoDefaults', () => {
  it('covers the collections the spec lists', () => {
    expect(SEO_COLLECTIONS).toEqual([
      'courses',
      'cycles',
      'programmes',
      'publications',
      'articles',
      'events',
    ])
  })

  it('takes a course title, summary and cover', () => {
    expect(
      seoDefaults('courses', {
        title: 'Writing the Self',
        summary: 'Diaries, letters, confessions.',
        subtitle: 'Ignored',
        cover_image: 12,
      }),
    ).toEqual({
      title: 'Writing the Self · CILAS',
      description: 'Diaries, letters, confessions.',
      image: 12,
    })
  })

  it("falls back to a course's subtitle, and reads a populated cover", () => {
    expect(
      seoDefaults('courses', { title: 'X', subtitle: 'Sub', cover_image: { id: 4 } }),
    ).toMatchObject({ description: 'Sub', image: 4 })
  })

  it("uses the opening of an article's body", () => {
    expect(
      seoDefaults('articles', { title: 'On Ignorance', body: lexical('First line of the essay.') }),
    ).toMatchObject({ description: 'First line of the essay.' })
  })

  it('cuts a long description at a word, with an ellipsis', () => {
    const { description } = seoDefaults('publications', { title: 'P', subtitle: long })
    expect(description!.length).toBeLessThanOrEqual(160)
    expect(description).toMatch(/word…$/)
  })

  it('leaves out what a document lacks', () => {
    expect(seoDefaults('cycles', { title: 'Spring 2026, Cairo' })).toEqual({
      title: 'Spring 2026, Cairo · CILAS',
    })
  })
})
