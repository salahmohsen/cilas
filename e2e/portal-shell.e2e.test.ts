import { expect, test, type Browser, type Page } from '@playwright/test'
import { createTranslator } from 'next-intl'
import AxeBuilder from '@axe-core/playwright'
import Color from 'colorjs.io'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import { login } from '../testing/login.test-utils'
import { createTracker, uniq } from '../testing/payload.fixture'
import {
  EXPECTED_UNREAD,
  holdSpacesMode,
  inContext as inContextAt,
  LOCALES,
  localePath,
  MESSAGES,
  notifyOf,
  portalWorld,
  ROLES,
  WIDTHS,
  type Locale,
  type PortalRole,
  type PortalWorld,
  type RoomFixture,
  type StorageState,
} from '../testing/portal.fixture'
import {
  AXE_TAGS,
  axeOver,
  gotoLive,
  known,
  navHref,
  navName,
  NAV_BY_ROLE,
  openMore,
  PHONE,
  portalRoutes,
  ROUTE_SHAPES,
} from '../testing/portal-e2e.test-utils'
import { unreadCount } from '../src/lib/unread-count'

type Viewport = (typeof WIDTHS)[keyof typeof WIDTHS]

const OTHER = { en: 'ar', ar: 'en' } as const
const DESKTOP = WIDTHS.desktop
const BASE_BELL_PANEL_RULES = { 'label-content-name-mismatch': 12 } as const

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const spaceName = (room: RoomFixture, locale: Locale, unread: number) => {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Portal.nav' })
  const count =
    unread === 0
      ? ''
      : unreadCount(unread, locale, {
          some: (values) => t('unread', values),
          many: (values) => t('unreadMany', values),
        }).spoken
  return new RegExp(`^${escape(room.label[locale])}${escape(count)}$`)
}

const portalNavOf = (page: Page, locale: Locale) =>
  page.getByRole('navigation', { name: MESSAGES[locale].Portal.nav.label, exact: true })

const accountButton = (page: Page, locale: Locale) =>
  page
    .locator('[data-portal-rail]')
    .getByRole('button', { name: new RegExp(`^${MESSAGES[locale].Portal.account.label}, `) })

const toastRegion = (scope: Page | ReturnType<Page['getByRole']>, locale: Locale) =>
  scope.getByRole('region', { name: new RegExp(`^${MESSAGES[locale].Notifications.label}`) })

const { track, cleanup } = createTracker()
let payload: Payload
let world: PortalWorld
let spaces: Awaited<ReturnType<typeof holdSpacesMode>>
let baseURL: string | undefined
const states = {} as Record<PortalRole, StorageState>

const inContext = (
  browser: Browser,
  options: { viewport: Viewport; role: PortalRole },
  run: (page: Page) => Promise<void>,
) => inContextAt(browser, { baseURL, viewport: options.viewport, state: states[options.role] }, run)

