import { expect, test, type Browser, type Page } from '@playwright/test'
import Color from 'colorjs.io'
import { createTranslator } from 'next-intl'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import { formatsOf } from '../src/i18n/formats'
import { ratio } from '../src/portal/theme/contrast'
import type { GroupId } from '../src/portal/lists/groups'
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

const noResultsText = (locale: Locale, query: string) =>
  [translator(locale).rich('lists.noResults', { query, bdi: (chunks) => chunks })].flat().join('')

const colourOf = (page: Page, value: string) =>
  page.evaluate((css) => {
    const probe = document.createElement('span')
    probe.style.color = css
    document.body.append(probe)
    const colour = getComputedStyle(probe).color
    probe.remove()
    return colour
  }, value)

const GROUP_SEQUENCE: Record<string, GroupId[]> = {
  [`student ${ARTICLES}`]: ['needsYou', 'inProgress', 'withEditors', 'published', 'closed'],
  [`teacher ${COURSES}`]: ['needsYou', 'teachingNow', 'proposals', 'closed'],
  [`writer ${ARTICLES}`]: ['needsYou', 'waitingOnAuthor', 'inProgress', 'published', 'closed'],
  [`writer ${COURSES}`]: ['needsYou', 'waitingOnAuthor', 'published', 'closed'],
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
            expect(rows.length).toBeGreaterThan(0)
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
          const shown: Record<string, GroupId[]> = {}
          for (const [reader, path] of [
            ['student', ARTICLES],
            ['teacher', COURSES],
            ['writer', ARTICLES],
            ['writer', COURSES],
          ] as const)
            await inContext(browser, { viewport, reader }, async (page) => {
              await page.goto(listPath(path, locale))
              shown[`${reader} ${path}`] = await groupOrder(page)
              const headings = await page
                .locator('section[data-list-group] > h2')
                .evaluateAll((hs) => hs.map((h) => h.textContent))
              expect(headings).toHaveLength(shown[`${reader} ${path}`]!.length)
            })
          expect(shown).toEqual(GROUP_SEQUENCE)
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
        const create = '/admin/collections/articles/create'
        for (const reader of ['student', 'writer', 'admin'] as const)
          await inContext(browser, { viewport: DESKTOP, reader }, async (page) => {
            await page.goto(listPath(ARTICLES, locale))
            await expect(page.locator('section[data-list-group]').first()).toBeVisible()
            await expect(newArticle(page)).toHaveAttribute('href', create)
          })
        await inContext(browser, { viewport: DESKTOP, reader: 'teacher' }, async (page) => {
          await page.goto(listPath(ARTICLES, locale))
          await expect(page.locator('section[data-list-group]')).toHaveCount(0)
          await expect(newArticle(page)).toHaveCount(0)
          await expect(
            page.locator('main').getByRole('link', { name: t.writeArticle, exact: true }),
          ).toHaveAttribute('href', create)
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
            await expect(page.getByText(noResultsText(locale, none))).toBeVisible()
            await expect(page.locator('main bdi', { hasText: none })).toHaveCount(1)
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
          const total = Number(
            (await sectionOf(page, 'published').locator('h2').textContent())!.match(/\d+/)![0],
          )
          const added = Math.min(50, total - 50)
          expect(added).toBeGreaterThan(0)
          const announced = await page.locator('[data-portal-live]').evaluateHandle((live) => {
            const texts: string[] = []
            new MutationObserver(() => {
              if (live.textContent) texts.push(live.textContent)
            }).observe(live, { childList: true, characterData: true, subtree: true })
            return texts
          })
          let rscInFlight = 0
          const isRsc = (request: { headers: () => Record<string, string> }) =>
            request.headers().rsc === '1'
          page.on('request', (request) => {
            if (isRsc(request)) rscInFlight++
          })
          const settle = (request: { headers: () => Record<string, string> }) => {
            if (isRsc(request)) rscInFlight--
          }
          page.on('requestfinished', settle)
          page.on('requestfailed', settle)
          await page.keyboard.press('Enter')
          await page.waitForURL((url) => url.searchParams.get('published') === '2')
          const rows = sectionOf(page, 'published').locator('li')
          await expect(rows.nth(50).locator('a')).toBeFocused()
          await expect.poll(() => new URL(page.url()).searchParams.has('focus')).toBe(false)
          await expect(more).toHaveCount(0)
          expect(await rows.count()).toBe(50 + added)
          const message = translator('en')('lists.moreRows', { count: added })
          await expect(page.locator('[data-portal-live]')).toHaveText(message)
          await expect.poll(() => rscInFlight).toBe(0)
          await expect(rows.nth(50).locator('a')).toBeFocused()
          expect(new URL(page.url()).searchParams.has('focus')).toBe(false)
          const texts = await announced.jsonValue()
          expect(texts.filter((text) => text === message)).toHaveLength(1)
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
            const shownControls = reader === 'student'
            const inPageOrder = await page.evaluate(() => {
              const parts: string[] = []
              for (const section of document.querySelectorAll('section[data-list-group]')) {
                if (section.querySelector('li a')) parts.push('row')
                if (section.querySelector(':scope > a')) parts.push('more')
              }
              return parts
            })
            const stops: { part: string; outline: string; textField: boolean }[] = []
            let wrapped = false
            for (let i = 0; i < 400 && !wrapped; i++) {
              await page.keyboard.press('Tab')
              const stop = await page.evaluate(() => {
                const el = document.activeElement
                if (!el || el === document.body) return null
                const part = el.matches('a[href="#main"]')
                  ? 'skip'
                  : el.closest('[data-portal-rail] nav')
                    ? 'sidebar'
                    : el.closest('[data-portal-rail]')
                      ? 'header'
                      : el.closest('[data-portal-crumbs]')
                        ? 'fold'
                        : el.closest('main header')
                          ? 'primary'
                          : el.closest('main nav')
                            ? 'chips'
                            : el.closest('[role="search"]')
                              ? 'search'
                              : el.closest('section[data-list-group] li')
                                ? 'row'
                                : el.closest('section[data-list-group]')
                                  ? 'more'
                                  : el.closest('nav')
                                    ? 'bar'
                                    : 'other'
                return {
                  part,
                  outline: getComputedStyle(el).outlineStyle,
                  textField: el.matches('input:not([type="checkbox"], [type="radio"])'),
                }
              })
              if (!stop) continue
              wrapped = stop.part === 'skip' && stops.length > 0
              if (!wrapped) stops.push(stop)
            }
            expect(wrapped, 'the walk came back to the skip link').toBe(true)
            const runs = (parts: string[]) => parts.filter((part, i, all) => part !== all[i - 1])
            const expected = [
              'skip',
              'header',
              ...(phone ? [] : ['sidebar', 'fold']),
              'primary',
              ...(shownControls ? ['chips', 'search'] : []),
              ...inPageOrder,
              ...(phone ? ['bar'] : []),
            ]
            expect(runs(stops.map((stop) => stop.part))).toEqual(runs(expected))
            expect(stops.filter((stop) => !stop.textField && stop.outline === 'none')).toEqual([])
            if (shownControls) {
              const box = searchBox(page, 'en')
              const border = () =>
                box.evaluate((input) => getComputedStyle(input.parentElement!).borderColor)
              const background = await page
                .locator('main')
                .evaluate((main) => getComputedStyle(main).backgroundColor)
              await page.locator('main h1').click()
              const rest = await border()
              await box.focus()
              await expect.poll(border).not.toBe(rest)
              await expect
                .poll(async () => ratio(new Color(await border()), new Color(background)))
                .toBeGreaterThanOrEqual(3)
            }
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
          const route = listPath(path, locale)
          const allowed = known(route, ROLE_OF[reader], locale, DESKTOP.width)
          for (const colorScheme of ['light', 'dark'] as const) {
            const context = await browser.newContext({
              baseURL,
              viewport: DESKTOP,
              storageState: states[reader],
              colorScheme,
            })
            try {
              const page = await context.newPage()
              await page.goto(route)
              await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
              await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
              expect(await axeOver(page, allowed), colorScheme).toEqual({})
              if (reader === 'student') {
                await page.goto(`${route}?q=${encodeURIComponent(lists.titles.beta)}`)
                await expect(page.locator('section[data-list-group] li')).toHaveCount(1)
                await searchBox(page, locale).focus()
                expect(await axeOver(page, allowed), `${colorScheme} search`).toEqual({})
              }
            } finally {
              await context.close()
            }
          }
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

    test('on a phone a one-row list sits right under the header, with no blank band (en)', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: WIDTHS.phone, reader: 'student' }, async (page) => {
        await page.goto(listPath(ARTICLES, 'en', `?q=${encodeURIComponent(lists.titles.beta)}`))
        await expect(page.locator('section[data-list-group] li')).toHaveCount(1)
        const gap = await page.evaluate(
          () =>
            document.querySelector('main')!.getBoundingClientRect().top -
            document.querySelector('[data-portal-rail]')!.getBoundingClientRect().bottom,
        )
        expect(gap).toBeLessThanOrEqual(1)
      })
    })

    test('a group heading is 17px, in tabular figures (en)', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
        await page.goto(listPath(ARTICLES, 'en'))
        const heading = await sectionOf(page, 'needsYou')
          .locator('h2')
          .evaluate((h) => {
            const style = getComputedStyle(h)
            return {
              size: style.fontSize,
              figures: style.fontVariantNumeric,
              weight: style.fontWeight,
            }
          })
        expect(heading).toEqual({ size: '17px', figures: 'tabular-nums', weight: '500' })
      })
    })

    test('under more contrast the row hairlines, the cover slot and the badges take the strong border (en)', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
        await page.goto(listPath(ARTICLES, 'en'))
        const edges = () =>
          page.evaluate(() => {
            const row = document.querySelector('section[data-list-group] li')!
            return {
              row: getComputedStyle(row).borderBlockEndColor,
              slot: getComputedStyle(row.querySelector('[data-slot]')!).boxShadow,
              badge: getComputedStyle(row.querySelector('[data-status-badge]')!)
                .borderBlockEndColor,
            }
          })
        const normal = await edges()
        await page.emulateMedia({ contrast: 'more' })
        const strong = await colourOf(page, 'var(--border-strong)')
        await expect.poll(async () => (await edges()).row).toBe(strong)
        const more = await edges()
        expect(more.row).not.toBe(normal.row)
        expect(more.slot).toContain(strong)
        expect(more.slot).not.toBe(normal.slot)
        expect(more.badge).not.toBe(normal.badge)
      })
    })

    test('a click on the search field outside its input focuses the input (en)', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
        await page.goto(listPath(ARTICLES, 'en'))
        const box = searchBox(page, 'en')
        const shell = await box.evaluate((input) => {
          const rect = input.parentElement!.getBoundingClientRect()
          return { x: rect.x, y: rect.y, height: rect.height }
        })
        await page.mouse.click(shell.x + 3, shell.y + shell.height / 2)
        await expect(box).toBeFocused()
      })
    })

    test('a chip link keeps the search and drops the page counts (en)', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
        await page.goto(listPath(ARTICLES, 'en', '?published=2'))
        await expect(sectionOf(page, 'published').locator('li').nth(50)).toBeVisible()
        const hrefs = await chipsNav(page, 'en')
          .getByRole('link')
          .evaluateAll((links) => links.map((a) => a.getAttribute('href')!))
        expect(hrefs).toHaveLength(4)
        for (const href of hrefs) expect(href).not.toContain('published=')
      })
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
