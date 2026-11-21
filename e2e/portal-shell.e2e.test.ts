import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { createTranslator } from 'next-intl'
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
  openMore,
  portalWorld,
  ROLES,
  WIDTHS,
  type Locale,
  type PortalRole,
  type PortalWorld,
  type RoomFixture,
  type StorageState,
} from '../testing/portal.fixture'
import KNOWN from './portal-axe-known.json'

type Viewport = (typeof WIDTHS)[keyof typeof WIDTHS]

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const ROUTE_SHAPES = [
  ['/spaces', /^\/[a-z]{2}\/spaces$/],
  ['/spaces/course/*', /^\/[a-z]{2}\/spaces\/course\/[^/]+$/],
  ['/spaces/community', /^\/[a-z]{2}\/spaces\/community$/],
  ['/spaces/community/*', /^\/[a-z]{2}\/spaces\/community\/[^/]+$/],
] as const

type RouteShape = (typeof ROUTE_SHAPES)[number][0]
type Known = Partial<Record<RouteShape, Record<string, Record<string, number>>>>

const shapeOf = (route: string) => {
  const shape = ROUTE_SHAPES.find(([, pattern]) => pattern.test(route))
  if (!shape) throw new Error(`no route shape for ${route}`)
  return shape[0]
}

const known = (route: string, role: PortalRole, locale: Locale, width: number) =>
  (KNOWN as Known)[shapeOf(route)]?.[`${role} ${locale} ${width}`] ?? {}

const portalRoutes = (world: PortalWorld, locale: Locale) =>
  ['/en/spaces', world.course.path, '/en/spaces/community', world.community.path].map((path) =>
    localePath(path, locale),
  )

const axeViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('nextjs-portal')
    .analyze()
  return violations
}

const OTHER = { en: 'ar', ar: 'en' } as const
const DESKTOP = WIDTHS.desktop

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const spaceName = (room: RoomFixture, locale: Locale, unread: number) => {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Portal.nav' })
  const count = unread === 0 ? '' : unread > 9 ? t('unreadMany') : t('unread', { count: unread })
  return new RegExp(`^${escape(room.label[locale])}\\s?${escape(count)}$`)
}

const portalNavOf = (page: Page, locale: Locale) =>
  page.getByRole('navigation', { name: MESSAGES[locale].Portal.nav.label, exact: true })

const accountButton = (page: Page, locale: Locale) =>
  page
    .locator('[data-portal-rail]')
    .getByRole('button', { name: new RegExp(`^${MESSAGES[locale].Portal.account.label}, `) })

