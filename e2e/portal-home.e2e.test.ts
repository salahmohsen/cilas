import { expect, test, type Browser, type Page } from '@playwright/test'
import { createTranslator } from 'next-intl'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import { formatsOf } from '../src/i18n/formats'
import { addDays, cairoDay, cairoInstant, weekdayOf } from '../src/lib/cairo-day'
import { weekStart } from '../src/lib/calendar'
import { localDigits } from '../src/lib/digits'
import { relId } from '../src/lib/relation'
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
const weekSection = (page: Page) => page.locator('main section[data-week]')
const weekDays = (page: Page) => weekSection(page).getByRole('group').getByRole('button')

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

    const boxesOf = async (page: Page) => {
      await expect(latestRows(page).first()).toBeVisible()
      await expect(yourSpaces(page).locator('li').first()).toBeVisible()
      await expect(needsSection(page)).toBeVisible()
      await expect(nextSession(page)).toBeVisible()
      await expect(weekSection(page)).toBeVisible()
      const box = (slot: string) => page.locator(`main [data-slot="${slot}"]`).boundingBox()
      return {
        needs: (await box('needs'))!,
        next: (await box('next'))!,
        spaces: (await box('spaces'))!,
        latest: (await box('latest'))!,
        week: (await box('week'))!,
      }
    }

    for (const locale of LOCALES) {
      test(`wide Home puts Next session beside Needs you (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
          await page.goto(homePath(locale))
          const { needs, next, spaces, latest, week } = await boxesOf(page)
          expect(next.y).toBe(needs.y)
          expect(next.height).toBe(needs.height)
          expect(next.height).toBeGreaterThanOrEqual(320)
          const [first, second] = locale === 'ar' ? [needs, next] : [next, needs]
          expect(first.x + first.width).toBeLessThan(second.x)
          expect(next.width / needs.width).toBeCloseTo(7 / 5, 1)
          expect(spaces.width).toBeCloseTo(next.width + needs.width + 12, 0)
          expect(latest.y).toBe(week.y)
          expect(latest.width / week.width).toBeCloseTo(7 / 5, 1)
          expect(spaces.width).toBeCloseTo(latest.width + week.width + 12, 0)
          const [lead, trail] = locale === 'ar' ? [week, latest] : [latest, week]
          expect(lead.x + lead.width).toBeLessThan(trail.x)
          expect(spaces.y).toBeGreaterThan(next.y + next.height)
          expect(latest.y).toBeGreaterThan(spaces.y + spaces.height)
        })
      })

      test(`stacked Home keeps the reading order (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: PHONE, reader: 'student' }, async (page) => {
          await page.goto(homePath(locale))
          const { needs, next, spaces, latest, week } = await boxesOf(page)
          const column = [needs, next, spaces, latest, week]
          expect(column.map((box) => box.y)).toEqual(
            column.map((box) => box.y).toSorted((a, b) => a - b),
          )
          expect(new Set(column.map((box) => Math.round(box.width))).size).toBe(1)
        })
      })

      test(`Your spaces is one row from the reading start, by key and by touch (${locale})`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          baseURL,
          storageState: states.admin,
          viewport: PHONE,
          hasTouch: true,
        })
        try {
          const page = await context.newPage()
          await page.goto(homePath(locale))
          const row = yourSpaces(page).getByRole('region', {
            name: portalOf(locale).home.spacesList,
          })
          const cards = row.getByRole('link')
          await expect(cards.first()).toBeVisible()
          const count = await cards.count()
          expect(count).toBeGreaterThan(2)
          const tops = await cards.evaluateAll((links) =>
            links.map((link) => Math.round(link.getBoundingClientRect().top)),
          )
          expect(new Set(tops).size).toBe(1)

          const startGap = () =>
            row.evaluate((viewport) => {
              const frame = viewport.getBoundingClientRect()
              const card = viewport.querySelector('li')!.getBoundingClientRect()
              return Math.round(
                getComputedStyle(viewport).direction === 'rtl'
                  ? frame.right - card.right
                  : card.left - frame.left,
              )
            })
          const scrolled = () => row.evaluate((viewport) => Math.abs(viewport.scrollLeft))
          expect(await startGap()).toBe(4)
          expect(await scrolled()).toBe(0)

          const cdp = await context.newCDPSession(page)
          await row.scrollIntoViewIfNeeded()
          const seen = (await row.boundingBox())!
          await cdp.send('Input.synthesizeScrollGesture', {
            x: Math.round(seen.x + seen.width / 2),
            y: Math.round(seen.y + seen.height / 3),
            xDistance: locale === 'ar' ? 250 : -250,
            yDistance: 0,
            gestureSourceType: 'touch',
          })
          await expect.poll(scrolled).toBeGreaterThan(100)

          await row.focus()
          await expect(row).toBeFocused()
          for (let i = 0; i < count; i++) {
            await page.keyboard.press('Tab')
            await expect(cards.nth(i)).toBeFocused()
            await expect(cards.nth(i)).toBeInViewport({ ratio: 0.99 })
          }
          expect(
            await page.evaluate(() => {
              const root = document.scrollingElement!
              return root.scrollWidth - root.clientWidth
            }),
          ).toBe(0)
        } finally {
          await context.close()
        }
      })
    }

    for (const locale of LOCALES)
      for (const viewport of Object.values(WIDTHS)) {
        test(`an admin with no session gets Open the calendar, and it opens /spaces/calendar (${locale} ${viewport.width})`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport, reader: 'admin' }, async (page) => {
            await page.goto(homePath(locale))
            await nextSession(page)
              .getByRole('link', { name: portalOf(locale).home.openCalendar })
              .click()
            await expect(page).toHaveURL((url) => url.pathname === `/${locale}/spaces/calendar`)
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(
              MESSAGES[locale].Calendar.title,
            )
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
        await expect(review).toHaveAccessibleName(/^Review [0-9]+ items /)
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
          page.locator('a[href="#main"]'),
          page.locator('[data-needs] li:first-child a'),
          nextSession(page).getByRole('link', { name: /Portal e2e session/ }),
          page.locator('#home-spaces + div [role="region"]'),
          page.locator('#home-spaces + div li:first-child a'),
          page.locator('[data-latest] li:first-child a'),
          page.locator('[data-latest] > a[href="/en/spaces/inbox"]'),
          page.locator('[data-week] a[href="/en/spaces/calendar"]'),
          page.locator('[data-week] button[aria-pressed][tabindex="0"]'),
        ]
        for (const target of targets.slice(1)) await expect(target).toBeVisible()
        const elements = await Promise.all(targets.map((target) => target.elementHandle()))
        const stops: number[] = []
        for (let i = 0; i < 160 && stops.length < targets.length; i++) {
          await page.keyboard.press('Tab')
          const stop = await page.evaluate((targets) => {
            const element = document.activeElement
            return element
              ? {
                  index: targets.findIndex((target) => target === element),
                  outline: getComputedStyle(element).outlineStyle,
                }
              : null
          }, elements)
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
            weekSection(page),
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

  test.describe('This week', () => {
    const { track: trackWeek, cleanup: cleanupWeek } = createTracker()
    const today = cairoDay(new Date())!
    const first = weekStart(today)
    const week = Array.from({ length: 7 }, (_, offset) => addDays(first, offset))
    const second = today === first ? addDays(today, 1) : first
    const todayAt = week.indexOf(today)
    const secondAt = week.indexOf(second)
    const titles = {
      today: uniq('Week today'),
      second: uniq('Week second'),
      event: uniq('Week event'),
    }
    const made: string[] = []
    let loner: StorageState
    let token: string

    const asAdmin = (path: string, method: 'PATCH' | 'DELETE', data?: object) =>
      fetch(`${baseURL}/api/${path}`, {
        method,
        headers: { 'content-type': 'application/json', authorization: `JWT ${token}` },
        body: data && JSON.stringify(data),
      })

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(300_000)
      const space = await payload.findByID({
        collection: 'spaces',
        id: fixture.world.course.space,
        depth: 0,
        overrideAccess: true,
      })
      const session = async (title: string, date: string) => {
        const { id } = trackWeek(
          'sessions',
          await payload.create({
            collection: 'sessions',
            data: {
              course: Number(relId(space.course)),
              title,
              meetings: [{ date, start_time: '19:00', end_time: '21:00' }],
            },
            overrideAccess: true,
          }),
        )
        made.push(`sessions/${id}`)
      }
      await session(titles.today, today)
      await session(titles.second, second)
      const slug = uniq('week-event')
      const event = trackWeek(
        'events',
        await payload.create({
          collection: 'events',
          locale: 'en',
          data: {
            title: titles.event,
            slug,
            tier: 'public',
            event_type: 'talk',
            schedule: {
              mode: 'single',
              start_date: today,
              start_time: '18:00',
              end_time: '19:00',
            },
            _status: 'published',
          } as never,
          overrideAccess: true,
        }),
      )
      made.push(`events/${event.id}`)

      const context = await browser.newContext({ baseURL })
      try {
        await login({
          page: await context.newPage(),
          user: fixture.world.loners.student,
          next: '/en/spaces',
        })
        loner = await context.storageState()
      } finally {
        await context.close()
      }

      const { email, password } = fixture.world.accounts.admin
      const signedIn = await fetch(`${baseURL}/api/users/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      token = ((await signedIn.json()) as { token: string }).token
      const saved = await asAdmin(`events/${event.id}?locale=en`, 'PATCH', {
        title: titles.event,
      })
      expect(saved.ok).toBe(true)
      for (const locale of LOCALES)
        await expect
          .poll(
            async () =>
              (
                await (await fetch(`${baseURL}/${locale}/calendar?view=week&date=${today}`)).text()
              ).includes(slug),
            { timeout: 60_000 },
          )
          .toBe(true)
    })

    test.afterAll(async () => {
      try {
        for (const path of made) expect((await asAdmin(path, 'DELETE')).ok, path).toBe(true)
      } finally {
        await cleanupWeek(payload)
      }
    })

    const open = async (page: Page, locale: Locale) => {
      await page.clock.setFixedTime(new Date(cairoInstant(today, '12:00')!))
      await page.goto(homePath(locale))
      await expect(weekDays(page)).toHaveCount(7)
    }
    const list = (page: Page) => weekSection(page).getByRole('list')
    const fits = (page: Page) =>
      page.evaluate(() => {
        const root = document.scrollingElement!
        return root.scrollWidth <= root.clientWidth
      })

    for (const locale of LOCALES)
      for (const viewport of Object.values(WIDTHS))
        test(`a student sees this week's sessions and switches days (${locale} ${viewport.width})`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport, reader: 'student' }, async (page) => {
            await open(page, locale)
            const todayButton = weekDays(page).nth(todayAt)
            await expect(todayButton).toHaveAttribute('aria-pressed', 'true')
            await expect(todayButton).toHaveAttribute('aria-current', 'date')
            const weekday = portalOf(locale).home.week.weekdays[weekdayOf(today)]
            const number = localDigits(Number(today.slice(8)), locale)
            await expect(todayButton).toHaveAccessibleName(
              new RegExp(`^${weekday} ${number}[,،] `, 'u'),
            )
            await expect(list(page)).toContainText(titles.today)
            await expect(list(page)).toContainText(titles.event)
            await expect(list(page)).not.toContainText(titles.second)

            await weekDays(page).nth(secondAt).click()
            await expect(weekDays(page).nth(secondAt)).toHaveAttribute('aria-pressed', 'true')
            await expect(todayButton).toHaveAttribute('aria-pressed', 'false')
            await expect(list(page)).toContainText(titles.second)
            await expect(list(page)).not.toContainText(titles.today)
            await expect(page.locator('[data-portal-live]')).toContainText(
              (await list(page).getAttribute('aria-label'))!,
            )
            await expect(
              list(page).getByRole('link').filter({ hasText: titles.second }),
            ).toHaveAttribute('href', localePath(fixture.world.course.path, locale))
          })
        })

    test('a student with no course sees this week’s public event and no course session', async ({
      browser,
    }) => {
      await inContextAt(browser, { baseURL, viewport: DESKTOP, state: loner }, async (page) => {
        await open(page, 'en')
        await expect(list(page)).toContainText(titles.event)
        await expect(weekSection(page)).not.toContainText(titles.today)
        await weekDays(page).nth(secondAt).click()
        await expect(weekDays(page).nth(secondAt)).toHaveAttribute('aria-pressed', 'true')
        await expect(weekSection(page)).not.toContainText(titles.second)
      })
    })

    for (const locale of LOCALES)
      test(`the week’s day buttons are big enough to press and hold their labels (${locale})`, async ({
        browser,
      }) => {
        for (const [width, minimum] of [
          [390, 44],
          [320, 24],
        ] as const)
          await inContext(
            browser,
            { viewport: { width, height: 800 }, reader: 'student' },
            async (page) => {
              await open(page, locale)
              const cells = await weekDays(page).evaluateAll((buttons) =>
                buttons.map((button) => {
                  const box = button.getBoundingClientRect()
                  const labels = [...button.querySelectorAll(':scope > span[aria-hidden]')].slice(
                    0,
                    2,
                  )
                  return {
                    width: box.width,
                    height: box.height,
                    labelSize: parseFloat(getComputedStyle(labels[0]!).fontSize),
                    labelsFit: labels.every((label) => {
                      const text = label.getBoundingClientRect()
                      const oneLine = text.height < 2 * parseFloat(getComputedStyle(label).fontSize)
                      return (
                        oneLine &&
                        label.scrollWidth <= Math.ceil(text.width) &&
                        text.left >= box.left + button.clientLeft &&
                        text.right <= box.right - button.clientLeft
                      )
                    }),
                  }
                }),
              )
              test.info().annotations.push({
                type: `day cells ${locale} ${width}`,
                description: JSON.stringify(cells),
              })
              for (const cell of cells) {
                expect(cell.width, `width at ${width}`).toBeGreaterThanOrEqual(minimum)
                expect(cell.height, `height at ${width}`).toBeGreaterThanOrEqual(44)
                expect(cell.labelSize).toBeGreaterThanOrEqual(11)
                expect(cell.labelsFit, `labels at ${width}`).toBe(true)
              }
              expect(await fits(page)).toBe(true)
            },
          )
      })

    test('in Arabic Saturday is the rightmost day', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
        await open(page, 'ar')
        await expect(weekDays(page).first()).toHaveAccessibleName(
          new RegExp(`^${portalOf('ar').home.week.weekdays.sat} `, 'u'),
        )
        const lefts = await weekDays(page).evaluateAll((buttons) =>
          buttons.map((button) => button.getBoundingClientRect().left),
        )
        expect(lefts).toEqual(lefts.toSorted((a, b) => b - a))
      })
    })

    for (const locale of LOCALES)
      test(`the keyboard chooses a day (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (page) => {
          await open(page, locale)
          await weekSection(page)
            .getByRole('link', { name: portalOf(locale).nav.calendar, exact: true })
            .focus()
          await page.keyboard.press('Tab')
          await expect(weekDays(page).nth(todayAt)).toBeFocused()
          const step = todayAt < 6 ? 1 : -1
          const [onward, back] =
            locale === 'ar' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft']
          await page.keyboard.press(step === 1 ? onward! : back!)
          const target = weekDays(page).nth(todayAt + step)
          await expect(target).toBeFocused()
          await expect(weekDays(page).nth(todayAt)).toHaveAttribute('aria-pressed', 'true')
          await page.keyboard.press('Space')
          await expect(target).toHaveAttribute('aria-pressed', 'true')
          await expect(target).toBeFocused()
          await page.keyboard.press('Tab')
          expect(
            await page.evaluate(() =>
              Boolean(document.activeElement?.closest('[data-week] [role="group"]')),
            ),
          ).toBe(false)
        })
      })

    for (const locale of LOCALES)
      for (const viewport of Object.values(WIDTHS))
        for (const colorScheme of ['light', 'dark'] as const)
          test(`This week has no axe violation with rows (${locale} ${viewport.width} ${colorScheme})`, async ({
            browser,
          }) => {
            const context = await browser.newContext({
              baseURL,
              viewport,
              colorScheme,
              storageState: states.student,
            })
            try {
              const page = await context.newPage()
              await open(page, locale)
              await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
              await expect(list(page).getByRole('link').first()).toBeVisible()
              await expect(latestRows(page).first()).toBeVisible()
              const height = (await weekSection(page).boundingBox())!.height
              await weekDays(page).nth(secondAt).click()
              await expect(list(page)).toContainText(titles.second)
              test.info().annotations.push({
                type: `week card height ${locale} ${viewport.width}`,
                description: `today ${height} px; second day ${(await weekSection(page).boundingBox())!.height} px with ${await list(page).getByRole('link').count()} row(s)`,
              })
              expect(await axeOver(page, {})).toEqual({})
            } finally {
              await context.close()
            }
          })
  })
})
