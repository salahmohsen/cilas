// @vitest-environment node
import { getPayload, type CollectionSlug, type Payload, type Where } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Article } from '@/payload-types'
import { blocksToLexical } from '../../migration/lib/blocks'
import { importContent, type ArchiveContent } from '../../migration/lib/import-content'
import { RUN, uniq } from './fixtures'

let payload: Payload

const P = `/probecontent-${RUN}-`
const L = {
  pair: `${P}book.html#pair`,
  booklet: `${P}booklet.html#only-arabic`,
  seeded: `${P}book.html#seeded`,
  reviewed: `${P}book.html#reviewed`,
  event: `${P}news.html#talk`,
  newsletter: `${P}docs.html#issue`,
  press: `${P}press.html#item`,
  publication: `${P}book.html`,
}
const PRESS_URL = `https://example.org/probecontent-${RUN}-press`
const SEEDED_TITLE = `Probe Content Seeded Title ${RUN}`

const content = (reviewedBody = 'Imported over a reviewed article'): ArchiveContent => ({
  articles: [
    {
      legacy_url: L.pair,
      kind: 'essay',
      title_en: `Probe Content Pair ${RUN}`,
      title_ar: 'زوج الاختبار',
      match_titles_en: [],
      blocks_en: [
        { type: 'heading', level: 2, text: 'English heading' },
        {
          type: 'paragraph',
          level: null,
          text: 'English first paragraph with a [link](https://example.org/x).',
        },
        { type: 'quote', level: null, text: 'An English quote' },
      ],
      blocks_ar: [
        { type: 'heading', level: 2, text: 'عنوان عربي' },
        { type: 'paragraph', level: null, text: 'الفقرة العربية الأولى' },
        { type: 'quote', level: null, text: 'اقتباس عربي' },
      ],
      authors: [`Probe Content Author ${RUN}`],
      credits: [
        {
          role: 'translator',
          label: { en: 'Translation', ar: 'ترجمة' },
          people: [`Probe Content Translator ${RUN}`],
        },
      ],
      translation: null,
      publication: L.publication,
      published_date: null,
    },
    {
      legacy_url: L.booklet,
      kind: 'essay',
      title_en: `Probe Content Booklet ${RUN}`,
      title_ar: 'كتيب الاختبار',
      match_titles_en: [],
      blocks_en: null,
      blocks_ar: [{ type: 'paragraph', level: null, text: 'نص عربي فقط' }],
      authors: [`Probe Content Author ${RUN}`],
      credits: [],
      translation: {
        original_language: 'en',
        original_title: 'Original',
        original_authors: [`Probe Content Original ${RUN}`],
        original_source: 'A journal, 2016',
      },
      publication: null,
      published_date: null,
    },
    {
      legacy_url: L.seeded,
      kind: 'essay',
      title_en: `Probe Content Seeded Replacement ${RUN}`,
      title_ar: null,
      match_titles_en: [SEEDED_TITLE],
      blocks_en: [{ type: 'paragraph', level: null, text: 'The full text replaces the digest.' }],
      blocks_ar: null,
      authors: [`Probe Content Author ${RUN}`],
      credits: [],
      translation: null,
      publication: null,
      published_date: null,
    },
    {
      legacy_url: L.reviewed,
      kind: 'blog',
      title_en: `Probe Content Reviewed ${RUN}`,
      title_ar: null,
      match_titles_en: [],
      blocks_en: [{ type: 'paragraph', level: null, text: reviewedBody }],
      blocks_ar: null,
      authors: [`Probe Content Author ${RUN}`],
      credits: [],
      translation: null,
      publication: null,
      published_date: '2015-02-24',
    },
  ],
  publications: [
    {
      legacy_url: L.publication,
      kind: 'essay_collection',
      title_en: `Probe Content Collection ${RUN}`,
      title_ar: 'مجموعة الاختبار',
      subtitle_en: null,
      subtitle_ar: null,
      match_titles_en: [],
      year_from: 2018,
      year_to: 2018,
      intro_en: [{ type: 'paragraph', level: null, text: 'Intro.' }],
      intro_ar: null,
      foreword: L.pair,
      articles: [L.pair, L.seeded],
      credits: [{ role: 'editor', people: [`Probe Content Author ${RUN}`] }],
      funders: [`Probe Content Funder ${RUN}`],
      license: 'cc_by_nc_sa',
      produced_by: [],
      print_edition_url: `https://example.org/probecontent-${RUN}.pdf`,
    },
  ],
  press: [
    {
      legacy_url: L.press,
      kind: 'coverage',
      title: `Probe Content Press ${RUN}`,
      language: 'en',
      outlet: `Probe Content Outlet ${RUN}`,
      authors: [`Probe Content Author ${RUN}`, 'A Free Name'],
      published_date: '2019-09-18',
      date_precision: 'day',
      links: [{ language: 'en', url: PRESS_URL }],
      excerpt: null,
    },
  ],
  events: [
    {
      legacy_url: L.event,
      title_en: `Probe Content Talk ${RUN}`,
      event_type: 'talk',
      tier: 'public',
      schedule: { start_date: '2014-01-06', start_precision: 'day', weeks: 1, slots: [] },
      speakers: [`Probe Content Author ${RUN}`],
      description_en: [{ type: 'paragraph', level: null, text: 'A talk.' }],
    },
  ],
  newsletters: [
    {
      legacy_url: L.newsletter,
      title_en: `Probe Content Issue ${RUN}`,
      issue_date: '2013-06-01',
      blocks_en: [{ type: 'paragraph', level: null, text: 'Dear friends.' }],
    },
  ],
})

