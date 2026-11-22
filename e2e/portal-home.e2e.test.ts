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
  inContext as inContextAt,
  LOCALES,
  MESSAGES,
  ROLES,
  WIDTHS,
  type Locale,
  type PortalAccount,
  type PortalRole,
  type StorageState,
} from '../testing/portal.fixture'
import { axeOver, known, mailOff, NAV_BY_ROLE, navName } from '../testing/portal-e2e.test-utils'

type Reader = PortalRole | 'secondAdmin'
type Viewport = (typeof WIDTHS)[keyof typeof WIDTHS]

const DESKTOP = WIDTHS.desktop
const PHONE = WIDTHS.phone
const SHOWN_CAP = 9

const { track, cleanup } = createTracker()
let payload: Payload
let fixture: PortalNeedsWorld
let spaces: Awaited<ReturnType<typeof holdSpacesMode>>
let baseURL: string | undefined
const states = {} as Record<Reader, StorageState>

const inContext = (
  browser: Browser,
  options: { viewport: Viewport; reader: Reader },
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
const needsSection = (page: Page) => page.locator('main section[data-needs]')
const latestSection = (page: Page) => page.locator('main section[data-latest]')
const latestRows = (page: Page) => latestSection(page).locator('ol > li')

const totalOf = async (page: Page) => {
  const text = await needsSection(page).locator('h2 > span').textContent()
  return Number(text!.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)))
}

const shownFor = (total: number, locale: Locale) =>
  localDigits(total > SHOWN_CAP ? `${SHOWN_CAP}+` : total, locale)

const REST = '/api/articles'
const write = (page: Page, id: number, data: object) =>
  page.request.patch(`${REST}/${id}?depth=0&locale=en`, { data })

test.describe('portal home: Inbox', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(600_000)
    baseURL = test.info().project.use.baseURL
    payload = await getPayload({ config, key: uniq('portal-home') })
    mailOff(payload)
    spaces = await holdSpacesMode(payload)
    await spaces.set('on')
    fixture = await portalNeedsWorld(payload, track)
    const accounts: Record<Reader, PortalAccount> = {
      ...fixture.world.accounts,
      secondAdmin: fixture.secondAdmin,
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
            const keys = NAV_BY_ROLE[role].map((item) => item.key)
            expect(keys.slice(0, 2)).toEqual(['home', 'inbox'])
            await expect(inboxLink(page, locale)).toHaveAttribute('href', `/${locale}/spaces/inbox`)
          })
      })

      test(`on a phone the bottom bar carries Inbox with its count (${locale})`, async ({
        browser,
      }) => {
        await inContext(browser, { viewport: PHONE, reader: 'student' }, async (page) => {
          await page.goto(`/${locale}/spaces`)
          const link = inboxLink(page, locale)
          await expect(link).toBeVisible()
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
          await expect(bell).toHaveAccessibleName(MESSAGES[locale].Notifications.label, {
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
              id: `${el.tagName}:${el.getAttribute('href') ?? ''}:${el.textContent?.slice(0, 40) ?? ''}`,
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

  test.describe('live refresh', () => {
    test('an owner submits in a second session and the admin Inbox number changes with no reload', async ({
      browser,
    }) => {
      const draft = fixture.needs.lists.articles.draft
      const submittedLink = `/admin/collections/articles/${draft}`
      try {
        await inContext(browser, { viewport: DESKTOP, reader: 'admin' }, async (admin) => {
          await admin.goto(inboxPath('en'))
          await expect(chipOf(admin, 'en')).toBeVisible()
          const before = await totalOf(admin)
          await admin.evaluate(() => {
            ;(window as unknown as { noReloadMark: boolean }).noReloadMark = true
          })
          let lostChip = false
          const watch = setInterval(() => {
            void chipOf(admin, 'en')
              .count()
              .then((count) => {
                if (count === 0) lostChip = true
              })
              .catch(() => {})
          }, 100)
          try {
            await inContext(browser, { viewport: DESKTOP, reader: 'student' }, async (student) => {
              const response = await write(student, draft, {
                _status: 'draft',
                review: { status: 'submitted' },
              })
              expect(response.ok(), await response.text()).toBe(true)
            })
            await expect.poll(() => totalOf(admin), { timeout: 5_000 }).toBe(before + 1)
            if (before + 1 <= SHOWN_CAP)
              await expect(chipOf(admin, 'en')).toHaveText(shownFor(before + 1, 'en'))
          } finally {
            clearInterval(watch)
          }
          expect(lostChip).toBe(false)
          expect(
            await admin.evaluate(
              () => (window as unknown as { noReloadMark?: boolean }).noReloadMark,
            ),
          ).toBe(true)
        })
      } finally {
        await payload.delete({
          collection: 'notifications',
          where: { link: { contains: submittedLink } },
          overrideAccess: true,
        })
      }
    })

    test("a second admin's number is right after a reload", async ({ browser }) => {
      const draft = fixture.needs.lists.articles.draft
      await inContext(browser, { viewport: DESKTOP, reader: 'admin' }, async (a) => {
        await inContext(browser, { viewport: DESKTOP, reader: 'secondAdmin' }, async (b) => {
          await a.goto(inboxPath('en'))
          await b.goto(inboxPath('en'))
          const before = await totalOf(b)
          const response = await write(a, draft, {
            _status: 'published',
            review: { status: 'approved', review_note: null },
          })
          expect(response.ok(), await response.text()).toBe(true)
          await b.reload()
          expect(await totalOf(b)).toBe(before - 1)
        })
      })
    })
  })
})