const PHONE = WIDTHS.phone

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
                const violations = await axeViolations(page)
                const allowed = known(route, role, locale, viewport.width)
                const over = Object.fromEntries(
                  violations
                    .filter((v) => v.nodes.length > (allowed[v.id] ?? 0))
                    .map((v) => [v.id, v.nodes.map((node) => node.target.join(' '))]),
                )
                expect(over, shape).toEqual({})
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
                await expect(page.locator('main#main')).toBeFocused()
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
              const links = await spaceLinksOf(page)
              await expect(
                links.getByRole('link', { name: portal.nav.openDashboard, exact: true }),
              ).toHaveCount(role === 'admin' ? 1 : 0)
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
              await expect(row).not.toContainText('9+')
              await page.reload()
              row = await shownRow()
              await expect(row).toBeVisible()
              await expect(row).not.toContainText('9+')
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
            expect(hrefs).toEqual(
              role === 'admin' ? [`/${locale}/spaces`, '/admin'] : [`/${locale}/spaces`],
            )
            for (const href of hrefs) expect((await page.request.get(href)).status()).toBe(200)

            const account = accountButton(page, locale)
            await expect(account).toHaveAttribute('aria-haspopup', 'menu')
            await account.click()
            await expect(account).toHaveAttribute('aria-expanded', 'true')
            await page.getByRole('menuitem', { name: portal.account.profile }).click()
            await page.waitForURL(`**/${locale}/settings`)

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

  test.describe('fold (1440)', () => {
    const PAIRS = [
      ['admin', 'fellow'],
      ['fellow', 'student'],
      ['student', 'admin'],
    ] as const

    const foldButton = (page: Page, locale: Locale) =>
      page.getByRole('button', { name: MESSAGES[locale].Portal.nav.fold })

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
            await page.goto(localePath('/en/spaces', locale))
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
              await page.goto(localePath('/en/spaces', locale))
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
              const last = page.locator('section[aria-labelledby="spaces-shortcuts"] a').last()
              let focused = false
              for (let i = 0; i < 80 && !focused; i++) {
                await page.keyboard.press('Tab')
                focused = await last.evaluate((link) => link === document.activeElement)
              }
              await expect(last).toBeFocused()
              const measure = () =>
                page.evaluate(() => {
                  const row = document.activeElement!.getBoundingClientRect()
                  const toastBox = [...document.querySelectorAll('li')]
                    .find((li) => li.textContent?.includes('E2E comment'))!
                    .getBoundingClientRect()
                  const bar = document
                    .querySelector('nav [aria-haspopup="dialog"]')!
                    .closest('nav')!
                    .getBoundingClientRect()
                  const root = getComputedStyle(document.documentElement)
                  return {
                    rowBottom: row.bottom,
                    limit: Math.min(toastBox.top, bar.top),
                    padding: parseFloat(root.scrollPaddingBlockEnd),
                    needed:
                      bar.height + parseFloat(root.getPropertyValue('--toast-stack-height') || '0'),
                  }
                })
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
            await page.waitForURL(`**/${locale}/settings`)

            await page.goto(localePath('/en/spaces', locale))
            sheet = await openMore(page, locale)
            await sheet.getByRole('link', { name: MESSAGES[locale].Language.switchToLabel }).click()
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
            await page.goto(localePath('/en/settings', locale))
            await page.goto(localePath('/en/spaces', locale))
            const sheet = await openMore(page, locale)
            await notifyOf(payload, world.accounts[role], localePath(world.course.postPath, locale))
            await expect(toastRegion(sheet, locale).getByText('E2E comment')).toBeVisible()
            await sheet.getByRole('link', { name: portal.account.profile }).click()
            await page.waitForURL(`**/${locale}/settings`)
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
            await more.hover()
            await more.click()
            const sheet = page.getByRole('dialog', { name: portal.nav.more, exact: true })
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
            const empty = MESSAGES[locale].Portal.empty
            await spaces.set('trial', { trialCommunity: false })
            try {
              await inContextAt(browser, { baseURL, viewport }, async (page) => {
                await login({
                  page,
                  user: world.loners[role],
                  next: localePath('/en/spaces', locale),
                })
                await expect(
                  page.getByRole('heading', { level: 2, name: empty.spacesTitle }),
                ).toBeVisible()
                await expect(page.getByText(empty.spacesNext)).toBeVisible()
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
                  const fold = page.getByRole('button', { name: MESSAGES[locale].Portal.nav.fold })
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
            .getByRole('button', { name: MESSAGES[locale].Portal.nav.fold })
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
        const label = (await row.locator('bdi').boundingBox())!
        expect(cover.x).toBeGreaterThan(label.x)
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
            const nav = portalNavOf(page, locale)
            const targets =
              viewport === PHONE
                ? nav.locator('a, button')
                : page.locator(
                    `[data-portal-rail] nav a, [data-portal-rail] button[aria-label="${portal.nav.fold}"]`,
                  )
            const found = await sizes(page, targets)
            expect(found.length).toBeGreaterThan(viewport === PHONE ? 1 : 2)
            expect(atLeast(found, 44)).toEqual([])
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

  test.describe('axe on /spaces states', () => {
    const expectClean = async (page: Page, label: string) => {
      const violations = await axeViolations(page)
      expect(
        Object.fromEntries(violations.map((v) => [v.id, v.nodes.map((n) => n.target.join(' '))])),
        label,
      ).toEqual({})
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
            await expect(page.getByRole('menu')).toBeVisible()
            await expectClean(page, 'account menu')
          })
        })

        test(`axe with the More sheet open (/spaces ${role} ${locale} 390)`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport: PHONE, role }, async (page) => {
            await page.goto(localePath('/en/spaces', locale))
            await openMore(page, locale)
            await expectClean(page, 'More sheet')
          })
        })
      }
  })
})
