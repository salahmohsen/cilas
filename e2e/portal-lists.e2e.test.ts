import { expect, test, type Browser, type Page } from '@playwright/test'
import { createTranslator } from 'next-intl'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import { formatsOf } from '../src/i18n/formats'
import { GROUPS, type GroupId, type ListKind } from '../src/portal/lists/groups'
import { login } from '../testing/login.test-utils'
import { createTracker, uniq } from '../testing/payload.fixture'
import {
  holdSpacesMode,
  inContext as inContextAt,
  LOCALES,
  MESSAGES,
  portalWorld,
  WIDTHS,
  type Locale,
  type PortalAccount,
  type PortalWorld,
  type StorageState,
} from '../testing/portal.fixture'
import { axeOver, known } from '../testing/portal-e2e.test-utils'
import { listWorld, type ListWorld } from '../testing/portal-lists.fixture'

type Reader = 'student' | 'teacher' | 'writer' | 'admin'
type Viewport = (typeof WIDTHS)[keyof typeof WIDTHS]

const DESKTOP = WIDTHS.desktop
const ARTICLES = '/spaces/articles'
const COURSES = '/spaces/courses'

const { track, cleanup } = createTracker()
let payload: Payload
let world: PortalWorld
let lists: ListWorld
let spaces: Awaited<ReturnType<typeof holdSpacesMode>>
let baseURL: string | undefined
const states = {} as Record<Reader, StorageState>

const inContext = (
  browser: Browser,
  options: { viewport: Viewport; reader: Reader },
  run: (page: Page) => Promise<void>,
) =>
  inContextAt(browser, { baseURL, viewport: options.viewport, state: states[options.reader] }, run)

const listPath = (path: string, locale: Locale, query = '') => `/${locale}${path}${query}`
const sectionOf = (page: Page, group: GroupId) =>
  page.locator(`section[data-list-group="${group}"]`)
const groupOrder = (page: Page) =>
  page
    .locator('section[data-list-group]')
    .evaluateAll((sections) => sections.map((s) => s.getAttribute('data-list-group') as GroupId))
const translator = (locale: Locale) =>
  createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: 'Portal',
    formats: formatsOf(locale),
  })
const chipsNav = (page: Page, locale: Locale) =>
  page.getByRole('navigation', { name: MESSAGES[locale].Portal.lists.chips.label, exact: true })
const searchBox = (page: Page, locale: Locale) =>
  page.getByRole('search').getByRole('searchbox', { name: MESSAGES[locale].Portal.lists.search })
const showMoreIn = (page: Page, locale: Locale, group: GroupId) =>
  page.getByRole('link', {
    name: translator(locale)('lists.showMoreIn', {
      group: translator(locale)(`lists.group.${group}`),
    }),
    exact: true,
  })

const expectInOrder = (shown: GroupId[], kind: ListKind) => {
  const order = shown.map((group) => GROUPS[kind].indexOf(group))
  expect(order.every((index) => index >= 0)).toBe(true)
  expect(order).toEqual([...order].sort((a, b) => a - b))
}

const rowParts = (page: Page) =>
  page.locator('section[data-list-group] li').evaluateAll((rows) =>
    rows.map((row) => ({
      group: row.closest('section')!.getAttribute('data-list-group'),
      slot: row.querySelector('[data-slot]') !== null,
      badges: row.querySelectorAll('[data-status-badge]').length,
      next: row.querySelector('[data-next-action]') !== null,
      links: row.querySelectorAll('a').length,
    })),
  )

