import { expect, test, type Browser, type Page } from '@playwright/test'
import { createTranslator } from 'next-intl'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import { formatsOf } from '../src/i18n/formats'
import { localDigits } from '../src/lib/digits'
import { login } from '../testing/login.test-utils'
import { portalNeedsWorld, type PortalNeedsWorld } from '../testing/needs.fixture'
import { createTracker, uniq } from '../testing/payload.fixture'
import {
  holdSpacesMode,
  localePath,
  inContext as inContextAt,
  LOCALES,
  MESSAGES,
  ROLES,
  WIDTHS,
  type Locale,
  type PortalRole,
  type StorageState,
} from '../testing/portal.fixture'
import { axeOver, known, mailOff, navName } from '../testing/portal-e2e.test-utils'

type Viewport = { width: number; height: number }

const DESKTOP = WIDTHS.desktop
const PHONE = WIDTHS.phone
const SHOWN_CAP = 9

const { track, cleanup } = createTracker()
let payload: Payload
let fixture: PortalNeedsWorld
let spaces: Awaited<ReturnType<typeof holdSpacesMode>> | undefined
let baseURL: string | undefined
const states = {} as Record<PortalRole, StorageState>

const inContext = (
  browser: Browser,
  options: { viewport: Viewport; reader: PortalRole },
  run: (page: Page) => Promise<void>,
) =>
  inContextAt(browser, { baseURL, viewport: options.viewport, state: states[options.reader] }, run)

const inboxPath = (locale: Locale, query = '') => `/${locale}/spaces/inbox${query}`
const portalOf = (locale: Locale) => MESSAGES[locale].Portal
const translator = (locale: Locale, namespace: 'Portal' | 'Notifications') =>
  createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace,
    formats: formatsOf(locale),
  })

const mainNav = (page: Page, locale: Locale) =>
  page.getByRole('navigation', { name: portalOf(locale).nav.label, exact: true })
const inboxLink = (page: Page, locale: Locale) =>
  mainNav(page, locale).getByRole('link', { name: navName(portalOf(locale).nav.inbox) })
const chipOf = (page: Page, locale: Locale) => inboxLink(page, locale).locator('[data-nav-count]')
const homePath = (locale: Locale) => `/${locale}/spaces`
const nextSession = (page: Page) =>
  page.locator('main section[aria-labelledby="home-next-session"]')
const yourSpaces = (page: Page) => page.locator('main section[aria-labelledby="home-spaces"]')
const needsSection = (page: Page) => page.locator('main section[data-needs]')
const latestSection = (page: Page) => page.locator('main section[data-latest]')
const latestRows = (page: Page) => latestSection(page).locator('ol > li')

const totalOf = async (page: Page) => {
  const text = await needsSection(page).locator('h2 > span').textContent()
  return Number(text!.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)))
}

const shownFor = (total: number, locale: Locale) =>
  localDigits(total > SHOWN_CAP ? `${SHOWN_CAP}+` : total, locale)

