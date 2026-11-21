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

  test.describe('shell (1440)', () => {
    for (const role of ROLES)
      for (const locale of LOCALES) {
        const portal = MESSAGES[locale].Portal

        test(`landmarks, skip link and live region (${role} ${locale})`, async ({ browser }) => {
          await world.resetVisits()
          await inContext(browser, { viewport: DESKTOP, role }, async (page) => {
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
            expect(known(`/${locale}/spaces`, role, locale, DESKTOP.width)).toEqual({})
          })
        })

        test(`every nav item and account row opens a page (${role} ${locale})`, async ({
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

        test(`the nav shows each space with its unread count (${role} ${locale})`, async ({
          browser,
        }) => {
          await world.resetVisits()
          await inContext(browser, { viewport: DESKTOP, role }, async (page) => {
            await page.goto(localePath('/en/spaces', locale))
            const nav = portalNavOf(page, locale)
            for (const room of ['course', 'otherCourse'] as const)
              await expect(
                nav.getByRole('link', {
                  name: spaceName(world[room], locale, EXPECTED_UNREAD[room]),
                }),
              ).toBeVisible()
          })
        })

        test(`opening a space drops its count in this tab (${role} ${locale})`, async ({
          browser,
        }) => {
          await world.resetVisits()
          await inContext(browser, { viewport: DESKTOP, role }, async (page) => {
            await page.goto(localePath('/en/spaces', locale))
            const nav = portalNavOf(page, locale)
            await nav
              .getByRole('link', {
                name: spaceName(world.otherCourse, locale, EXPECTED_UNREAD.otherCourse),
              })
              .click()
            await page.waitForURL(`**${localePath(world.otherCourse.path, locale)}`)
            const row = nav.getByRole('link', {
              name: spaceName(world.otherCourse, locale, 0),
            })
            await expect(row).toBeVisible()
            await expect(row).not.toContainText('9+')
            await page.reload()
            await expect(row).toBeVisible()
            await expect(row).not.toContainText('9+')
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
})
