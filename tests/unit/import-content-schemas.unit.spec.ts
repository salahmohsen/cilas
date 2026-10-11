import { describe, expect, it } from 'vitest'

import {
  BlogPage,
  blogPrompt,
  CONTENT_PROMPT_VERSION,
  Essay,
  essayPrompt,
  NewsletterSources,
  newsletterPrompt,
  NewsPage,
  newsPrompt,
  PressPage,
  pressPrompt,
  PublicationPage,
  publicationPrompt,
  Toc,
  tocPrompt,
} from '../../migration/lib/content-schemas'

const block = { type: 'paragraph', level: null, text: 'Text.' }

describe('content schemas', () => {
  it('has a prompt version', () => expect(CONTENT_PROMPT_VERSION).toBe('1'))

  it('Toc accepts a contents page and rejects a zero page', () => {
    const ok = {
      front_matter_pages: [2],
      essays: [
        { order: 1, title: 'A', authors: ['X'], first_page: 5, last_page: 9, is_foreword: true },
      ],
      imprint: { credits: [{ role: 'editor', names: ['Y'] }], license: 'CC BY-NC-SA', year: 2021 },
    }
    expect(Toc.parse(ok)).toEqual(ok)
    expect(() => Toc.parse({ ...ok, essays: [{ ...ok.essays[0], first_page: 0 }] })).toThrow()
  })

  it('Essay accepts blocks and rejects an unknown block type or none', () => {
    const ok = {
      title: 'T',
      subtitle: null,
      authors: [],
      translators: [],
      original: null,
      blocks: [block],
    }
    expect(Essay.parse(ok)).toEqual(ok)
    expect(() => Essay.parse({ ...ok, blocks: [{ ...block, type: 'image' }] })).toThrow()
    expect(() => Essay.parse({ ...ok, blocks: [] })).toThrow()
  })

  it('PressPage rejects a bad kind', () => {
    const item = {
      title: 'T',
      outlet: null,
      authors: [],
      kind: 'coverage',
      date: '2020-05',
      links: [{ language: 'en', url: 'u' }],
      excerpt: null,
      logo: null,
    }
    expect(PressPage.parse({ items: [item] }).items).toHaveLength(1)
    expect(() => PressPage.parse({ items: [{ ...item, kind: 'review' }] })).toThrow()
  })

  it('NewsPage rejects a bad time', () => {
    const post = {
      title: 'T',
      date: '2013-05-01',
      is_gathering: true,
      event_type: 'open_day',
      start_time: '18:00',
      end_time: null,
      speakers: [],
      blocks: [block],
    }
    expect(NewsPage.parse({ posts: [post] }).posts).toHaveLength(1)
    expect(() => NewsPage.parse({ posts: [{ ...post, start_time: '6pm' }] })).toThrow()
  })

  it('BlogPage rejects a post without blocks', () => {
    const post = { title: 'T', date: null, authors: [], blocks: [block] }
    expect(BlogPage.parse({ posts: [post] }).posts).toHaveLength(1)
    expect(() => BlogPage.parse({ posts: [{ ...post, blocks: [] }] })).toThrow()
  })

  it('PublicationPage rejects a missing funders list', () => {
    const ok = {
      title: 'T',
      subtitle: null,
      intro: [block],
      credits: [],
      funders: ['ACSS'],
      license: null,
    }
    expect(PublicationPage.parse(ok)).toEqual(ok)
    expect(() => PublicationPage.parse({ ...ok, funders: undefined })).toThrow()
  })

  it('NewsletterSources rejects a bad date', () => {
    const issue = { title: 'Issue 1', date: '2016-03', archive_url: null, blocks: [] }
    expect(NewsletterSources.parse({ issues: [issue] }).issues).toHaveLength(1)
    expect(() => NewsletterSources.parse({ issues: [{ ...issue, date: 'March 2016' }] })).toThrow()
  })
})

describe('content prompts', () => {
  it('each holds its source id and its text', () => {
    const base = { id: 'src-1', text: 'SOURCE TEXT HERE' }
    const prompts = [
      tocPrompt({ ...base, pageCount: 65, pages: [1, 2], images: [] }),
      essayPrompt({
        ...base,
        doc: 'd',
        title: 'T',
        authors: ['A'],
        firstPage: 3,
        lastPage: 9,
        images: [],
      }),
      pressPrompt(base),
      newsPrompt(base),
      blogPrompt(base),
      publicationPrompt(base),
      newsletterPrompt(base),
    ]
    for (const p of prompts) {
      expect(p).toContain('src-1')
      expect(p).toContain('SOURCE TEXT HERE')
      expect(p).toContain('Verbatim')
    }
  })

  it('lists page images for documents read from images, and the archive links', () => {
    expect(
      tocPrompt({ id: 'd', text: 't', pageCount: 3, pages: [1], images: ['/x/page-1.png'] }),
    ).toContain('/x/page-1.png')
    expect(
      newsletterPrompt({
        id: 'n',
        text: 't',
        mailchimp: [{ url: 'https://us1.campaign-archive.com/?u=1' }],
      }),
    ).toContain('https://us1.campaign-archive.com/?u=1')
  })
})