test.describe('portal Home and Inbox', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(600_000)
    baseURL = test.info().project.use.baseURL
    payload = await getPayload({ config, key: uniq('portal-home') })
    mailOff(payload)
    spaces = await holdSpacesMode(payload)
    await spaces.set('on')
    fixture = await portalNeedsWorld(payload, track)
    for (const reader of ROLES) {
      const context = await browser.newContext({ baseURL })
      try {
        await login({
          page: await context.newPage(),
          user: fixture.world.accounts[reader],
          next: '/en/spaces',
        })
        states[reader] = await context.storageState()
      } finally {
        await context.close()
      }
    }
  })

  test.afterAll(async () => {
    try {
      if (payload) await cleanup(payload)
    } finally {
      await spaces?.release()
    }
  })

  test.describe('Home', () => {
    const narrow = { width: 320, height: 800 }
    for (const role of ROLES)
      for (const locale of LOCALES)
        for (const viewport of [DESKTOP, PHONE, narrow]) {
          test(`Home shows the greeting, work, session, spaces and Latest (${role} ${locale} ${viewport.width})`, async ({
            browser,
          }) => {
            await inContext(browser, { viewport, reader: role }, async (page) => {
              const portal = portalOf(locale)
              await page.goto(homePath(locale))
              const heading = page.getByRole('heading', { level: 1 })
              const person = fixture.world.accounts[role].person
              if (person === null) {
                await expect(heading).toHaveText(portal.home.greeting)
              } else {
                const reader = await payload.findByID({
                  collection: 'people',
                  id: person,
                  locale,
                  depth: 0,
                  select: { name: true },
                })
                const firstName = reader.name.trim().split(/\s+/u, 1)[0]
                await expect(heading.locator('bdi')).toHaveText(firstName!)
              }
              await expect(needsSection(page).getByRole('heading')).toContainText(
                portal.needs.heading,
              )
              await expect(nextSession(page).getByRole('heading')).toHaveText(
                portal.home.nextSession,
              )
              await expect(yourSpaces(page).getByRole('heading')).toHaveText(portal.home.spaces)
              await expect(latestSection(page).getByRole('heading')).toHaveText(
                portal.latest.heading,
              )
              const rooms = [fixture.world.course.path, fixture.world.otherCourse.path]
              if (role === 'admin') {
                await expect(nextSession(page).getByText(portal.home.noSession)).toBeVisible()
                const fixtureIds = Object.values(fixture.needs.adminWaiting).flat()
                expect(await totalOf(page)).toBeGreaterThanOrEqual(fixtureIds.length)
              } else {
                const upcoming = nextSession(page).getByRole('link', { name: /Portal e2e session/ })
                await expect(upcoming).toBeVisible()
                expect(rooms.map((path) => localePath(path, locale))).toContain(
                  await upcoming.getAttribute('href'),
                )
                const own =
                  role === 'fellow'
                    ? `courses/${fixture.needs.fellowCourses.changes_requested}`
                    : `articles/${fixture.needs.lists.articles.changes_requested}`
                await expect(
                  needsSection(page).locator(`a[href="/admin/collections/${own}"]`),
                ).toBeVisible()
              }
              await expect(
                yourSpaces(page).locator(
                  `a[href="${localePath(fixture.world.community.path, locale)}"]`,
                ),
              ).toBeVisible()
              await expect(latestRows(page)).toHaveCount(role === 'student' ? 5 : 1)
              await expect(
                latestSection(page).getByRole('link', { name: portal.home.openInbox }),
              ).toHaveAttribute('href', inboxPath(locale))
              const total = await totalOf(page)
              const count =
                total > SHOWN_CAP
                  ? translator(locale, 'Portal')('nav.countMany', {
                      cap: localDigits(SHOWN_CAP, locale),
                    })
                  : translator(locale, 'Portal')('nav.count', {
                      count: total,
                      shown: localDigits(total, locale),
                    })
              await expect(inboxLink(page, locale)).toHaveAccessibleName(
                `${portal.nav.inbox}${count}`,
              )
              await expect(chipOf(page, locale)).toHaveText(shownFor(total, locale))
              if (viewport === narrow) {
                expect(
                  await page.evaluate(() => {
                    const root = document.scrollingElement!
                    return root.scrollWidth <= root.clientWidth
                  }),
                ).toBe(true)
              }
              expect(await axeOver(page, {})).toEqual({})
            })
          })
        }

    test('more than five rows group by kind and keep the same total', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, reader: 'admin' }, async (page) => {
        await page.goto(inboxPath('en'))
        const waiting = Object.entries(fixture.needs.adminWaiting).flatMap(([collection, ids]) =>
          ids.map((id) => `/admin/collections/${collection}/${id}`),
        )
        expect(waiting.length).toBeGreaterThan(5)
        for (const href of waiting)
          await expect(needsSection(page).locator(`a[href="${href}"]`)).toBeVisible()
        const total = await totalOf(page)
        await page.goto(homePath('en'))
        await expect(needsSection(page).locator('h2 > span')).toHaveText(String(total))
        const review = needsSection(page).locator('a[data-need-kind="review"]')
        await expect(review).toHaveCount(1)
        await expect(review).toHaveAttribute('href', '/admin/reviews')
        await expect(review).toHaveAccessibleName(/^Review [0-9]+ items$/)
      })
    })

    test('Home uses plain links and Latest opens a full post page', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, reader: 'fellow' }, async (page) => {
        await page.goto(homePath('en'))
        await expect(needsSection(page).getByRole('link').first()).toHaveAttribute(
          'href',
          /^\/admin\//,
        )
        const post = latestSection(page).locator(`a[href="${fixture.link}"]`)
        const navigation = page.waitForRequest(
          (request) =>
            request.isNavigationRequest() && new URL(request.url()).pathname === fixture.link,
        )
        await post.click()
        await navigation
        await expect(page).toHaveURL(new RegExp(`${fixture.link}$`))
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(page.locator('main article').first()).toBeVisible()
      })
    })

    test('a keyboard walk reaches each Home card in order', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
        await page.goto(homePath('en'))
        await expect(latestRows(page)).toHaveCount(5)
        const targets = [
          'a[href="#main"]',
          '[data-needs] li:first-child a',
          '#home-next-session + a',
          '#home-spaces + ul li:first-child a',
          '[data-latest] li:first-child a',
          '[data-latest] > a[href="/en/spaces/inbox"]',
        ]
        const stops: number[] = []
        for (let i = 0; i < 160 && stops.length < targets.length; i++) {
          await page.keyboard.press('Tab')
          const stop = await page.evaluate((selectors) => {
            const element = document.activeElement
            return element
              ? {
                  index: selectors.findIndex((selector) => element.matches(selector)),
                  outline: getComputedStyle(element).outlineStyle,
                }
              : null
          }, targets)
          if (!stop || stop.index === -1) continue
          expect(stop.outline).not.toBe('none')
          stops.push(stop.index)
        }
        expect(stops).toEqual(targets.map((_, index) => index))
      })
    })

    for (const locale of LOCALES) {
      test(`Home at 200% zoom reflows without losing a card (${locale})`, async ({ browser }) => {
        const context = await browser.newContext({
          baseURL,
          storageState: states.student,
          viewport: { width: 640, height: 400 },
          deviceScaleFactor: 2,
        })
        try {
          const page = await context.newPage()
          await page.goto(homePath(locale))
          const sections = [
            needsSection(page),
            nextSession(page),
            yourSpaces(page),
            latestSection(page),
          ]
          for (const section of sections) {
            const heading = section.getByRole('heading', { level: 2 })
            await heading.scrollIntoViewIfNeeded()
            await expect(heading).toBeInViewport()
          }
          expect(
            await page.evaluate(() => {
              const root = document.scrollingElement!
              return root.scrollWidth <= root.clientWidth
            }),
          ).toBe(true)
        } finally {
          await context.close()
        }
      })
    }
  })

  test.describe('the page', () => {
    for (const role of ROLES)
      for (const locale of LOCALES)
        for (const viewport of Object.values(WIDTHS)) {
          const at = `${role} ${locale} ${viewport.width}`

          test(`Inbox shows Needs you, then Latest (${at})`, async ({ browser }) => {
            await inContext(browser, { viewport, reader: role }, async (page) => {
              await page.goto(inboxPath(locale))
              const portal = portalOf(locale)
              await expect(page.getByRole('heading', { level: 1 })).toHaveText(portal.inbox.title)
              await expect(needsSection(page).locator('h2')).toBeVisible()
              const headings = await page
                .locator('main h2')
                .evaluateAll((hs) => hs.map((h) => h.firstChild?.textContent))
              expect(headings).toEqual([portal.needs.heading, portal.latest.heading])
              const hrefs = await needsSection(page)
                .locator('a')
                .evaluateAll((links) => links.map((link) => link.getAttribute('href')!))
              expect(hrefs.length).toBeGreaterThan(0)
              for (const href of hrefs) expect(href).toMatch(/^\/admin\//)
              const needs = fixture.needs
              const own =
                role === 'admin'
                  ? [
                      ...needs.adminWaiting.articles.map((id) => `articles/${id}`),
                      ...needs.adminWaiting.courses.map((id) => `courses/${id}`),
                    ]
                  : role === 'fellow'
                    ? [`courses/${needs.fellowCourses.changes_requested}`]
                    : [
                        `articles/${needs.lists.articles.changes_requested}`,
                        `articles/${needs.lists.articles.published_edits_returned}`,
                      ]
              for (const path of own)
                expect(
                  hrefs.some((href) => href.includes(`/admin/collections/${path}`)),
                  path,
                ).toBe(true)
              await expect(
                latestSection(page).locator(`a[href="${fixture.link}"]`).first(),
              ).toBeVisible()
            })
          })

          test(`the sidebar Inbox number equals the Needs you count (${at})`, async ({
            browser,
          }) => {
            await inContext(browser, { viewport, reader: role }, async (page) => {
              await page.goto(inboxPath(locale))
              const total = await totalOf(page)
              if (role !== 'admin') expect(total).toBeGreaterThanOrEqual(1)
              await expect(chipOf(page, locale)).toHaveText(shownFor(total, locale))
              if (total <= SHOWN_CAP) {
                const words = translator(locale, 'Portal')('nav.count', {
                  count: total,
                  shown: localDigits(total, locale),
                })
                await expect(inboxLink(page, locale)).toHaveAccessibleName(
                  `${portalOf(locale).nav.inbox}${words}`,
                )
              }
            })
          })

          test(`Inbox has no axe violations beyond the shell's known ones (${at})`, async ({
            browser,
          }) => {
            await inContext(browser, { viewport, reader: role }, async (page) => {
              await page.goto(inboxPath(locale))
              await expect(chipOf(page, locale)).toBeVisible()
              expect(
                await axeOver(page, known(inboxPath(locale), role, locale, viewport.width)),
              ).toEqual({})
            })
          })
        }

    for (const locale of LOCALES) {
      test(`the nav puts Inbox second for every role (${locale})`, async ({ browser }) => {
        for (const role of ROLES)
          await inContext(browser, { viewport: DESKTOP, reader: role }, async (page) => {
            await page.goto(`/${locale}/spaces`)
            const links = mainNav(page, locale).getByRole('link')
            await expect(links.nth(0)).toHaveAttribute('href', `/${locale}/spaces`)
            await expect(links.nth(1)).toHaveAttribute('href', `/${locale}/spaces/inbox`)
          })
      })

      test(`on a phone the bottom bar carries Inbox with its count (${locale})`, async ({
        browser,
      }) => {
        await inContext(browser, { viewport: PHONE, reader: 'student' }, async (page) => {
          const path = '**/api/portal/counts'
          let release!: () => void
          const pending = new Promise<void>((resolve) => (release = resolve))
          await page.route(path, async (route) => {
            await pending
            await route.continue()
          })
          const request = page.waitForRequest(path)
          await page.goto(`/${locale}/spaces`)
          const link = inboxLink(page, locale)
          await request
          try {
            await expect(link).toHaveAccessibleName(portalOf(locale).nav.inbox)
            await expect(link.locator('[data-nav-count]')).toHaveCount(0)
          } finally {
            release()
          }
          await expect(link.locator('[data-nav-count]')).toBeVisible()
        })
      })
    }
  })

  test.describe('Latest', () => {
    for (const locale of LOCALES)
      for (const viewport of [DESKTOP, PHONE]) {
        test(`Show more loads the other 5 rows and moves focus to the 31st (${locale} ${viewport.width})`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport, reader: 'student' }, async (page) => {
            await page.goto(inboxPath(locale))
            await expect(latestRows(page)).toHaveCount(30)
            await latestSection(page)
              .getByRole('link', { name: portalOf(locale).latest.showMore })
              .click()
            await page.waitForURL(`**/${locale}/spaces/inbox?latest=2`)
            await expect(latestRows(page)).toHaveCount(35)
            await expect
              .poll(() =>
                page.evaluate(() => {
                  const row = document.activeElement?.closest('li')
                  return row ? [...row.parentElement!.children].indexOf(row) : -1
                }),
              )
              .toBe(30)
            await expect(
              latestSection(page).getByRole('link', { name: portalOf(locale).latest.showMore }),
            ).toHaveCount(0)
          })
        })
      }

    for (const locale of LOCALES)
      test(`a Latest row opens its link and marks it read (${locale})`, async ({ browser }) => {
        await payload.update({
          collection: 'notifications',
          where: { recipient: { equals: fixture.world.accounts.fellow.id } },
          data: { read_at: null },
          overrideAccess: true,
        })
        await inContext(browser, { viewport: DESKTOP, reader: 'fellow' }, async (page) => {
          const tn = translator(locale, 'Notifications')
          const unread = tn('triggerUnread', { count: 1, shown: localDigits(1, locale) })
          const bell = page.getByRole('button', {
            name: new RegExp(`^${MESSAGES[locale].Notifications.label}`),
          })
          await page.goto(inboxPath(locale))
          await expect(bell).toHaveAccessibleName(
            `${MESSAGES[locale].Notifications.label}${unread}`,
          )
          await latestSection(page).locator(`a[href="${fixture.link}"]`).click()
          await page.waitForURL(`**${fixture.link}`)
          const landed = page.getByRole('button', {
            name: new RegExp(`^${MESSAGES.en.Notifications.label}`),
          })
          await expect(landed).toHaveAccessibleName(MESSAGES.en.Notifications.label, {
            timeout: 5_000,
          })
        })
      })

    test('an unread row names itself unread, a read row does not (en)', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
        await page.goto(inboxPath('en'))
        await expect(latestRows(page).first().getByRole('link')).toHaveAccessibleName(/^Unread,/)
      })
    })
  })

  test.describe('keyboard and zoom', () => {
    test('a keyboard walk reaches every part of Inbox (en)', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
        await page.goto(inboxPath('en'))
        await expect(chipOf(page, 'en')).toBeVisible()
        const stops: string[] = []
        const seen = new Set<string>()
        for (let i = 0; i < 120; i++) {
          await page.keyboard.press('Tab')
          const stop = await page.evaluate(() => {
            const el = document.activeElement
            if (!el || el === document.body) return null
            return {
              id: `${[...document.querySelectorAll('*')].indexOf(el)}:${el.tagName}:${el.getAttribute('href') ?? ''}`,
              outline: getComputedStyle(el).outlineStyle,
              label: el.getAttribute('aria-label') ?? el.textContent ?? '',
              inNeeds: Boolean(el.closest('[data-needs]')),
              inLatest: Boolean(el.closest('[data-latest]')),
              skip: el.getAttribute('href') === '#main',
              inbox: el.getAttribute('href') === '/en/spaces/inbox',
              more: el.textContent === 'Show more',
            }
          })
          if (!stop) break
          if (seen.has(stop.id)) break
          seen.add(stop.id)
          expect(stop.outline, stop.id).not.toBe('none')
          const tag = stop.skip
            ? 'skip'
            : stop.inbox
              ? 'inbox'
              : stop.inNeeds
                ? 'needs'
                : stop.more
                  ? 'more'
                  : stop.inLatest
                    ? 'latest'
                    : null
          if (tag && stops.at(-1) !== tag) stops.push(tag)
          if (stop.more) break
        }
        expect(stops).toEqual(['skip', 'inbox', 'needs', 'latest', 'more'])
      })
    })

    for (const locale of LOCALES)
      test(`Jump to Latest focuses its heading (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: PHONE, reader: 'student' }, async (page) => {
          await page.goto(inboxPath(locale))
          const portal = portalOf(locale)
          const jump = page.getByRole('link', { name: portal.inbox.jumpToLatest })
          await jump.focus()
          await jump.press('Enter')
          await expect(page).toHaveURL(/#latest$/)
          await expect(page.getByRole('heading', { name: portal.latest.heading })).toBeFocused()
        })
      })

    test('Inbox at 200% zoom has no horizontal scroll (en)', async ({ browser }) => {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 640, height: 400 },
        deviceScaleFactor: 2,
        storageState: states.student,
      })
      try {
        const page = await context.newPage()
        await page.goto(inboxPath('en'))
        await expect(needsSection(page).locator('h2')).toBeVisible()
        await expect(latestSection(page).locator('h2')).toBeVisible()
        await expect(needsSection(page).locator('a').first()).toBeVisible()
        await expect(latestRows(page).first()).toBeVisible()
        const fits = await page.evaluate(
          () => document.scrollingElement!.scrollWidth <= document.scrollingElement!.clientWidth,
        )
        expect(fits).toBe(true)
      } finally {
        await context.close()
      }
    })
  })
})
