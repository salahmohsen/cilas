import { JSDOM } from 'jsdom'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Locale } from '@/i18n/routing'
import { STATUS_KEYS, nextAction, statusBadge, type StatusKey } from '@/lib/review-status'

import { messagesOf } from '../../../testing/intl.test-utils'
import { serverFormatter, serverTranslator } from '../../../testing/server-intl.test-utils'
import { emptyStateOf, titleKeyOf } from './empty-states'
import type { ListCollection, ListKind } from './groups'
import { ListRowBody } from './list-row'
import { failureOf, ListViewBody, resultOrFailed } from './list-view'
import { PortalPageHeader } from './page-header'
import type { ListGroup, ListResult, ListRow } from './rows'

const NOW = new Date('2026-11-22T12:00:00Z')
const ARABIC_DIGIT = /[٠-٩]/
const LATIN_DIGIT = /[0-9]/

const BASE: ListRow = {
  id: 1,
  collection: 'articles',
  key: 'draft',
  group: 'inProgress',
  title: 'A title',
  cover: null,
  updatedAt: '2026-11-20T12:00:00Z',
  waitingSince: null,
  owners: [],
  tier: 'public',
  course: null,
}
const listRow = (overrides: Partial<ListRow> = {}) => ({ ...BASE, ...overrides })

const COURSE = {
  ...BASE,
  collection: 'courses' as const,
  tier: null,
  course: { type: 'CORE' as const, season: 'spring' as const, year: 2026, held: 5, total: 12 },
}

const lookup = (locale: Locale, key: string) =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      messagesOf[locale].Portal,
    )

const doc = (markup: string) => new JSDOM(markup).window.document

const intl = (locale: Locale) => ({
  t: serverTranslator('Portal', locale),
  tStudy: serverTranslator('Study.filters', locale),
  format: serverFormatter(locale),
  locale,
  now: NOW,
})

const renderRow = (
  row: ListRow,
  { viewer = 'owner', locale = 'en' }: { viewer?: 'owner' | 'admin'; locale?: Locale } = {},
) =>
  doc(
    renderToStaticMarkup(
      <ul>
        <ListRowBody row={row} viewer={viewer} {...intl(locale)} />
      </ul>,
    ),
  )

const group = (id: ListGroup['id'], rows: ListRow[], total = rows.length) =>
  ({ id, rows, total, hasMore: false }) satisfies ListGroup

const HREFS = { retry: '/en/x?retry', clearSearch: '/en/x?clear', showAll: '/en/x?all' }

const renderView = (
  result: ListResult | 'failed',
  {
    query = { q: null, show: null },
    locale = 'en',
  }: { query?: { q: string | null; show: 'needsYou' | null }; locale?: Locale } = {},
) =>
  doc(
    renderToStaticMarkup(
      <ListViewBody
        result={result}
        viewer="owner"
        query={query}
        hrefs={HREFS}
        empty={<p data-empty-slot>empty</p>}
        moreOf={(g) => <span data-more={g.id} />}
        {...intl(locale)}
      />,
    ),
  )

describe('titleKeyOf', () => {
  it.each([
    ['articles', 'ownerArticles', 'lists.myArticles'],
    ['articles', 'admin', 'lists.allArticles'],
    ['courses', 'fellowCourses', 'lists.myCourses'],
    ['courses', 'admin', 'lists.allCourses'],
  ] as const)('titleKeyOf(%s, %s) is %s', (collection, kind, key) => {
    expect(titleKeyOf(collection, kind)).toBe(key)
    for (const locale of ['en', 'ar'] as const) expect(typeof lookup(locale, key)).toBe('string')
  })
})

describe('emptyStateOf', () => {
  const CREATE = '/admin/collections/articles/create'
  it.each<[ListCollection, ListKind, string | null, object]>([
    [
      'articles',
      'ownerArticles',
      CREATE,
      {
        titleKey: 'lists.empty.ownerArticles.title',
        bodyKey: 'lists.empty.ownerArticles.body',
        nextKey: 'lists.empty.ownerArticles.next',
        action: { labelKey: 'lists.writeArticle', href: CREATE, external: true },
      },
    ],
    [
      'articles',
      'ownerArticles',
      null,
      {
        titleKey: 'lists.empty.ownerArticles.title',
        bodyKey: 'lists.empty.ownerArticles.body',
        nextKey: 'lists.empty.ownerArticles.next',
      },
    ],
    [
      'articles',
      'admin',
      CREATE,
      { titleKey: 'lists.empty.adminArticles.title', bodyKey: 'lists.empty.adminArticles.body' },
    ],
    [
      'courses',
      'fellowCourses',
      '/admin/collections/courses/create',
      {
        titleKey: 'lists.empty.fellowCourses.title',
        bodyKey: 'lists.empty.fellowCourses.body',
        action: {
          labelKey: 'lists.proposeCourse',
          href: '/admin/collections/courses/create',
          external: true,
        },
      },
    ],
    [
      'courses',
      'admin',
      null,
      {
        titleKey: 'lists.empty.adminCourses.title',
        bodyKey: 'lists.empty.adminCourses.body',
        action: { labelKey: 'lists.openDashboard', href: '/admin', external: true },
      },
    ],
  ])('emptyStateOf(%s, %s, %s)', (collection, kind, href, expected) => {
    const state = emptyStateOf(collection, kind, href)
    expect(state).toEqual(expected)
    const keys = [state.titleKey, state.bodyKey, state.nextKey, state.action?.labelKey]
    for (const locale of ['en', 'ar'] as const)
      for (const key of keys.filter(Boolean))
        expect(typeof lookup(locale, key!), `${locale} ${key}`).toBe('string')
  })
})