test.describe('portal shell', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    baseURL = test.info().project.use.baseURL
    payload = await getPayload({ config, key: uniq('portal-shell') })
    spaces = await holdSpacesMode(payload)
    await spaces.set('on')
    world = await portalWorld(payload, track)
    for (const role of ROLES) {
      const context = await browser.newContext({ baseURL })
      try {
        await login({
          page: await context.newPage(),
          user: world.accounts[role],
          next: '/en/spaces',
        })
        states[role] = await context.storageState()
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

  test.describe('axe', () => {
    for (const viewport of Object.values(WIDTHS))
      for (const role of ROLES)
        for (const locale of LOCALES)
          ROUTE_SHAPES.forEach(([shape], index) =>
            test(`axe (${shape} ${role} ${locale} ${viewport.width})`, async ({ browser }) => {
              await inContext(browser, { viewport, role }, async (page) => {
                const route = portalRoutes(world, locale)[index]!
                await world.resetVisits()
                await page.goto(route)
                await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
                expect(
                  await axeOver(page, known(route, role, locale, viewport.width)),
                  shape,
                ).toEqual({})
              })
            }),
          )
  })
  for (const locale of LOCALES)
    for (const viewport of Object.values(WIDTHS))
      test(`a space page and a full post page have one main (${locale} ${viewport.width})`, async ({
        browser,
      }) => {
        await inContext(browser, { viewport, role: 'student' }, async (page) => {
          await page.goto(localePath(world.course.path, locale))
          await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
          await expect(page.getByRole('main')).toHaveCount(1)
          await page.goto(localePath(world.course.postPath, locale))
          await expect(page.getByRole('article').first()).toBeVisible()
          await expect(page.getByRole('main')).toHaveCount(1)
        })
      })

  test.describe('shell', () => {
    for (const role of ROLES)
      for (const locale of LOCALES) {
        const portal = MESSAGES[locale].Portal

        for (const viewport of Object.values(WIDTHS)) {
          const phone = viewport.width < 700
          const at = `${role} ${locale} ${viewport.width}`
          const spaceLinksOf = async (page: Page) =>
            phone ? await openMore(page, locale) : portalNavOf(page, locale)

          test(`landmarks, skip link and live region (${at})`, async ({ browser }) => {
            await world.resetVisits()
            await inContext(browser, { viewport, role }, async (page) => {
              for (const path of ['/en/spaces', world.course.path]) {
                await page.goto(localePath(path, locale))
                await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
                await page.keyboard.press('Tab')
                await expect(page.getByRole('link', { name: portal.shell.skip })).toBeFocused()
                await page.keyboard.press('Enter')
                await expect(page.locator('main > #main')).toBeFocused()
                await expect(page.getByRole('main')).toHaveCount(1)
                await expect(portalNavOf(page, locale)).toHaveCount(1)
                await expect(page.locator('header.site-header')).toHaveCount(0)
                await expect(
                  page.locator('[data-portal-rail]').getByRole('button', {
                    name: new RegExp(`^${MESSAGES[locale].Notifications.label}(,|،|$)`),
                  }),
                ).toHaveCount(1)
                await expect(page.locator('[data-portal-live][role="status"]')).toHaveCount(1)
              }
              await page.goto(localePath('/en/spaces', locale))
              await expect(
                portalNavOf(page, locale).getByRole('link', { name: portal.nav.home, exact: true }),
              ).toHaveAttribute('aria-current', 'page')
              await expect(page.locator('[data-portal-live]')).toHaveText('')
              expect(known(`/${locale}/spaces`, role, locale, viewport.width)).toEqual({})
            })
          })

          test(`nav per role (${at})`, async ({ browser }) => {
            await world.resetVisits()
            await inContext(browser, { viewport, role }, async (page) => {
              await page.goto(localePath('/en/spaces', locale))
              await expect(
                portalNavOf(page, locale).getByRole('link', { name: portal.nav.home, exact: true }),
              ).toHaveAttribute('aria-current', 'page')
              const expected = NAV_BY_ROLE[role].map((item) => ({
                href: navHref(item, locale),
                group: item.group,
              }))
              const itemsOf = (scope: ReturnType<Page['locator']>) =>
                scope.locator('[data-portal-item]').evaluateAll((links) =>
                  links.map((link) => ({
                    href: link.getAttribute('href'),
                    group: link.getAttribute('data-group'),
                  })),
                )
              expect(await itemsOf(portalNavOf(page, locale))).toEqual(
                phone ? expected.filter((item) => item.group === 'top') : expected,
              )
              const links = await spaceLinksOf(page)
              if (phone)
                expect(await itemsOf(links)).toEqual(
                  expected.filter((item) => item.group !== 'top'),
                )
              for (const room of ['course', 'otherCourse'] as const)
                await expect(
                  links.getByRole('link', {
                    name: spaceName(world[room], locale, EXPECTED_UNREAD[room]),
                  }),
                ).toBeVisible()
            })
          })

          test(`opening a space drops its count in this tab (${at})`, async ({ browser }) => {
            await world.resetVisits()
            await inContext(browser, { viewport, role }, async (page) => {
              await page.goto(localePath('/en/spaces', locale))
              await (
                await spaceLinksOf(page)
              )
                .getByRole('link', {
                  name: spaceName(world.otherCourse, locale, EXPECTED_UNREAD.otherCourse),
                })
                .click()
              await page.waitForURL(`**${localePath(world.otherCourse.path, locale)}`)
              const shownRow = async () =>
                (await spaceLinksOf(page)).getByRole('link', {
                  name: spaceName(world.otherCourse, locale, 0),
                })
              let row = await shownRow()
              await expect(row).toBeVisible()
              await expect(row.locator('[dir="ltr"]')).toHaveCount(0)
              await page.reload()
              row = await shownRow()
              await expect(row).toBeVisible()
              await expect(row.locator('[dir="ltr"]')).toHaveCount(0)
            })
          })

          test(`keyboard walk (${at})`, async ({ browser }) => {
            await inContext(browser, { viewport, role }, async (page) => {
              await page.goto(localePath('/en/spaces', locale))
              await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
              const stops: { tag: string; outline: string }[] = []
              for (let i = 0; i < 25; i++) {
                await page.keyboard.press('Tab')
                stops.push(
                  await page.evaluate(() => {
                    const el = document.activeElement!
                    return {
                      tag: el.tagName,
                      outline: getComputedStyle(el).outlineStyle,
                    }
                  }),
                )
              }
              const shown = stops.filter((stop) => !['NEXTJS-PORTAL', 'BODY'].includes(stop.tag))
              expect(shown.filter((stop) => stop.outline === 'none')).toEqual([])
              await page.goto(localePath('/en/spaces', locale))
              await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
              await page.keyboard.press('Tab')
              await page.keyboard.press('Enter')
              await page.keyboard.press('Tab')
              expect(
                await page.evaluate(() => {
                  const el = document.activeElement!
                  return {
                    inMain: el.closest('main') !== null,
                    outline: getComputedStyle(el).outlineStyle,
                  }
                }),
              ).toEqual({ inMain: true, outline: expect.not.stringMatching(/^none$/) })
              const home = portalNavOf(page, locale).getByRole('link', {
                name: portal.nav.home,
                exact: true,
              })
              await home.click()
              await expect(home).toBeFocused()
              expect(await home.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none')
            })
          })
        }

        test(`every nav item and account row opens a page (${role} ${locale} 1440)`, async ({
          browser,
        }) => {
          const other = OTHER[locale]
          await inContextAt(browser, { baseURL, viewport: DESKTOP }, async (page) => {
            await login({
              page,
              user: world.accounts[role],
              next: localePath('/en/spaces', locale),
            })
            const items = portalNavOf(page, locale).locator('[data-portal-item]')
            const hrefs = await items.evaluateAll((links) =>
              links.map((link) => link.getAttribute('href')!),
            )
            expect(hrefs).toEqual(NAV_BY_ROLE[role].map((item) => navHref(item, locale)))
            for (const href of hrefs) expect((await page.request.get(href)).status()).toBe(200)
            const labels = NAV_BY_ROLE[role].map(
              (item) => portal.nav[item.key as keyof typeof portal.nav],
            )
            const fold = page.locator('[data-portal-crumbs] [data-portal-fold]')
            await fold.click()
            await expect(fold).toHaveAttribute('aria-expanded', 'false')
            for (const label of labels)
              await expect(
                portalNavOf(page, locale).getByRole('link', { name: navName(label) }),
              ).toHaveCount(1)
            await fold.click()
            await expect(fold).toHaveAttribute('aria-expanded', 'true')

            const account = accountButton(page, locale)
            await expect(account).toHaveAttribute('aria-haspopup', 'menu')
            await account.click()
            await expect(account).toHaveAttribute('aria-expanded', 'true')
            await page.getByRole('menuitem', { name: portal.account.profile }).click()
            await page.waitForURL(`**/${locale}/spaces/account`)

            await page.goto(localePath('/en/spaces', locale))
            await accountButton(page, locale).click()
            await page
              .getByRole('menuitem', { name: MESSAGES[locale].Language.switchToLabel })
              .click()
            await page.waitForURL(`**/${other}/spaces`)
            await expect(page.locator('html')).toHaveAttribute('lang', other)

            await accountButton(page, other).click()
            await page
              .getByRole('menuitemradio', { name: MESSAGES[other].Portal.account.themes.dark })
              .click()
            await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

            await page.keyboard.press('Escape')
            await accountButton(page, other).click()
            await page
              .getByRole('menuitem', { name: MESSAGES[other].Portal.account.signOut })
              .click()
            await page.waitForURL(`**/${other}/login**`)
          })
        })
      }
  })

  test.describe('list nav landing', () => {
    const H1 = {
      articles: { admin: 'allArticles', fellow: 'myArticles', student: 'myArticles' },
      courses: { admin: 'allCourses', fellow: 'myCourses', student: null },
    } as const
    for (const role of ROLES)
      for (const locale of LOCALES)
        for (const viewport of Object.values(WIDTHS)) {
          const portal = MESSAGES[locale].Portal
          for (const item of NAV_BY_ROLE[role].filter(
            (row) => row.key === 'articles' || row.key === 'courses',
          )) {
            const key = item.key as 'articles' | 'courses'
            const h1 = H1[key][role]
            test(`the ${key} item lands on its page (${role} ${locale} ${viewport.width})`, async ({
              browser,
            }) => {
              await inContext(browser, { viewport, role }, async (page) => {
                await page.goto(localePath('/en/spaces', locale))
                const scope =
                  viewport.width < 700 ? await openMore(page, locale) : portalNavOf(page, locale)
                await scope.getByRole('link', { name: navName(portal.nav[key]) }).click()
                await page.waitForURL(`**/${locale}${item.href}`)
                expect(h1).not.toBeNull()
                await expect(page.getByRole('heading', { level: 1 })).toHaveText(portal.lists[h1!])
              })
            })
          }
        }
  })

  test.describe('calendar nav landing', () => {
    for (const role of ROLES)
      for (const locale of LOCALES)
        for (const viewport of Object.values(WIDTHS))
          test(`the Calendar item lands on its page (${role} ${locale} ${viewport.width})`, async ({
            browser,
          }) => {
            await inContext(browser, { viewport, role }, async (page) => {
              const portal = MESSAGES[locale].Portal
              await page.goto(localePath('/en/spaces', locale))
              const nav = portalNavOf(page, locale)
              await nav.getByRole('link', { name: portal.nav.calendar, exact: true }).click()
              await page.waitForURL(`**/${locale}/spaces/calendar`)
              await expect(page.getByRole('heading', { level: 1 })).toHaveText(
                MESSAGES[locale].Calendar.title,
              )
              await expect(
                nav.getByRole('link', { name: portal.nav.calendar, exact: true }),
              ).toHaveAttribute('aria-current', 'page')
              await expect(
                nav.getByRole('link', { name: portal.nav.home, exact: true }),
              ).not.toHaveAttribute('aria-current', 'page')
            })
          })
  })

  test.describe('fold (1440)', () => {
    const PAIRS = [
      ['admin', 'fellow'],
      ['fellow', 'student'],
      ['student', 'admin'],
    ] as const

    const foldButton = (page: Page, locale: Locale) =>
      page.getByRole('button', { name: MESSAGES[locale].Portal.nav.sidebar })

    const signOutHere = async (page: Page, locale: Locale) => {
      await accountButton(page, locale).click()
      await page.getByRole('menuitem', { name: MESSAGES[locale].Portal.account.signOut }).click()
      await page.waitForURL(`**/${locale}/login**`)
    }

    for (const locale of LOCALES)
      for (const [first, second] of PAIRS)
        test(`the folded state belongs to the account (${first} then ${second}, ${locale})`, async ({
          browser,
        }) => {
          const spacesPath = localePath('/en/spaces', locale)
          await inContextAt(browser, { baseURL, viewport: DESKTOP }, async (page) => {
            await login({ page, user: world.accounts[first], next: spacesPath })
            await foldButton(page, locale).click()
            await expect(foldButton(page, locale)).toHaveAttribute('aria-expanded', 'false')
            await page.reload()
            await expect(foldButton(page, locale)).toHaveAttribute('aria-expanded', 'false')
            await signOutHere(page, locale)

            await login({ page, user: world.accounts[second], next: spacesPath })
            await expect(foldButton(page, locale)).toHaveAttribute('aria-expanded', 'true')
            await signOutHere(page, locale)

            await login({ page, user: world.accounts[first], next: spacesPath })
            await expect(foldButton(page, locale)).toHaveAttribute('aria-expanded', 'false')
          })
        })

    test('reduced motion: the fold does not animate (en, fellow)', async ({ browser }) => {
      const context = await browser.newContext({
        baseURL,
        viewport: DESKTOP,
        storageState: states.fellow,
        reducedMotion: 'reduce',
      })
      try {
        const page = await context.newPage()
        await page.goto('/en/spaces')
        await expect(foldButton(page, 'en')).toHaveAttribute('aria-expanded', 'true')
        expect(
          await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--portal-duration'),
          ),
        ).toMatch(/^\s*0m?s\s*$/)
        await foldButton(page, 'en').click()
        await expect(foldButton(page, 'en')).toHaveAttribute('aria-expanded', 'false')
        expect(
          await page
            .locator('[data-portal-rail]')
            .evaluate((rail) => rail.getAnimations({ subtree: true }).length),
        ).toBe(0)
      } finally {
        await context.close()
      }
    })
  })

  test.describe('fold trigger (1440)', () => {
    const foldIn = (page: Page, locale: Locale) =>
      page
        .locator('[data-portal-crumbs]')
        .getByRole('button', { name: MESSAGES[locale].Portal.nav.sidebar, exact: true })
    const foldCookie = async (page: Page) =>
      (await page.context().cookies()).some(
        (cookie) => cookie.name === `portal-folded-${world.accounts.fellow.id}`,
      )
    const live = (page: Page) => page.locator('[data-portal-live]')
    const focusMain = (page: Page) => page.locator('main > #main').focus()

    for (const locale of LOCALES) {
      const portal = MESSAGES[locale].Portal

      test(`the trigger is at the inline start of the header row (${locale})`, async ({
        browser,
      }) => {
        await inContext(browser, { viewport: DESKTOP, role: 'fellow' }, async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          const button = foldIn(page, locale)
          await expect(button).toHaveCount(1)
          await expect(page.locator('[data-portal-rail] [data-portal-fold]')).toHaveCount(0)
          expect(
            await page
              .locator('main')
              .evaluate((main) => main.firstElementChild?.hasAttribute('data-portal-crumbs')),
          ).toBe(true)
          await expect(button).toHaveAttribute('aria-expanded', 'true')
          await expect(button).toHaveAttribute('aria-keyshortcuts', '[')
          const target = await button.getAttribute('aria-controls')
          expect(
            await page.evaluate(
              (id) => document.querySelector('[data-portal-rail] nav')?.id === id,
              target,
            ),
          ).toBe(true)
          const row = (await page.locator('[data-portal-crumbs]').boundingBox())!
          const box = (await button.boundingBox())!
          if (locale === 'en') expect(Math.abs(box.x - row.x)).toBeLessThanOrEqual(1)
          else expect(Math.abs(box.x + box.width - (row.x + row.width))).toBeLessThanOrEqual(1)
          const offset = async () =>
            page.evaluate((rtl) => {
              const main = document.querySelector('main')!.getBoundingClientRect()
              const fold = document
                .querySelector('[data-portal-crumbs] [data-portal-fold]')!
                .getBoundingClientRect()
              return rtl ? main.right - fold.right : fold.left - main.left
            }, locale === 'ar')
          const open = await offset()
          await button.click()
          await expect(button).toHaveAttribute('aria-expanded', 'false')
          expect(Math.abs((await offset()) - open)).toBeLessThanOrEqual(1)
          await page.setViewportSize(PHONE)
          await expect(page.locator('[data-portal-crumbs]')).toBeHidden()
          await expect(button).toBeHidden()
        })
      })

      test(`[ folds from the main and not from an input (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: DESKTOP, role: 'fellow' }, async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          const button = foldIn(page, locale)
          await focusMain(page)
          await page.keyboard.press('BracketLeft')
          await expect(button).toHaveAttribute('aria-expanded', 'false')
          expect(await foldCookie(page)).toBe(true)
          await page.keyboard.press('BracketLeft')
          await expect(button).toHaveAttribute('aria-expanded', 'true')
          expect(await foldCookie(page)).toBe(false)
          await page.locator('main > #main').evaluate((main) => {
            main.insertAdjacentHTML(
              'afterbegin',
              '<input aria-label="probe" data-probe><div contenteditable="true" data-probe>x</div>',
            )
          })
          for (const probe of await page.locator('[data-probe]').all()) {
            await probe.focus()
            await page.keyboard.press('BracketLeft')
            await expect(button).toHaveAttribute('aria-expanded', 'true')
          }
          await accountButton(page, locale).click()
          await expect(page.getByRole('menu')).toBeVisible()
          await page.keyboard.press('BracketLeft')
          await expect(button).toHaveAttribute('aria-expanded', 'true')
          await page.keyboard.press('Escape')
          await expect(page.getByRole('menu')).toHaveCount(0)
          await page.evaluate(() => {
            document.body.insertAdjacentHTML(
              'beforeend',
              '<dialog open data-probe-dialog><button>x</button></dialog>',
            )
          })
          await focusMain(page)
          await page.keyboard.press('BracketLeft')
          await expect(button).toHaveAttribute('aria-expanded', 'true')
          await page.evaluate(() => document.querySelector('[data-probe-dialog]')?.remove())
          await portalNavOf(page, locale)
            .getByRole('link', { name: portal.nav.home, exact: true })
            .focus()
          await page.keyboard.press('BracketLeft')
          await expect(button).toHaveAttribute('aria-expanded', 'false')
        })
      })

      test(`the key announces, the click does not (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: DESKTOP, role: 'fellow' }, async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          await focusMain(page)
          await page.keyboard.press('BracketLeft')
          await expect(live(page)).toHaveText(portal.fold.folded)
          await page.keyboard.press('BracketLeft')
          await expect(live(page)).toHaveText(portal.fold.unfolded)
        })
        await inContext(browser, { viewport: DESKTOP, role: 'fellow' }, async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          const button = foldIn(page, locale)
          await button.click()
          await expect(button).toHaveAttribute('aria-expanded', 'false')
          await expect(live(page)).toHaveText('')
          await button.click()
          await expect(button).toHaveAttribute('aria-expanded', 'true')
        })
      })

      test(`the key does nothing at 390 (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: PHONE, role: 'fellow' }, async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
          await focusMain(page)
          await page.keyboard.press('BracketLeft')
          expect(await foldCookie(page)).toBe(false)
          await expect(live(page)).toHaveText('')
        })
      })

      test(`the skip link lands below the crumbs row (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: DESKTOP, role: 'fellow' }, async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
          await page.keyboard.press('Tab')
          await expect(page.getByRole('link', { name: portal.shell.skip })).toBeFocused()
          await page.keyboard.press('Enter')
          await expect(page.locator('main > #main')).toBeFocused()
          expect(
            await page
              .locator('main > #main')
              .evaluate((el) => el.previousElementSibling?.hasAttribute('data-portal-crumbs')),
          ).toBe(true)
          await page.keyboard.press('Tab')
          expect(
            await page.evaluate(() => document.activeElement?.hasAttribute('data-portal-fold')),
          ).toBe(false)
        })
      })

      test(`the shortcut turns off (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: DESKTOP, role: 'fellow' }, async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          const button = foldIn(page, locale)
          const item = (name: string) => page.getByRole('menuitem', { name, exact: true })
          await accountButton(page, locale).click()
          await item(portal.account.shortcutOff).click()
          await expect(live(page)).toHaveText(portal.fold.shortcutIsOff)
          await expect(page.getByRole('menu')).toHaveCount(0)
          await focusMain(page)
          await page.keyboard.press('BracketLeft')
          await expect(button).toHaveAttribute('aria-expanded', 'true')
          await accountButton(page, locale).click()
          await expect(item(portal.account.shortcutOn)).toBeVisible()
          await page.keyboard.press('Escape')
          await expect(page.getByRole('menu')).toHaveCount(0)
          await page.reload()
          await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
          await focusMain(page)
          await page.keyboard.press('BracketLeft')
          await expect(button).toHaveAttribute('aria-expanded', 'true')
          await accountButton(page, locale).click()
          await item(portal.account.shortcutOn).click()
          await expect(live(page)).toHaveText(portal.fold.shortcutIsOn)
          await expect(page.getByRole('menu')).toHaveCount(0)
          await focusMain(page)
          await page.keyboard.press('BracketLeft')
          await expect(button).toHaveAttribute('aria-expanded', 'false')
        })
      })
    }
  })

  test.describe('rail scroll', () => {
    const SHORT = { ...DESKTOP, height: 320 }
    const inShort = (browser: Browser, role: PortalRole, run: (page: Page) => Promise<void>) =>
      inContextAt(browser, { baseURL, viewport: SHORT, state: states[role] }, run)
    const region = (page: Page, locale: Locale) =>
      page.getByRole('region', { name: MESSAGES[locale].Portal.nav.scroll, exact: true })
    const track = (page: Page) => page.locator('[data-portal-rail] [data-axis="y"]')
    const metrics = (page: Page, locale: Locale) =>
      region(page, locale).evaluate((el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }))
    const boxOf = async (locator: ReturnType<Page['locator']>) => {
      const box = await locator.boundingBox()
      return box && { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width) }
    }
    const inside = (
      inner: { x: number; y: number; width: number; height: number },
      outer: { x: number; y: number; width: number; height: number },
    ) =>
      inner.x >= outer.x - 1 &&
      inner.y >= outer.y - 1 &&
      inner.x + inner.width <= outer.x + outer.width + 1 &&
      inner.y + inner.height <= outer.y + outer.height + 1
    const foldIn = (page: Page, locale: Locale) =>
      page
        .locator('[data-portal-crumbs]')
        .getByRole('button', { name: MESSAGES[locale].Portal.nav.sidebar, exact: true })
    const bell = (page: Page, locale: Locale) =>
      page.getByRole('button', {
        name: new RegExp(`^${MESSAGES[locale].Notifications.label}(,|،|$)`),
      })

    for (const locale of LOCALES) {
      test(`the spaces scroll inside the rail (${locale})`, async ({ browser }) => {
        await inShort(browser, 'fellow', async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          await expect(accountButton(page, locale)).toBeVisible()
          for (const folded of [false, true]) {
            if (folded) {
              await foldIn(page, locale).click()
              await expect(foldIn(page, locale)).toHaveAttribute('aria-expanded', 'false')
              await expect
                .poll(() =>
                  page
                    .locator('[data-portal-rail]')
                    .evaluate((rail) => rail.getAnimations({ subtree: true }).length),
                )
                .toBe(0)
              await region(page, locale).evaluate((el) => el.scrollTo({ top: 0 }))
            }
            const before = await metrics(page, locale)
            expect(before.scrollHeight).toBeGreaterThan(before.clientHeight)
            expect(
              await page
                .locator('[data-portal-rail]')
                .evaluate((rail) => rail.scrollHeight === rail.clientHeight),
            ).toBe(true)
            const fixed = [
              page.locator('[data-portal-rail] header a').first(),
              bell(page, locale),
              accountButton(page, locale),
            ]
            const boxes = await Promise.all(fixed.map(boxOf))
            const scrollY = await page.evaluate(() => window.scrollY)
            await region(page, locale).hover()
            await page.mouse.wheel(0, 2000)
            await expect
              .poll(async () => (await metrics(page, locale)).scrollTop)
              .toBeGreaterThan(0)
            expect(await Promise.all(fixed.map(boxOf))).toEqual(boxes)
            expect(await page.evaluate(() => window.scrollY)).toBe(scrollY)
            await expect
              .poll(async () => {
                const rows = region(page, locale).getByRole('link')
                const last = (await rows.last().boundingBox())!
                return inside(last, (await region(page, locale).boundingBox())!)
              })
              .toBe(true)
          }
        })
      })

      test(`keyboard (${locale})`, async ({ browser }) => {
        await inShort(browser, 'fellow', async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          await accountButton(page, locale).focus()
          await page.keyboard.press('Tab')
          await expect(region(page, locale)).toBeFocused()
          const scrolledPast = async (from: number) => {
            let last = -1
            await expect
              .poll(async () => {
                const now = (await metrics(page, locale)).scrollTop
                const settled = now === last && now > from
                last = now
                return settled
              })
              .toBe(true)
            return last
          }
          await page.keyboard.press('ArrowDown')
          const afterArrow = await scrolledPast(0)
          await page.keyboard.press('PageDown')
          await scrolledPast(afterArrow)
          await page.keyboard.press('Tab')
          const rows = region(page, locale).getByRole('link')
          await expect(rows.first()).toBeFocused()
          const count = await rows.count()
          for (let i = 1; i < count; i++) await page.keyboard.press('Tab')
          await expect(rows.last()).toBeFocused()
          await expect
            .poll(async () =>
              inside(
                (await rows.last().boundingBox())!,
                (await region(page, locale).boundingBox())!,
              ),
            )
            .toBe(true)
          expect(await rows.last().evaluate((el) => getComputedStyle(el).outlineOffset)).toBe(
            '-2px',
          )
          const room = await region(page, locale).evaluate((el) =>
            parseFloat(getComputedStyle(el).paddingBlockEnd),
          )
          expect(room).toBeGreaterThan(0)
          const measure = () =>
            page.evaluate((name) => {
              const viewport = [...document.querySelectorAll('[role="region"]')].find(
                (el) => el.getAttribute('aria-label') === name,
              )!
              const active = document.activeElement!
              const row = active.getBoundingClientRect()
              const box = viewport.getBoundingClientRect()
              const style = getComputedStyle(viewport)
              return {
                start: row.top - box.top,
                end: box.bottom - row.bottom,
                active: active.textContent,
                inside: viewport.contains(active),
                scrollTop: viewport.scrollTop,
                clientHeight: viewport.clientHeight,
                scrollHeight: viewport.scrollHeight,
                padding: [style.scrollPaddingTop, style.scrollPaddingBottom],
                toast: getComputedStyle(document.documentElement).getPropertyValue(
                  '--toast-stack-height',
                ),
              }
            }, MESSAGES[locale].Portal.nav.scroll)
          const roomAt = async (edge: 'start' | 'end') => {
            const state = await measure()
            return state[edge] >= room - 1 ? 'ok' : JSON.stringify(state)
          }
          await expect.poll(() => roomAt('end')).toBe('ok')
          for (let i = 1; i < count; i++) await page.keyboard.press('Shift+Tab')
          await expect(rows.first()).toBeFocused()
          await expect.poll(() => roomAt('start')).toBe('ok')
        })
      })

      test(`scroll padding stays (${locale})`, async ({ browser }) => {
        await inContextAt(
          browser,
          { baseURL, viewport: PHONE, state: states.fellow },
          async (page) => {
            await page.goto(localePath('/en/spaces', locale))
            await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
            expect(
              await page.evaluate(() =>
                parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom),
              ),
            ).toBeGreaterThanOrEqual(64)
            await expect(region(page, locale)).toBeHidden()
          },
        )
        await inShort(browser, 'fellow', async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          const rail = region(page, locale)
          for (const toast of [120, 4000]) {
            const { used, scrollport } = await rail.evaluate((el, px) => {
              const viewport = el as HTMLElement
              viewport.style.setProperty('--toast-stack-height', `${px}px`)
              const probe = document.createElement('div')
              probe.style.cssText = `position:absolute;visibility:hidden;inline-size:1px;block-size:${getComputedStyle(el).scrollPaddingBottom}`
              el.parentElement!.append(probe)
              const height = probe.getBoundingClientRect().height
              probe.remove()
              viewport.style.removeProperty('--toast-stack-height')
              return { used: height, scrollport: el.clientHeight }
            }, toast)
            expect(used).toBeCloseTo(Math.min(Math.max(8, toast), scrollport / 2), 0)
          }
        })
      })

      test(`the bar sits at the inline end (${locale})`, async ({ browser }) => {
        await inShort(browser, 'fellow', async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          for (const folded of [false, true]) {
            if (folded) await foldIn(page, locale).click()
            await expect(track(page)).toBeVisible()
            await expect
              .poll(async () => {
                const bar = (await track(page).boundingBox())!
                const view = (await region(page, locale).boundingBox())!
                const rail = (await page.locator('[data-portal-rail]').boundingBox())!
                const right = bar.x + bar.width / 2 > view.x + view.width / 2
                return { atEnd: locale === 'en' ? right : !right, inRail: inside(bar, rail) }
              })
              .toEqual({ atEnd: true, inRail: true })
          }
        })
      })
    }

    test('reduced motion (en)', async ({ browser }) => {
      await inShort(browser, 'fellow', async (page) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto('/en/spaces')
        expect(
          await track(page).evaluate((el) => {
            const style = getComputedStyle(el)
            return (
              style.transitionProperty === 'none' ||
              style.transitionDuration.split(',').every((d) => parseFloat(d) === 0)
            )
          }),
        ).toBe(true)
        expect(await region(page, 'en').evaluate((el) => getComputedStyle(el).scrollBehavior)).toBe(
          'auto',
        )
        const bar = (await track(page).boundingBox())!
        const before = await metrics(page, 'en')
        const target = Math.min(
          before.scrollHeight - before.clientHeight,
          before.scrollTop + before.clientHeight * 0.9,
        )
        expect(target).toBeGreaterThan(before.scrollTop)
        await page.mouse.click(bar.x + bar.width / 2, bar.y + bar.height - 4)
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)))
        const after = await metrics(page, 'en')
        expect(Math.abs(after.scrollTop - target)).toBeLessThanOrEqual(1)
      })
    })

    test('forced colours and more contrast (en)', async ({ browser }) => {
      await inShort(browser, 'fellow', async (page) => {
        await page.goto('/en/spaces')
        const thumbColour = () =>
          track(page)
            .locator('> *')
            .evaluate((thumb) => getComputedStyle(thumb, '::after').backgroundColor)
        const shellColour = await page
          .locator('[data-portal-shell]')
          .evaluate((el) => getComputedStyle(el).backgroundColor)
        const opaque = (colour: string) => new Color(colour).alpha === 1

        await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
        await region(page, 'en').hover()
        await expect.poll(async () => opaque(await thumbColour())).toBe(true)
        const forced = await thumbColour()
        expect(forced).not.toBe(shellColour)
        await track(page).locator('> *').hover()
        await expect.poll(thumbColour).toBe(forced)

        await page.emulateMedia({ forcedColors: 'none', contrast: 'more', reducedMotion: 'reduce' })
        const foreground = await page.evaluate(() => {
          const probe = document.createElement('span')
          probe.style.color = 'var(--foreground)'
          document.body.append(probe)
          const colour = getComputedStyle(probe).color
          probe.remove()
          return colour
        })
        await region(page, 'en').hover()
        await expect.poll(thumbColour).toBe(foreground)
        await track(page).locator('> *').hover()
        await expect.poll(thumbColour).toBe(foreground)
      })
    })

    test('touch momentum, by structure (en)', async ({ browser }) => {
      await inShort(browser, 'fellow', async (page) => {
        await page.goto('/en/spaces')
        expect(
          await region(page, 'en').evaluate((el) => {
            const style = getComputedStyle(el)
            const content = el.firstElementChild
            return {
              overflowY: style.overflowY,
              touchAction: style.touchAction,
              transform: content ? getComputedStyle(content).transform : 'none',
            }
          }),
        ).toEqual({ overflowY: 'auto', touchAction: 'auto', transform: 'none' })
      })
    })

    for (const where of ['portal', 'site'] as const)
      test(`the bell list scrolls inside its panel (${where}, en)`, async ({ browser }) => {
        const student = world.accounts.student
        const made: number[] = []
        try {
          for (let i = 0; i < 12; i++) {
            const doc = await payload.create({
              collection: 'notifications',
              data: {
                recipient: student.id,
                kind: 'comment',
                title: `E2E scroll ${i}`,
                link: '/en',
              },
              overrideAccess: true,
            })
            made.push(doc.id)
          }
          await inShort(browser, 'student', async (page) => {
            await gotoLive(page, where === 'portal' ? '/en/spaces' : '/en')
            await bell(page, 'en').first().click()
            const list = page.getByRole('region', {
              name: MESSAGES.en.Notifications.allNotifications,
              exact: true,
            })
            await expect(list).toBeVisible()
            const header = page.getByRole('button', {
              name: MESSAGES.en.Notifications.close,
              exact: true,
            })
            let lastBox = ''
            await expect
              .poll(async () => {
                const now = JSON.stringify(await boxOf(header))
                const still = now === lastBox
                lastBox = now
                return still
              })
              .toBe(true)
            const headerBox = JSON.parse(lastBox)
            const size = await list.evaluate((el) => [el.scrollHeight, el.clientHeight])
            expect(size[0]).toBeGreaterThan(size[1]!)
            await list.hover()
            await page.mouse.wheel(0, 1000)
            await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
            expect(await boxOf(header)).toEqual(headerBox)
            if (where === 'site') {
              const { violations } = await new AxeBuilder({ page })
                .withTags(AXE_TAGS)
                .include('[role="dialog"]')
                .analyze()
              const allowed: Record<string, number> = BASE_BELL_PANEL_RULES
              expect(
                Object.fromEntries(
                  violations
                    .filter((v) => v.nodes.length > (allowed[v.id] ?? 0))
                    .map((v) => [v.id, v.nodes.map((node) => node.target.join(' '))]),
                ),
              ).toEqual({})
            }
          })
        } finally {
          await payload.delete({
            collection: 'notifications',
            where: { id: { in: made } },
            overrideAccess: true,
          })
        }
      })
  })

  test.describe('bottom bar and More sheet (390)', () => {
    for (const role of ROLES)
      for (const locale of LOCALES) {
        const portal = MESSAGES[locale].Portal

        test(`the More sheet is modal (${role} ${locale})`, async ({ browser }) => {
          await inContext(browser, { viewport: PHONE, role }, async (page) => {
            await page.goto(localePath('/en/spaces', locale))
            const mainLink = page.locator('main a').first()
            const point = await mainLink.boundingBox()
            const sheet = await openMore(page, locale)
            expect(
              await page
                .locator('main')
                .evaluate((main) => main.closest('[inert], [aria-hidden="true"]') !== null),
            ).toBe(true)
            for (let i = 0; i < 20; i++) {
              await page.keyboard.press('Tab')
              expect(
                await sheet.evaluate((dialog) => dialog.contains(document.activeElement)),
              ).toBe(true)
            }
            expect(
              await page.evaluate(
                ({ x, y }) => document.elementFromPoint(x, y)?.closest('main') == null,
                { x: point!.x + point!.width / 2, y: point!.y + point!.height / 2 },
              ),
            ).toBe(true)
            await page.keyboard.press('Escape')
            await expect(sheet).toHaveCount(0)
            await expect(
              page.getByRole('button', { name: portal.nav.more, exact: true }),
            ).toBeFocused()
          })
        })

        test(`a toast in the open More sheet is above it, read and reachable (${role} ${locale})`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport: PHONE, role }, async (page) => {
            await gotoLive(page, localePath('/en/spaces', locale))
            const sheet = await openMore(page, locale)
            await notifyOf(payload, world.accounts[role], localePath(world.course.postPath, locale))
            const region = toastRegion(sheet, locale)
            await expect(region.getByText('E2E comment')).toBeVisible()
            const action = region.getByRole('button', { name: MESSAGES[locale].Notifications.open })
            await expect
              .poll(async () => {
                const box = (await action.boundingBox())!
                return box.y >= 0 && box.y + box.height <= PHONE.height
              })
              .toBe(true)
            let reached = false
            for (let i = 0; i < 30 && !reached; i++) {
              await page.keyboard.press(i === 0 ? 'Tab' : 'Shift+Tab')
              reached = await action.evaluate((button) => button === document.activeElement)
            }
            await expect(action).toBeFocused()
          })
        })

        test(`a focused row stays above the toast and the bottom bar (${role} ${locale})`, async ({
          browser,
        }) => {
          const short = { width: 390, height: 560 }
          await inContextAt(
            browser,
            { baseURL, viewport: short, state: states[role] },
            async (page) => {
              await gotoLive(page, localePath('/en/spaces', locale))
              expect(
                await page.evaluate(
                  () => document.documentElement.scrollHeight > window.innerHeight,
                ),
              ).toBe(true)
              await notifyOf(
                payload,
                world.accounts[role],
                localePath(world.course.postPath, locale),
              )
              const toast = toastRegion(page, locale).getByText('E2E comment')
              await expect(toast).toBeVisible()
              const last = page.locator('main section[data-latest] a').last()
              let focused = false
              for (let i = 0; i < 80 && !focused; i++) {
                await page.keyboard.press('Tab')
                focused = await last.evaluate((link) => link === document.activeElement)
              }
              await expect(last).toBeFocused()
              const toastItem = toastRegion(page, locale)
                .locator('li')
                .filter({ hasText: 'E2E comment' })
                .first()
              const measure = async () => {
                const toastTop = (await toastItem.boundingBox())!.y
                return page.evaluate((toastTop) => {
                  const row = document.activeElement!.getBoundingClientRect()
                  const bar = document
                    .querySelector('nav [aria-haspopup="dialog"]')!
                    .closest('nav')!
                    .getBoundingClientRect()
                  const root = getComputedStyle(document.documentElement)
                  return {
                    rowBottom: row.bottom,
                    limit: Math.min(toastTop, bar.top),
                    padding: parseFloat(root.scrollPaddingBlockEnd),
                    needed:
                      bar.height + parseFloat(root.getPropertyValue('--toast-stack-height') || '0'),
                  }
                }, toastTop)
              }
              await expect(toast).toBeVisible()
              await expect
                .poll(async () => {
                  const { rowBottom, limit } = await measure()
                  return rowBottom <= limit
                })
                .toBe(true)
              const measured = await measure()
              expect(measured.padding).toBeGreaterThanOrEqual(measured.needed)
            },
          )
        })

        test(`every account row in the More sheet opens a page (${role} ${locale})`, async ({
          browser,
        }) => {
          const other = OTHER[locale]
          await inContextAt(browser, { baseURL, viewport: PHONE }, async (page) => {
            await login({
              page,
              user: world.accounts[role],
              next: localePath('/en/spaces', locale),
            })
            let sheet = await openMore(page, locale)
            await sheet.getByRole('link', { name: portal.account.profile }).click()
            await page.waitForURL(`**/${locale}/spaces/account`)

            await page.goto(localePath('/en/spaces', locale))
            sheet = await openMore(page, locale)
            await sheet
              .getByRole('link', { name: MESSAGES[locale].Language[other], exact: true })
              .click()
            await page.waitForURL(`**/${other}/spaces`)
            await expect(page.locator('html')).toHaveAttribute('lang', other)

            sheet = await openMore(page, other)
            await sheet.getByRole('button', { name: MESSAGES[other].Theme.dark }).click()
            await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

            await sheet
              .getByRole('button', { name: MESSAGES[other].Portal.account.signOut })
              .click()
            await page.waitForURL(`**/${other}/login**`)
          })
        })

        test(`a toast survives Profile and settings (${role} ${locale})`, async ({ browser }) => {
          await inContext(browser, { viewport: PHONE, role }, async (page) => {
            await page.goto(localePath('/en/spaces/account', locale))
            await gotoLive(page, localePath('/en/spaces', locale))
            const sheet = await openMore(page, locale)
            await notifyOf(payload, world.accounts[role], localePath(world.course.postPath, locale))
            await expect(toastRegion(sheet, locale).getByText('E2E comment')).toBeVisible()
            await sheet.getByRole('link', { name: portal.account.profile }).click()
            await page.waitForURL(`**/${locale}/spaces/account`)
            await expect(toastRegion(page, locale).getByText('E2E comment')).toBeVisible()
          })
        })

        test(`reduced motion opens the sheet at once (${role} ${locale})`, async ({ browser }) => {
          const context = await browser.newContext({
            baseURL,
            viewport: PHONE,
            storageState: states[role],
            reducedMotion: 'reduce',
          })
          try {
            const page = await context.newPage()
            await page.goto(localePath('/en/spaces', locale))
            const more = page.getByRole('button', { name: portal.nav.more, exact: true })
            const sheet = page.getByRole('dialog', { name: portal.nav.more, exact: true })
            await more.click()
            await expect(sheet).toBeVisible()
            await page.keyboard.press('Escape')
            await expect(sheet).toHaveCount(0)
            await more.click()
            await expect(sheet).toBeVisible({ timeout: 100 })
            expect(
              await sheet.evaluate((dialog) => dialog.getAnimations({ subtree: true }).length),
            ).toBe(0)
          } finally {
            await context.close()
          }
        })
      }
  })

  test.describe('empty state', () => {
    for (const role of ['fellow', 'student'] as const)
      for (const locale of LOCALES)
        for (const viewport of Object.values(WIDTHS))
          test(`a reader with no space sees the empty state (${role} ${locale} ${viewport.width})`, async ({
            browser,
          }) => {
            const home = MESSAGES[locale].Portal.home
            await spaces.set('trial', { trialCommunity: false })
            try {
              await inContextAt(browser, { baseURL, viewport }, async (page) => {
                await login({
                  page,
                  user: world.loners[role],
                  next: localePath('/en/spaces', locale),
                })
                await expect(
                  page.getByRole('heading', { level: 2, name: home.spaces }),
                ).toBeVisible()
                await expect(page.getByText(home.noSpaces)).toBeVisible()
              })
            } finally {
              await spaces.set('on')
            }
          })
  })

  test.describe('reflow, mirror and targets', () => {
    const noSideScroll = (page: Page) =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

    for (const role of ROLES)
      for (const locale of LOCALES)
        test(`reflow (${role} ${locale})`, async ({ browser }) => {
          const widths = locale === 'ar' ? [320, 390, 720] : [320, 720]
          for (const width of widths)
            await inContextAt(
              browser,
              { baseURL, viewport: { width, height: 800 }, state: states[role] },
              async (page) => {
                for (const path of ['/en/spaces', world.course.path]) {
                  await page.goto(localePath(path, locale))
                  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
                  expect(await noSideScroll(page), `${path} at ${width}`).toBe(true)
                  const other = page.locator(
                    `a[href="${localePath(world.otherCourse.path, locale)}"]`,
                  )
                  if (width < 700) {
                    const sheet = await openMore(page, locale)
                    await expect(sheet.locator(other)).toBeVisible()
                    await page.keyboard.press('Escape')
                    continue
                  }
                  const nav = portalNavOf(page, locale)
                  await expect(nav.locator(other)).toBeVisible()
                  const fold = page.getByRole('button', {
                    name: MESSAGES[locale].Portal.nav.sidebar,
                  })
                  await fold.click()
                  await expect(fold).toHaveAttribute('aria-expanded', 'false')
                  await expect(nav.locator(other)).toBeVisible()
                  expect(await noSideScroll(page), `${path} at ${width}, folded`).toBe(true)
                  await fold.click()
                  await expect(fold).toHaveAttribute('aria-expanded', 'true')
                }
              },
            )
        })

    test('Arabic mirrors the shell (fellow)', async ({ browser }) => {
      const chevron = {} as Record<Locale, string>
      for (const locale of LOCALES)
        await inContext(browser, { viewport: DESKTOP, role: 'fellow' }, async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          const rail = (await page.locator('[data-portal-rail]').boundingBox())!
          const main = (await page.locator('main').boundingBox())!
          expect(rail.x > main.x, locale).toBe(locale === 'ar')
          chevron[locale] = await page
            .getByRole('button', { name: MESSAGES[locale].Portal.nav.sidebar })
            .locator('svg')
            .evaluate((svg) => `${getComputedStyle(svg).transform} ${getComputedStyle(svg).scale}`)
        })
      expect(chevron.ar).not.toBe(chevron.en)

      await inContext(browser, { viewport: PHONE, role: 'fellow' }, async (page) => {
        const portal = MESSAGES.ar.Portal
        await page.goto('/ar/spaces')
        const bar = portalNavOf(page, 'ar')
        const home = (await bar
          .getByRole('link', { name: portal.nav.home, exact: true })
          .boundingBox())!
        const more = (await bar
          .getByRole('button', { name: portal.nav.more, exact: true })
          .boundingBox())!
        expect(home.x).toBeGreaterThan(more.x)
        const sheet = await openMore(page, 'ar')
        const row = sheet.locator(`a[href="${localePath(world.otherCourse.path, 'ar')}"]`)
        const cover = (await row.locator('span').first().boundingBox())!
        const label = (await row.locator('bdi').last().boundingBox())!
        expect(cover.x).toBeGreaterThan(label.x)
        expect(cover.x - (label.x + label.width)).toBeLessThan(16)
      })
    })

    for (const locale of LOCALES)
      test(`targets (${locale})`, async ({ browser }) => {
        const portal = MESSAGES[locale].Portal
        const sizes = async (page: Page, selector: ReturnType<Page['locator']>) =>
          selector.evaluateAll((els) =>
            els.map((el) => {
              const box = el.getBoundingClientRect()
              return { w: box.width, h: box.height }
            }),
          )
        const atLeast = (list: { w: number; h: number }[], min: number) =>
          list.filter((box) => box.w < min || box.h < min)

        for (const viewport of [PHONE, DESKTOP]) {
          const context = await browser.newContext({
            baseURL,
            viewport,
            storageState: states.fellow,
            hasTouch: true,
            isMobile: true,
          })
          try {
            const page = await context.newPage()
            await page.goto(localePath('/en/spaces', locale))
            expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
            if (viewport === DESKTOP) await expect(accountButton(page, locale)).toBeVisible()
            const nav = portalNavOf(page, locale)
            if (viewport === PHONE)
              await expect(
                nav.getByRole('button', { name: portal.nav.more, exact: true }),
              ).toBeVisible()
            const targets =
              viewport === PHONE
                ? nav.locator('a, button')
                : page.locator(
                    '[data-portal-rail] nav a, [data-portal-crumbs] button[data-portal-fold]',
                  )
            await expect
              .poll(async () => (await sizes(page, targets)).length)
              .toBeGreaterThan(viewport === PHONE ? 1 : 2)
            const found = await sizes(page, targets)
            expect(atLeast(found, 44)).toEqual([])
            const header = page.locator('[data-portal-rail] header').locator('a, button')
            await expect(header.first()).toBeVisible()
            const shownIn = () =>
              header.evaluateAll((els) =>
                els
                  .filter((el) => el.getClientRects().length > 0)
                  .map((el) => {
                    const box = el.getBoundingClientRect()
                    return { w: box.width, h: box.height }
                  }),
              )
            await expect
              .poll(async () => (await shownIn()).length)
              .toBeGreaterThan(viewport === PHONE ? 1 : 2)
            const shown = await shownIn()
            expect(atLeast(shown, 44)).toEqual([])
            await page.keyboard.press('Tab')
            const skip = page.getByRole('link', { name: portal.shell.skip })
            await expect(skip).toBeFocused()
            expect(atLeast(await sizes(page, skip), 44)).toEqual([])
          } finally {
            await context.close()
          }
        }

        await inContext(browser, { viewport: DESKTOP, role: 'fellow' }, async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          const found = await sizes(
            page,
            page.locator('[data-portal-rail] a, [data-portal-rail] button'),
          )
          expect(atLeast(found, 24)).toEqual([])
        })
      })
  })

  test.describe('header, landmarks and sign-out', () => {
    const PHONES = [PHONE, { width: 320, height: 640 }]

    for (const locale of LOCALES)
      for (const viewport of PHONES)
        for (const folded of [false, true])
          test(`the phone header spans the width (${locale} ${viewport.width}${folded ? ', fold cookie' : ''})`, async ({
            browser,
          }) => {
            const context = await browser.newContext({
              baseURL,
              viewport,
              storageState: states.fellow,
            })
            try {
              if (folded)
                await context.addCookies([
                  {
                    name: `portal-folded-${world.accounts.fellow.id}`,
                    value: '1',
                    url: baseURL!,
                  },
                ])
              const page = await context.newPage()
              await page.goto(localePath('/en/spaces', locale))
              const header = page.locator('[data-portal-rail] header')
              const box = (await header.boundingBox())!
              const bell = (await header
                .getByRole('button', {
                  name: new RegExp(`^${MESSAGES[locale].Notifications.label}(,|،|$)`),
                })
                .boundingBox())!
              expect(box.height).toBeLessThanOrEqual(64)
              expect(box.width).toBeGreaterThan(viewport.width - 40)
              if (locale === 'en') expect(bell.x + bell.width).toBeGreaterThan(viewport.width - 40)
              else expect(bell.x).toBeLessThan(40)
            } finally {
              await context.close()
            }
          })

    for (const locale of LOCALES)
      test(`the More sheet closes when the window widens, and focus goes to the fold button (${locale})`, async ({
        browser,
      }) => {
        await inContext(browser, { viewport: PHONE, role: 'fellow' }, async (page) => {
          await page.goto(localePath('/en/spaces', locale))
          const sheet = await openMore(page, locale)
          await page.setViewportSize({ width: 1000, height: 800 })
          await expect(sheet).toHaveCount(0)
          const focused = page.getByRole('button', { name: MESSAGES[locale].Portal.nav.sidebar })
          await expect(focused).toBeFocused()
          await expect(page.locator('[data-portal-crumbs] [data-portal-fold]')).toBeFocused()
          await expect(focused).toHaveAttribute('aria-keyshortcuts', '[')
        })
      })

    for (const viewport of Object.values(WIDTHS))
      for (const locale of LOCALES)
        test(`every shell control is in a landmark, and headings keep their order (${locale} ${viewport.width})`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport, role: 'fellow' }, async (page) => {
            for (const path of ['/en/spaces', world.course.path]) {
              await page.goto(localePath(path, locale))
              await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
              const { violations } = await new AxeBuilder({ page })
                .withRules(path === '/en/spaces' ? ['region', 'heading-order'] : ['region'])
                .exclude('nextjs-portal')
                .analyze()
              expect(
                Object.fromEntries(
                  violations.map((v) => [v.id, v.nodes.map((n) => n.target.join(' '))]),
                ),
                path,
              ).toEqual({})
            }
          })
        })

    for (const locale of LOCALES)
      for (const viewport of Object.values(WIDTHS))
        test(`a refused sign-out keeps the page and says so (${locale} ${viewport.width})`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport, role: 'fellow' }, async (page) => {
            await page.route('**/api/users/logout', (route) => route.fulfill({ status: 500 }))
            await page.goto(localePath('/en/spaces', locale))
            const portal = MESSAGES[locale].Portal
            if (viewport.width < 700) {
              const sheet = await openMore(page, locale)
              await sheet.getByRole('button', { name: portal.account.signOut }).click()
            } else {
              await accountButton(page, locale).click()
              await page.getByRole('menuitem', { name: portal.account.signOut }).click()
            }
            await expect(
              toastRegion(page, locale).getByText(MESSAGES[locale].Session.signOutFailed),
            ).toBeVisible()
            expect(new URL(page.url()).pathname).toBe(localePath('/en/spaces', locale))
          })
        })

    test('the current row keeps a cue in forced colours and more contrast (en 1440)', async ({
      browser,
    }) => {
      for (const options of [{ forcedColors: 'active' }, { contrast: 'more' }] as const) {
        const context = await browser.newContext({
          baseURL,
          viewport: DESKTOP,
          storageState: states.fellow,
          ...options,
        })
        try {
          const page = await context.newPage()
          await page.goto('/en/spaces')
          const home = portalNavOf(page, 'en').getByRole('link', { name: 'Home', exact: true })
          await expect(home).toHaveAttribute('aria-current', 'page')
          const cue = await home.evaluate((el) => {
            const style = getComputedStyle(el)
            const bar = getComputedStyle(el, '::before')
            return {
              outline: style.outlineStyle,
              weight: style.fontWeight,
              bar: parseFloat(bar.borderInlineStartWidth),
            }
          })
          expect(cue.weight).toBe('500')
          if ('forcedColors' in options) expect(cue.outline).toBe('solid')
          else expect(cue.bar).toBeGreaterThanOrEqual(4)
        } finally {
          await context.close()
        }
      }
    })
  })

  test.describe('axe on /spaces states', () => {
    const expectClean = async (page: Page, label: string) => {
      expect(await axeOver(page, {}), label).toEqual({})
    }

    for (const role of ROLES)
      for (const locale of LOCALES) {
        for (const viewport of Object.values(WIDTHS))
          test(`axe dark theme (/spaces ${role} ${locale} ${viewport.width})`, async ({
            browser,
          }) => {
            const context = await browser.newContext({
              baseURL,
              viewport,
              storageState: states[role],
              colorScheme: 'dark',
            })
            try {
              await notifyOf(
                payload,
                world.accounts[role],
                localePath(world.course.postPath, locale),
              )
              const page = await context.newPage()
              await page.goto(localePath('/en/spaces', locale))
              await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
              await expect(
                page.locator('[data-portal-rail]').getByRole('button', {
                  name: new RegExp(`^${MESSAGES[locale].Notifications.label}(,|،)`),
                }),
              ).toHaveCount(1)
              await expectClean(page, 'dark')
            } finally {
              await context.close()
            }
          })

        test(`axe with the account menu open (/spaces ${role} ${locale} 1440)`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport: DESKTOP, role }, async (page) => {
            await page.goto(localePath('/en/spaces', locale))
            await accountButton(page, locale).click()
            const menu = page.getByRole('menu')
            await expect(menu).toBeVisible()
            await expect
              .poll(() =>
                menu.getByText(world.accounts[role].email).evaluate((el) => {
                  let opacity = 1
                  for (let node: Element | null = el; node; node = node.parentElement)
                    opacity *= Number(getComputedStyle(node).opacity)
                  return opacity
                }),
              )
              .toBe(1)
            await expectClean(page, 'account menu')
          })
        })

        test(`axe with the More sheet open (/spaces ${role} ${locale} 390)`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport: PHONE, role }, async (page) => {
            await page.goto(localePath('/en/spaces', locale))
            const sheet = await openMore(page, locale)
            await expect(
              sheet.getByRole('link', {
                name: MESSAGES[locale].Language[OTHER[locale]],
                exact: true,
              }),
            ).toBeVisible()
            await expectClean(page, 'More sheet')
          })
        })
      }
  })
})