const cleanup = async () => {
  const like = { legacy_url: { like: P } }
  const targets: Array<[CollectionSlug, Where]> = [
    ['publications', like],
    ['articles', { or: [like, { title: { equals: SEEDED_TITLE } }] }],
    ['press', like],
    ['events', like],
    ['newsletters', like],
    ['people', { name: { like: RUN } }],
  ]
  for (const [collection, where] of targets) {
    await payload.delete({ collection, where, overrideAccess: true }).catch(() => undefined)
  }
}

const article = async (legacy: string, locale: 'en' | 'ar' = 'en'): Promise<Article> =>
  (
    await payload.find({
      collection: 'articles',
      where: { legacy_url: { equals: legacy } },
      draft: true,
      depth: 0,
      locale,
      fallbackLocale: false,
      overrideAccess: true,
    })
  ).docs[0]
const plain = (doc: unknown) => JSON.stringify(doc ?? null)
const nodeTypes = (a: Article): string[] =>
  ((a.body?.root.children ?? []) as Array<{ type: string }>).map((c) => c.type)

describe('publishing content import', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const author = await payload.create({
      collection: 'people',
      data: { name: `Probe Content Author ${RUN}`, slug: uniq('probe-content-author') },
      overrideAccess: true,
    })
    // An article the old dev seed would have made: a digest, a community tier,
    // no legacy URL.
    await payload.create({
      collection: 'articles',
      data: {
        title: SEEDED_TITLE,
        slug: uniq('probe-content-seeded-title'),
        authors: [author.id],
        tier: 'community',
        requested_tier: 'community',
        review: { status: 'approved' },
        _status: 'published',
      },
      overrideAccess: true,
    })
    // A booklet article that already carries an English stand-in body.
    await payload.create({
      collection: 'articles',
      data: {
        title: `Probe Content Booklet ${RUN}`,
        slug: uniq('probe-content-booklet'),
        authors: [author.id],
        legacy_url: L.booklet,
        body: blocksToLexical(
          [{ type: 'paragraph', level: null, text: 'An English digest.' }],
          'ltr',
        ),
      },
      overrideAccess: true,
    } as Parameters<Payload['create']>[0])
  }, 120_000)
  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  }, 120_000)

  it('writes an English and Arabic pair, each locale with its own body', async () => {
    await importContent(payload, content())

    const en = await article(L.pair, 'en')
    expect(en.title).toBe(`Probe Content Pair ${RUN}`)
    expect(nodeTypes(en)).toEqual(['heading', 'paragraph', 'quote'])
    expect(plain(en.body)).toContain('English first paragraph')
    expect(plain(en.body)).toContain('"direction":"ltr"')
    // Archive works are published, approved and public.
    expect(en.review?.status).toBe('approved')
    expect(en._status).toBe('published')
    expect(en.tier).toBe('public')
    expect(en.credits?.[0]).toMatchObject({ role: 'translator', label: 'Translation' })

    const ar = await article(L.pair, 'ar')
    expect(ar.title).toBe('زوج الاختبار')
    expect(nodeTypes(ar)).toEqual(['heading', 'paragraph', 'quote'])
    expect(plain(ar.body)).toContain('الفقرة العربية الأولى')
    expect(plain(ar.body)).toContain('"direction":"rtl"')
    expect(ar.credits?.[0]).toMatchObject({ label: 'ترجمة' })
    expect(ar.credits?.[0].id).toBe(en.credits?.[0].id)
  })

  it('writes a booklet article in Arabic only, clearing an English stand-in, with its translation group', async () => {
    const en = await article(L.booklet, 'en')
    expect(en.title).toBe(`Probe Content Booklet ${RUN}`)
    // No English text: no English body, so the site shows the Arabic one.
    expect(en.body ?? null).toBeNull()
    const ar = await article(L.booklet, 'ar')
    expect(plain(ar.body)).toContain('نص عربي فقط')
    expect(en.translation).toMatchObject({
      original_language: 'en',
      original_title: 'Original',
      original_source: 'A journal, 2016',
    })
  })

  it('replaces the body of a seeded article matched by title and publishes it', async () => {
    const seeded = await article(L.seeded)
    expect(seeded.title).toBe(`Probe Content Seeded Replacement ${RUN}`)
    expect(plain(seeded.body)).toContain('The full text replaces the digest.')
    expect(seeded.tier).toBe('public')
    expect(seeded.review?.status).toBe('approved')
    expect(seeded._status).toBe('published')
    expect(seeded.slug).toBe(uniq('probe-content-seeded-title'))
  })

  it('writes the publication, press, event and newsletter', async () => {
    const pub = (
      await payload.find({
        collection: 'publications',
        where: { legacy_url: { equals: L.publication } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]
    const pair = await article(L.pair)
    // The foreword leads the collection's list (it opens with a Card stack block).
    expect(pub.articles?.[0]).toBe(pair.id)
    expect(pub.articles).toHaveLength(2)
    expect(pub.license).toBe('cc_by_nc_sa')

    const press = (
      await payload.find({
        collection: 'press',
        where: { 'links.url': { equals: PRESS_URL } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs
    expect(press).toHaveLength(1)
    expect(press[0].authors?.map((a) => Boolean(a.person) || a.name)).toEqual([true, 'A Free Name'])

    const event = (
      await payload.find({
        collection: 'events',
        where: { legacy_url: { equals: L.event } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]
    expect(event.tier).toBe('public')
    expect(event._status).toBe('published')
    expect(event.schedule?.start_date).toContain('2014-01-06')
    expect(event.speakers).toHaveLength(1)

    const issue = (
      await payload.find({
        collection: 'newsletters',
        where: { legacy_url: { equals: L.newsletter } },
        draft: true,
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]
    expect(issue._status).toBe('draft')
    expect(plain(issue.body)).toContain('Dear friends.')
  })

  it('creates nothing new on a second run', async () => {
    const result = await importContent(payload, content())
    for (const t of Object.values(result)) expect(t.created).toBe(0)
    const press = await payload.count({
      collection: 'press',
      where: { 'links.url': { equals: PRESS_URL } },
      overrideAccess: true,
    })
    expect(press.totalDocs).toBe(1)
    const pair = await payload.count({
      collection: 'articles',
      where: { legacy_url: { equals: L.pair } },
      overrideAccess: true,
    })
    expect(pair.totalDocs).toBe(1)
  })
})