describe('ListRowBody', () => {
  const nextLine = (page: Document) => page.querySelector('[data-next-action]')
  const badges = (page: Document) => [...page.querySelectorAll('[data-status-badge]')]

  it.each(STATUS_KEYS)('an owner row has a slot, a badge and a next-action line (%s)', (key) => {
    const page = renderRow(listRow({ key }))
    expect(page.querySelector('li [data-slot]')).not.toBeNull()
    expect(badges(page).length).toBeGreaterThan(0)
    expect(nextLine(page)?.textContent).toBe(lookup('en', nextAction(key, 'owner')!.labelKey))
  })

  it.each(STATUS_KEYS)(
    'an admin row has a slot and a badge, and a next-action line only where the spec gives one (%s)',
    (key) => {
      const page = renderRow(listRow({ key }), { viewer: 'admin' })
      expect(page.querySelector('li [data-slot]')).not.toBeNull()
      expect(badges(page).length).toBeGreaterThan(0)
      const waits: StatusKey[] = [
        'submitted',
        'changes_requested',
        'published_edits',
        'published_removal',
        'published_edits_returned',
      ]
      expect(nextLine(page) !== null).toBe(waits.includes(key))
    },
  )

  it('an admin row whose action is none renders no line element', () => {
    const page = renderRow(listRow({ key: 'published' }), { viewer: 'admin' })
    expect(nextLine(page)).toBeNull()
    expect(page.querySelector('li')!.children.length).toBeGreaterThan(0)
  })

  it.each(STATUS_KEYS)('every badge shows its icon (%s)', (key) => {
    const page = renderRow(listRow({ key }))
    expect(badges(page)).toHaveLength(statusBadge(key).length)
    for (const badge of badges(page)) expect(badge.querySelectorAll('svg')).toHaveLength(1)
  })

  it('a row with no cover shows an empty slot with no text', () => {
    const slot = renderRow(listRow()).querySelector('[data-slot]')!
    expect(slot.querySelector('img')).toBeNull()
    expect(slot.textContent).toBe('')
  })

  it('a row with a cover shows it with no alt text', () => {
    const img = renderRow(listRow({ cover: '/media/cover.jpg' })).querySelector('[data-slot] img')!
    expect(img.getAttribute('src')).toContain(encodeURIComponent('/media/cover.jpg'))
    expect(img.getAttribute('alt')).toBe('')
  })

  it('the title is the only link of the row and opens the admin URL', () => {
    const links = renderRow(listRow({ id: 42 })).querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]!.getAttribute('href')).toBe('/admin/collections/articles/42')
    expect(links[0]!.textContent).toBe('A title')
    expect(links[0]!.querySelector('bdi')).not.toBeNull()
  })

  it('the title link sets no direction of its own: the title is isolated, the row keeps the page direction', () => {
    const link = renderRow(listRow({ title: 'Latin title' }), { locale: 'ar' }).querySelector('a')!
    expect(link.closest('[dir]')).toBeNull()
    expect(link.querySelector('bdi')!.textContent).toBe('Latin title')
  })

  it('an untitled row names itself', () => {
    expect(renderRow(listRow({ title: null })).querySelector('a')!.textContent).toBe(
      'Untitled article',
    )
    expect(renderRow({ ...COURSE, title: null }).querySelector('a')!.textContent).toBe(
      'Untitled course',
    )
  })

  it('a course row has no applicant link and no Participants link', () => {
    const page = renderRow({ ...COURSE, key: 'published', group: 'teachingNow' })
    expect(page.querySelectorAll('a')).toHaveLength(1)
    expect(page.querySelector('a')!.getAttribute('href')).toBe('/admin/collections/courses/1')
  })

  it('a course row names its type, season, year and sessions', () => {
    const meta = renderRow(COURSE).querySelector('[data-meta]')!.textContent
    expect(meta).toBe('Core course · Spring 2026 · 5 of 12 held')
  })

  it('a course row names its type and season in Arabic', () => {
    const meta = renderRow(COURSE, { locale: 'ar' }).querySelector('[data-meta]')!.textContent!
    expect(meta).toContain(messagesOf.ar.Study.filters.types.core)
    expect(meta).toContain(messagesOf.ar.Study.filters.seasons.spring)
    expect(meta).toContain('٢٠٢٦')
    expect(meta).toContain('٥')
    expect(meta).toContain('١٢')
    expect(meta).not.toMatch(LATIN_DIGIT)
  })

  it('a course with no cycle and no type keeps only its sessions', () => {
    const meta = renderRow({
      ...COURSE,
      course: { type: null, season: null, year: null, held: 0, total: 3 },
    }).querySelector('[data-meta]')!.textContent
    expect(meta).toBe('0 of 3 held')
  })

  it('an Arabic row writes its numbers in Arabic digits', () => {
    const meta = renderRow(listRow({ key: 'submitted', waitingSince: '2026-11-19T12:00:00Z' }), {
      viewer: 'admin',
      locale: 'ar',
    }).querySelector('[data-meta]')!.textContent!
    expect(meta).toMatch(ARABIC_DIGIT)
    expect(meta).not.toMatch(LATIN_DIGIT)
  })

  it('a live course with edits waiting shows two badges', () => {
    expect(
      badges(renderRow({ ...COURSE, key: 'published_edits', group: 'teachingNow' })),
    ).toHaveLength(2)
  })

  it.each(['en', 'ar'] as const)(
    'the admin row names the owners and how long it waits (%s)',
    (locale) => {
      const owners = ['Ann Writer', 'Bo Author']
      const meta = renderRow(
        listRow({ key: 'submitted', owners, waitingSince: '2026-11-19T12:00:00Z' }),
        { viewer: 'admin', locale },
      ).querySelector('[data-meta]')!.textContent!
      expect(meta).toContain(serverFormatter(locale).list(owners))
      expect(meta).toContain(serverTranslator('Portal', locale)('lists.meta.waiting', { days: 3 }))
    },
  )

  it.each([
    ['en', 'Waiting since today'],
    ['ar', 'ينتظر منذ اليوم'],
  ] as const)('an admin row that waits since today says so, not "0 days" (%s)', (locale, line) => {
    for (const waitingSince of ['2026-11-22T11:00:00Z', '2026-11-22T12:00:00Z']) {
      const meta = renderRow(listRow({ key: 'submitted', owners: [], waitingSince }), {
        viewer: 'admin',
        locale,
      }).querySelector('[data-meta]')!.textContent!
      expect(meta).toContain(line)
      expect(meta).not.toMatch(/\b0\b|٠/)
    }
  })

  it('an admin row that waits one day says one day', () => {
    const meta = renderRow(
      listRow({ key: 'submitted', owners: [], waitingSince: '2026-11-21T12:00:00Z' }),
      { viewer: 'admin' },
    ).querySelector('[data-meta]')!.textContent!
    expect(meta).toContain('Waiting 1 day')
  })

  it('an owner row names no owner and no wait', () => {
    const meta = renderRow(
      listRow({ key: 'submitted', owners: ['Ann Writer'], waitingSince: '2026-11-19T12:00:00Z' }),
    ).querySelector('[data-meta]')!.textContent!
    expect(meta).toBe('Updated 2 days ago · Public')
  })
})

