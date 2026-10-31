import { describe, expect, it } from 'vitest'

import {
  firstImage,
  mediaJobs,
  pdfJobs,
  rewriteLinks,
  stripQuery,
  uniquePaths,
  uploadsPath,
} from '../../migration/lib/media-plan'

const U = 'uploads/1/9/1/0/19102967/'

describe('stripQuery', () => {
  it('drops the cache-busting query', () => {
    expect(stripQuery('uploads/1/2/a.jpg?263')).toBe('uploads/1/2/a.jpg')
    expect(stripQuery('uploads/1/2/a.jpg')).toBe('uploads/1/2/a.jpg')
  })
})

describe('uploadsPath', () => {
  it('finds the upload path in any link form, decoded', () => {
    expect(uploadsPath(`https://www.ci-las.org/${U}a%20b.pdf`)).toBe(`${U}a b.pdf`)
    expect(uploadsPath(`/${U}a.png?3`)).toBe(`${U}a.png`)
    expect(uploadsPath('https://example.org/x.pdf')).toBeNull()
  })
})

describe('firstImage', () => {
  it('returns the first uploaded image, without its query', () => {
    expect(firstImage('text\n![image](uploads/1/a_orig.jpg?1)\n![image](uploads/1/b.png)')).toBe(
      'uploads/1/a_orig.jpg',
    )
  })
  it('is null without an image', () => {
    expect(firstImage('just text\n[link](uploads/1/a.pdf)')).toBeNull()
  })
})

describe('mediaJobs', () => {
  const people = [
    { name: 'Ann', legacy_url: '/p.html#ann', photo: `${U}ann.jpg?5` },
    { name: 'Bob', legacy_url: '/p.html#bob', photo: null },
  ]
  const press = [
    { outlet: 'Mada', logo: `${U}editor/m.png?1` },
    { outlet: 'Mada', logo: `${U}editor/other.png` },
    { outlet: 'Nowhere', logo: null },
    { outlet: null, logo: `${U}editor/x.png` },
  ]
  const publications = [
    { legacy_url: '/translation-as-education.html', title_en: 'TaE', title_ar: null },
    { legacy_url: '/on-pigeon-towers.html', title_en: 'Pigeon', title_ar: null },
  ]
  const courses = [
    { legacy_url: '/own.html', title: 'Own course', title_ar: null },
    { legacy_url: '/cycle.html#a', title: 'In a cycle', title_ar: null },
    { legacy_url: '/imageless.html', title: 'No image', title_ar: 'بلا صورة' },
    { legacy_url: '/arabic.html', title: 'عنوان', title_ar: null },
  ]
  const pages = [
    {
      legacy_url: '/translation-as-education.html',
      kind: 'publication',
      text: `![image](${U}cover_orig.jpg)`,
    },
    {
      legacy_url: '/on-pigeon-towers.html',
      kind: 'publication',
      text: `![image](${U}portrait.jpg)`,
    },
    {
      legacy_url: '/own.html',
      kind: 'course',
      text: `x\n![image](${U}c1_orig.jpg?2)\n![image](${U}c2.jpg)`,
    },
    { legacy_url: '/cycle.html', kind: 'cycle', text: `![image](${U}cy.jpg)` },
    { legacy_url: '/imageless.html', kind: 'course', text: 'text only' },
    { legacy_url: '/arabic.html', kind: 'course', text: `![image](${U}ar.jpg)` },
  ]

  const jobs = mediaJobs({ people, press, publications, courses, pages })

  it('plans one photo per person who has one', () => {
    expect(jobs.filter((j) => j.collection === 'people')).toEqual([
      {
        collection: 'people',
        legacy_url: '/p.html#ann',
        field: 'photo',
        path: `${U}ann.jpg`,
        alt: 'Ann',
      },
    ])
  })

  it('plans one logo per outlet, the first logo winning, keyed by name', () => {
    expect(jobs.filter((j) => j.collection === 'press')).toEqual([
      {
        collection: 'press',
        name: 'Mada',
        field: 'outlet.logo',
        path: `${U}editor/m.png`,
        alt: 'Mada',
      },
    ])
  })

  it('plans a cover for Translation as Education only', () => {
    expect(jobs.filter((j) => j.collection === 'publications')).toEqual([
      {
        collection: 'publications',
        legacy_url: '/translation-as-education.html',
        field: 'cover_image',
        path: `${U}cover_orig.jpg`,
        alt: 'TaE',
      },
    ])
  })

  it('plans a cover for courses that have their own page and an image', () => {
    expect(jobs.filter((j) => j.collection === 'courses')).toEqual([
      {
        collection: 'courses',
        legacy_url: '/own.html',
        field: 'cover_image',
        path: `${U}c1_orig.jpg`,
        alt: 'Own course',
      },
      {
        collection: 'courses',
        legacy_url: '/arabic.html',
        field: 'cover_image',
        path: `${U}ar.jpg`,
        alt: 'عنوان',
      },
    ])
  })

  it('shares one upload between jobs on the same path', () => {
    const shared = [
      { collection: 'people', legacy_url: '/a', field: 'photo', path: 'uploads/x.jpg', alt: 'A' },
      {
        collection: 'courses',
        legacy_url: '/b',
        field: 'cover_image',
        path: 'uploads/x.jpg',
        alt: 'B',
      },
      {
        collection: 'courses',
        legacy_url: '/c',
        field: 'cover_image',
        path: 'uploads/y.jpg',
        alt: 'C',
      },
    ]
    expect(uniquePaths(shared)).toEqual(['uploads/x.jpg', 'uploads/y.jpg'])
  })
})

describe('rewriteLinks', () => {
  it('rewrites matching link urls anywhere in a lexical tree and counts them', () => {
    const tree = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                fields: { url: 'https://www.ci-las.org/uploads/a.pdf' },
                children: [],
              },
            ],
          },
          {
            type: 'paragraph',
            children: [{ type: 'link', fields: { url: 'https://other.org/' }, children: [] }],
          },
        ],
      },
    }
    const out = rewriteLinks(tree, (u) => (u.endsWith('a.pdf') ? 'https://r2/a.pdf' : null))
    expect(out.count).toBe(1)
    expect(JSON.stringify(out.tree)).toContain('https://r2/a.pdf')
    expect(JSON.stringify(out.tree)).toContain('https://other.org/')
    expect(JSON.stringify(tree)).toContain('ci-las.org')
  })
})

describe('pdfJobs', () => {
  it('plans the print editions and the newsletter PDF, skipping other links', () => {
    const jobs = pdfJobs({
      publications: [
        {
          legacy_url: '/a.html',
          title_en: 'A',
          print_edition_url: `https://www.ci-las.org/${U}a%20b.pdf`,
        },
        { legacy_url: '/b.html', title_en: 'B', print_edition_url: null },
      ],
      newsletters: [
        {
          legacy_url: '/n.html#1',
          title_en: 'N1',
          archive_url: `https://www.ci-las.org/${U}n.pdf`,
        },
        {
          legacy_url: '/n.html#2',
          title_en: 'N2',
          archive_url: 'http://us7.campaign-archive1.com/?id=1',
        },
      ],
    })
    expect(jobs).toEqual([
      {
        collection: 'publications',
        legacy_url: '/a.html',
        field: 'print_edition_url',
        path: `${U}a b.pdf`,
        alt: 'A',
      },
      {
        collection: 'newsletters',
        legacy_url: '/n.html#1',
        field: 'body_pdf_link',
        path: `${U}n.pdf`,
        alt: 'N1',
      },
    ])
  })
})