test.describe('portal lists', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(600_000)
    baseURL = test.info().project.use.baseURL
    payload = await getPayload({ config, key: uniq('portal-lists') })
    spaces = await holdSpacesMode(payload)
    await spaces.set('on')
    world = await portalWorld(payload, track)
    lists = await listWorld(payload, track, world)
    const accounts: Record<Reader, PortalAccount> = {
      student: world.accounts.student,
      teacher: lists.teacher,
      writer: lists.writer,
      admin: world.accounts.admin,
    }
    for (const reader of Object.keys(accounts) as Reader[]) {
      const context = await browser.newContext({ baseURL })
      try {
        await login({ page: await context.newPage(), user: accounts[reader], next: '/en/spaces' })
        states[reader] = await context.storageState()
      } finally {
        await context.close()
      }
    }
  })

  test.afterAll(async () => {
    try {
      await cleanup(payload)
    } finally {
      await spaces.release()
    }
  })

  test.describe('rows, groups and the header', () => {
    for (const locale of LOCALES)
      for (const viewport of Object.values(WIDTHS)) {
        const at = `${locale} ${viewport.width}`

        test(`every row has a slot and a badge, and a next-action line where it waits on the reader (${at})`, async ({
          browser,
        }) => {
          for (const [reader, path] of [
            ['student', ARTICLES],
            ['teacher', COURSES],
          ] as const)
            await inContext(browser, { viewport, reader }, async (page) => {
              await page.goto(listPath(path, locale))
              const rows = await rowParts(page)
              expect(rows.length, reader).toBeGreaterThan(0)
              for (const row of rows)
                expect(row).toMatchObject({ slot: true, next: true, links: 1 })
              for (const row of rows) expect(row.badges).toBeGreaterThan(0)
            })
          await inContext(browser, { viewport, reader: 'writer' }, async (page) => {
            await page.goto(listPath(ARTICLES, locale))
            const rows = await rowParts(page)
            for (const row of rows) {
              expect(row).toMatchObject({ slot: true, links: 1 })
              expect(row.badges).toBeGreaterThan(0)
              expect(row.next, row.group!).toBe(
                row.group === 'needsYou' || row.group === 'waitingOnAuthor',
              )
            }
          })
        })

        test(`the group order holds (${at})`, async ({ browser }) => {
          for (const [reader, path, kind] of [
            ['student', ARTICLES, 'ownerArticles'],
            ['teacher', COURSES, 'fellowCourses'],
            ['writer', ARTICLES, 'admin'],
            ['writer', COURSES, 'admin'],
          ] as const)
            await inContext(browser, { viewport, reader }, async (page) => {
              await page.goto(listPath(path, locale))
              const shown = await groupOrder(page)
              expect(shown.length, `${reader} ${path}`).toBeGreaterThan(0)
              expectInOrder(shown, kind)
              const headings = await page
                .locator('section[data-list-group] > h2')
                .evaluateAll((hs) => hs.map((h) => h.textContent))
              expect(headings).toHaveLength(shown.length)
            })
        })

        test(`Needs you holds the rows that wait on the reader (${at})`, async ({ browser }) => {
          await inContext(browser, { viewport, reader: 'student' }, async (page) => {
            await page.goto(listPath(ARTICLES, locale))
            for (const key of ['changes_requested', 'published_edits_returned'] as const)
              await expect(
                sectionOf(page, 'needsYou').locator(
                  `a[href="/admin/collections/articles/${lists.articles[key]}"]`,
                ),
              ).toHaveCount(1)
          })
          await inContext(browser, { viewport, reader: 'writer' }, async (page) => {
            await page.goto(listPath(ARTICLES, locale))
            for (const key of ['submitted', 'published_edits', 'published_removal'] as const)
              await expect(
                sectionOf(page, 'needsYou').locator(
                  `a[href="/admin/collections/articles/${lists.articles[key]}"]`,
                ),
              ).toHaveCount(1)
          })
        })

        test(`a live course with edits waiting shows two badges (${at})`, async ({ browser }) => {
          await inContext(browser, { viewport, reader: 'teacher' }, async (page) => {
            await page.goto(listPath(COURSES, locale))
            const row = page.locator('li', {
              has: page.locator(
                `a[href="/admin/collections/courses/${lists.courses.published_edits}"]`,
              ),
            })
            await expect(row.locator('[data-status-badge]')).toHaveCount(2)
          })
        })

        test(`a course row has no applicant link and no Participants link (${at})`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport, reader: 'teacher' }, async (page) => {
            await page.goto(listPath(COURSES, locale))
            const rows = await rowParts(page)
            expect(rows).toHaveLength(6)
            for (const row of rows) expect(row.links).toBe(1)
            const hrefs = await page
              .locator('section[data-list-group] li a')
              .evaluateAll((links) => links.map((a) => a.getAttribute('href')))
            for (const href of hrefs) expect(href).toMatch(/^\/admin\/collections\/courses\/\d+$/)
          })
        })
      }

    for (const locale of LOCALES) {
      const t = MESSAGES[locale].Portal.lists

      test(`header buttons open the admin create pages (${locale})`, async ({ browser }) => {
        const newArticle = (page: Page) =>
          page.locator('main header').getByRole('link', { name: t.newArticle, exact: true })
        const propose = (page: Page) =>
          page.locator('main header').getByRole('link', { name: t.proposeCourse, exact: true })
        for (const reader of ['student', 'teacher', 'writer', 'admin'] as const)
          await inContext(browser, { viewport: DESKTOP, reader }, async (page) => {
            await page.goto(listPath(ARTICLES, locale))
            await expect(newArticle(page)).toHaveAttribute(
              'href',
              '/admin/collections/articles/create',
            )
          })
        for (const reader of ['teacher', 'writer'] as const)
          await inContext(browser, { viewport: DESKTOP, reader }, async (page) => {
            await page.goto(listPath(COURSES, locale))
            await expect(propose(page)).toHaveAttribute('href', '/admin/collections/courses/create')
          })
        await inContext(browser, { viewport: DESKTOP, reader: 'admin' }, async (page) => {
          await page.goto(listPath(COURSES, locale))
          await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.allCourses)
          await expect(propose(page)).toHaveCount(0)
        })
      })

      test(`each list's title is its H1 — CILAS (${locale})`, async ({ browser }) => {
        for (const [reader, path, h1] of [
          ['student', ARTICLES, t.myArticles],
          ['teacher', ARTICLES, t.myArticles],
          ['teacher', COURSES, t.myCourses],
          ['writer', ARTICLES, t.allArticles],
          ['writer', COURSES, t.allCourses],
        ] as const)
          await inContext(browser, { viewport: DESKTOP, reader }, async (page) => {
            await page.goto(listPath(path, locale))
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1)
            await expect(page).toHaveTitle(`${h1} — CILAS`)
          })
      })

      test(`a student gets not found on Courses (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
          const response = await page.goto(listPath(COURSES, locale))
          expect(response?.status()).toBe(404)
        })
      })
    }
  })

  test.describe('chips, search and Show more', () => {
    for (const locale of LOCALES)
      for (const viewport of Object.values(WIDTHS)) {
        const at = `${locale} ${viewport.width}`
        const t = MESSAGES[locale].Portal.lists

        test(`Published shows 50 rows and Show more (${at})`, async ({ browser }) => {
          await inContext(browser, { viewport, reader: 'student' }, async (page) => {
            await page.goto(listPath(ARTICLES, locale))
            await expect(sectionOf(page, 'needsYou').locator('li')).toHaveCount(2)
            await expect(sectionOf(page, 'published').locator('li')).toHaveCount(50)
            await expect(showMoreIn(page, locale, 'published')).toHaveCount(1)
            await expect(showMoreIn(page, locale, 'published')).toHaveText(t.showMore)
          })
        })

        test(`filter chips and search show above 6 rows and stay under a filter (${at})`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport, reader: 'student' }, async (page) => {
            await page.goto(listPath(ARTICLES, locale))
            await expect(chipsNav(page, locale)).toBeVisible()
            await expect(searchBox(page, locale)).toBeVisible()
            const chip = (name: string) =>
              chipsNav(page, locale).getByRole('link', { name, exact: true })
            await expect(chip(t.chips.all)).toHaveAttribute('aria-current', 'true')
            await chip(t.chips.needsYou).click()
            await page.waitForURL((url) => url.searchParams.get('show') === 'needsYou')
            await expect(chip(t.chips.needsYou)).toHaveAttribute('aria-current', 'true')
            await expect(chip(t.chips.all)).not.toHaveAttribute('aria-current', 'true')
            await expect(page.locator('section[data-list-group] li')).toHaveCount(2)
            await expect(searchBox(page, locale)).toBeVisible()
            await chip(t.chips.all).click()
            await page.waitForURL((url) => !url.searchParams.has('show'))
            await expect(sectionOf(page, 'published')).toBeVisible()

            await searchBox(page, locale).fill(lists.titles.beta)
            await searchBox(page, locale).press('Enter')
            await page.waitForURL((url) => url.searchParams.get('q') === lists.titles.beta)
            await expect(page.locator('section[data-list-group] li')).toHaveCount(1)
            await expect(chipsNav(page, locale)).toBeVisible()
            await expect(searchBox(page, locale)).toHaveValue(lists.titles.beta)

            const none = 'zq nothing matches this'
            await searchBox(page, locale).fill(none)
            await searchBox(page, locale).press('Enter')
            await page.waitForURL((url) => url.searchParams.get('q') === none)
            await expect(
              page.getByText(translator(locale)('lists.noResults', { query: none })),
            ).toBeVisible()
            await page.getByRole('link', { name: t.clearSearch, exact: true }).click()
            await page.waitForURL((url) => !url.searchParams.has('q'))
            await expect(sectionOf(page, 'published')).toBeVisible()
          })
        })

        test(`a small list has no chips and no search (${at})`, async ({ browser }) => {
          await inContext(browser, { viewport, reader: 'teacher' }, async (page) => {
            await page.goto(listPath(COURSES, locale))
            await expect(page.locator('section[data-list-group]').first()).toBeVisible()
            await expect(chipsNav(page, locale)).toHaveCount(0)
            await expect(page.getByRole('search')).toHaveCount(0)
          })
        })
      }

    for (const viewport of Object.values(WIDTHS)) {
      test(`Show more moves focus to the first new row (en ${viewport.width})`, async ({
        browser,
      }) => {
        await inContext(browser, { viewport, reader: 'student' }, async (page) => {
          await page.goto(listPath(ARTICLES, 'en'))
          const more = showMoreIn(page, 'en', 'published')
          await expect(more).toHaveCount(1)
          for (let i = 0; i < 200; i++) {
            await page.keyboard.press('Tab')
            if (await more.evaluate((el) => el === document.activeElement)) break
          }
          await expect(more).toBeFocused()
          await page.keyboard.press('Enter')
          await page.waitForURL((url) => url.searchParams.get('published') === '2')
          const rows = sectionOf(page, 'published').locator('li')
          await expect(rows.nth(50).locator('a')).toBeFocused()
          await expect.poll(() => new URL(page.url()).searchParams.has('focus')).toBe(false)
          await expect(more).toHaveCount(0)
          const count = (await rows.count()) - 50
          await expect(page.locator('[data-portal-live]')).toHaveText(
            translator('en')('lists.moreRows', { count }),
          )
          await page.waitForLoadState('networkidle')
          await expect(rows.nth(50).locator('a')).toBeFocused()
          expect(new URL(page.url()).searchParams.has('focus')).toBe(false)
        })
      })

      for (const [reader, path] of [
        ['student', ARTICLES],
        ['teacher', COURSES],
      ] as const)
        test(`a keyboard walk reaches every part of ${path} (${reader}, en ${viewport.width})`, async ({
          browser,
        }) => {
          const phone = viewport.width < 700
          await inContext(browser, { viewport, reader }, async (page) => {
            await page.goto(listPath(path, 'en'))
            await expect(page.locator('section[data-list-group]').first()).toBeVisible()
            const stops: { part: string; outline: string }[] = []
            for (let i = 0; i < 140; i++) {
              await page.keyboard.press('Tab')
              const stop = await page.evaluate(() => {
                const el = document.activeElement
                if (!el || el === document.body) return null
                const part = el.matches('a[href="#main"]')
                  ? 'skip'
                  : el.closest('[data-portal-rail] nav')
                    ? 'sidebar'
                    : el.closest('nav[aria-label] [aria-current], main nav')
                      ? 'chips'
                      : el.closest('[role="search"]')
                        ? 'search'
                        : el.closest('section[data-list-group] li')
                          ? 'row'
                          : el.closest('section[data-list-group]')
                            ? 'more'
                            : el.closest('main')
                              ? 'main'
                              : el.closest('nav')
                                ? 'bar'
                                : 'other'
                return { part, outline: getComputedStyle(el).outlineStyle }
              })
              if (stop) stops.push(stop)
            }
            const shownControls = reader === 'student'
            const expected = [
              'skip',
              ...(phone ? [] : ['sidebar']),
              ...(shownControls ? ['chips', 'search'] : []),
              'row',
              ...(shownControls ? ['more'] : []),
              ...(phone ? ['bar'] : []),
            ]
            const parts = stops.map((stop) => stop.part)
            let at = 0
            for (const part of parts) if (part === expected[at]) at++
            expect(at, `${expected.join(' > ')} in ${parts.join(' ')}`).toBe(expected.length)
            expect(stops.filter((stop) => stop.outline === 'none')).toEqual([])
          })
        })
    }
  })

  test.describe('accessibility and layout', () => {
    const targets = (page: Page) =>
      page
        .locator(
          'section[data-list-group] li a, main nav[aria-label] a, section[data-list-group] > a',
        )
        .evaluateAll((els) =>
          els.map((el) => {
            const box = el.getBoundingClientRect()
            return { w: box.width, h: box.height, text: el.textContent }
          }),
        )
    const small = (list: { w: number; h: number }[], min: number) =>
      list.filter((box) => box.w < min || box.h < min)

    test('the row link, each chip and Show more are at least 24x24 (en 1440)', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
        await page.goto(listPath(ARTICLES, 'en'))
        await expect(showMoreIn(page, 'en', 'published')).toHaveCount(1)
        const found = await targets(page)
        expect(found.length).toBeGreaterThan(50)
        expect(small(found, 24)).toEqual([])
      })
    })

    test('the row link, each chip and Show more are 44x44 under a coarse pointer (en)', async ({
      browser,
    }) => {
      const context = await browser.newContext({
        baseURL,
        viewport: WIDTHS.phone,
        storageState: states.student,
        hasTouch: true,
        isMobile: true,
      })
      try {
        const page = await context.newPage()
        await page.goto(listPath(ARTICLES, 'en'))
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
        await expect(showMoreIn(page, 'en', 'published')).toHaveCount(1)
        expect(small(await targets(page), 44)).toEqual([])
      } finally {
        await context.close()
      }
    })

    const ROLE_OF = { student: 'student', teacher: 'fellow', writer: 'admin' } as const
    for (const locale of LOCALES)
      for (const [reader, path] of [
        ['student', ARTICLES],
        ['teacher', ARTICLES],
        ['teacher', COURSES],
        ['writer', ARTICLES],
        ['writer', COURSES],
      ] as const)
        test(`axe finds no violation on ${path} (${reader} ${locale} 1440, light, dark, search)`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport: DESKTOP, reader }, async (page) => {
            const route = listPath(path, locale)
            const allowed = known(route, ROLE_OF[reader], locale, DESKTOP.width)
            await page.goto(route)
            await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
            expect(await axeOver(page, allowed), 'light').toEqual({})
            await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
            expect(await axeOver(page, allowed), 'dark').toEqual({})
            if (reader === 'student') {
              await page.goto(`${route}?q=${encodeURIComponent(lists.titles.beta)}`)
              await expect(page.locator('section[data-list-group] li')).toHaveCount(1)
              await searchBox(page, locale).focus()
              expect(await axeOver(page, allowed), 'search').toEqual({})
            }
          })
        })

    for (const locale of LOCALES)
      test(`reflow at 320 and 720 (student ${locale})`, async ({ browser }) => {
        for (const width of [320, 720])
          await inContextAt(
            browser,
            { baseURL, viewport: { width, height: 800 }, state: states.student },
            async (page) => {
              await page.goto(listPath(ARTICLES, locale))
              await expect(page.locator('section[data-list-group]').first()).toBeVisible()
              expect(
                await page.evaluate(
                  () => document.documentElement.scrollWidth <= window.innerWidth,
                ),
                `${width}`,
              ).toBe(true)
            },
          )
      })

    test('lists load with spaces off', async ({ browser }) => {
      await spaces.set('off')
      try {
        for (const [reader, path] of [
          ['student', ARTICLES],
          ['teacher', COURSES],
        ] as const)
          await inContext(browser, { viewport: DESKTOP, reader }, async (page) => {
            const response = await page.goto(listPath(path, 'en'))
            expect(response?.status()).toBe(200)
            await expect(page.locator('section[data-list-group]').first()).toBeVisible()
          })
      } finally {
        await spaces.set('on')
      }
    })
  })
})