describe('ListViewBody', () => {
  const sections = (page: Document) => [...page.querySelectorAll('section')]

  it.each(['en', 'ar'] as const)(
    'groups keep their order, each a section with an h2 that names its count (%s)',
    (locale) => {
      const page = renderView(
        {
          total: 4,
          groups: [
            group('needsYou', [listRow({ id: 1, key: 'changes_requested' })]),
            group('published', [listRow({ id: 2, key: 'published' })], 3),
          ],
        },
        { locale },
      )
      expect(sections(page).map((s) => s.getAttribute('data-list-group'))).toEqual([
        'needsYou',
        'published',
      ])
      for (const section of sections(page)) {
        const heading = section.querySelector('h2')!
        expect(section.getAttribute('aria-labelledby')).toBe(heading.id)
        expect(section.querySelector('ol > li')).not.toBeNull()
      }
      const second = sections(page)[1]!.querySelector('h2')!.textContent!
      expect(second).toBe(
        serverTranslator('Portal', locale)('lists.groupCount', {
          name: serverTranslator('Portal', locale)('lists.group.published'),
          count: 3,
        }),
      )
      if (locale === 'ar') {
        expect(second).toMatch(ARABIC_DIGIT)
        expect(second).not.toMatch(LATIN_DIGIT)
      }
      expect(page.querySelector('[data-more="published"]')).not.toBeNull()
    },
  )

  it('a list with no row renders the empty slot', () => {
    const page = renderView({ total: 0, groups: [] })
    expect(page.querySelector('[data-empty-slot]')).not.toBeNull()
    expect(sections(page)).toHaveLength(0)
  })

  it('a search with no result offers Clear search', () => {
    const page = renderView({ total: 3, groups: [] }, { query: { q: 'zz', show: null } })
    expect(page.body.textContent).toContain('No results for "zz".')
    expect(page.querySelector('bdi')!.textContent).toBe('zz')
    expect(page.querySelector('a')!.textContent).toBe('Clear search')
    expect(page.querySelector('a')!.getAttribute('href')).toBe(HREFS.clearSearch)
    expect(page.querySelector('[data-empty-slot]')).toBeNull()
  })

  it('a filter with no row offers Show all', () => {
    const page = renderView({ total: 3, groups: [] }, { query: { q: null, show: 'needsYou' } })
    expect(page.body.textContent).toContain('Nothing here now.')
    expect(page.querySelector('a')!.textContent).toBe('Show all')
    expect(page.querySelector('a')!.getAttribute('href')).toBe(HREFS.showAll)
  })

  it('a filtered list with rows shows no empty state', () => {
    const page = renderView(
      { total: 3, groups: [group('needsYou', [listRow({ key: 'changes_requested' })])] },
      { query: { q: null, show: 'needsYou' } },
    )
    expect(sections(page)).toHaveLength(1)
    expect(page.body.textContent).not.toContain('Nothing here now.')
    expect(page.querySelector('[data-empty-slot]')).toBeNull()
  })

  it('a list whose rows are gone shows the empty slot', () => {
    expect(renderView({ total: 3, groups: [] }).querySelector('[data-empty-slot]')).not.toBeNull()
  })

  it('a failed load shows the error line and Retry', () => {
    const page = renderView('failed')
    expect(page.body.textContent).toContain('The list could not load.')
    expect(page.querySelector('a')!.textContent).toBe('Retry')
    expect(page.querySelector('a')!.getAttribute('href')).toBe(HREFS.retry)
    expect(sections(page)).toHaveLength(0)
  })
})

describe('failureOf', () => {
  it('keeps the name, the message and the code of an error', () => {
    const error = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
    expect(failureOf(error)).toEqual({
      name: 'Error',
      message: 'connection refused',
      code: 'ECONNREFUSED',
    })
  })

  it('leaves out the rest of the object: a query, its values, a stack', () => {
    const error = Object.assign(new Error('boom'), {
      query: 'select * from articles where title like $1',
      parameters: ['secret search'],
      data: { email: 'a@b.c' },
    })
    expect(Object.keys(failureOf(error)).sort()).toEqual(['code', 'message', 'name'])
    expect(JSON.stringify(failureOf(error))).not.toMatch(/secret|select|a@b\.c/)
  })

  it('reads a thrown value that is not an error', () => {
    expect(failureOf('text')).toEqual({ name: 'string', message: 'text', code: null })
    expect(failureOf(null)).toEqual({ name: 'object', message: 'null', code: null })
  })
})

describe('resultOrFailed', () => {
  it('a load that throws gives failed and logs once', async () => {
    const logged: unknown[] = []
    const error = new Error('down')
    expect(
      await resultOrFailed(
        () => Promise.reject(error),
        (e) => logged.push(e),
      ),
    ).toBe('failed')
    expect(logged).toEqual([error])
  })

  it('a load that resolves gives its result', async () => {
    const result: ListResult = { total: 0, groups: [] }
    const logged: unknown[] = []
    expect(
      await resultOrFailed(
        () => Promise.resolve(result),
        (e) => logged.push(e),
      ),
    ).toBe(result)
    expect(logged).toEqual([])
  })
})

describe('PortalPageHeader', () => {
  it('the header has one h1 and its subtitle, and the primary is a plain link', () => {
    const page = doc(
      renderToStaticMarkup(
        <PortalPageHeader
          title="My articles"
          subtitle="Everything you write"
          primary={{ label: 'New article', href: '/admin/collections/articles/create' }}
        />,
      ),
    )
    expect(page.querySelectorAll('h1')).toHaveLength(1)
    expect(page.querySelector('h1')!.textContent).toBe('My articles')
    expect(page.body.textContent).toContain('Everything you write')
    const link = page.querySelector('a')!
    expect(link.textContent).toBe('New article')
    expect(link.getAttribute('href')).toBe('/admin/collections/articles/create')
  })

  it('with no primary there is no link', () => {
    const page = doc(renderToStaticMarkup(<PortalPageHeader title="All articles" />))
    expect(page.querySelector('a')).toBeNull()
  })
})
