import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import { login } from '../testing/login.test-utils'
import { createTracker, uniq } from '../testing/payload.fixture'
import {
  holdSpacesMode,
  inContext as inContextAt,
  LOCALES,
  localePath,
  MESSAGES,
  notifyOf,
  openMore,
  portalWorld,
  POST_BODY,
  ROLES,
  WIDTHS,
  type Locale,
  type PortalRole,
  type PortalWorld,
} from '../testing/portal.fixture'

type State = Awaited<ReturnType<BrowserContext['storageState']>>
type Viewport = (typeof WIDTHS)[keyof typeof WIDTHS]

const { track, cleanup } = createTracker()
let payload: Payload
let world: PortalWorld
let spaces: Awaited<ReturnType<typeof holdSpacesMode>>
let baseURL: string | undefined
const states = {} as Record<PortalRole, State>

const inContext = (
  browser: Browser,
  options: { viewport: Viewport; role: PortalRole | null },
  run: (page: Page) => Promise<void>,
) =>
  inContextAt(
    browser,
    { baseURL, viewport: options.viewport, state: options.role ? states[options.role] : undefined },
    run,
  )

const openPostDialog = async (page: Page, room: PortalWorld['course'], locale: Locale) => {
  await page.goto(localePath(room.path, locale))
  await page
    .locator(`a[href="${localePath(room.postPath, locale)}"]`)
    .first()
    .click()
  await expect(page).toHaveURL(localePath(room.postPath, locale))
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.getByRole('dialog')).toContainText(POST_BODY)
}

type DevWindow = { nd?: { router: { push: (href: string) => void } } }

const pushWithDevRouter = async (page: Page, path: string) => {
  await expect.poll(() => page.evaluate(() => typeof (window as DevWindow).nd)).toBe('object')
  await page.evaluate((href) => (window as DevWindow).nd!.router.push(href), path)
}

const spaceHeading = (page: Page, room: PortalWorld['course'], locale: Locale) =>
  page.getByRole('heading', { level: 1, name: room.label[locale] })

const PHONE_FIRST = [WIDTHS.phone, WIDTHS.desktop] as const

test.describe('portal spaces', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    baseURL = test.info().project.use.baseURL
    payload = await getPayload({ config, key: uniq('portal-spaces-off') })
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

  test.describe('dialog routes', () => {
    for (const viewport of PHONE_FIRST)
      for (const role of ROLES)
        for (const locale of LOCALES) {
          const at = `(${role}, ${locale} ${viewport.width})`

          test(`a post link inside a space opens the dialog ${at}`, async ({ browser }) => {
            await inContext(browser, { viewport, role }, async (page) => {
              await openPostDialog(page, world.course, locale)
            })
          })

          test(`Esc closes the dialog and leaves the space page ${at}`, async ({ browser }) => {
            await inContext(browser, { viewport, role }, async (page) => {
              await openPostDialog(page, world.course, locale)
              await page.keyboard.press('Escape')
              await expect(page).toHaveURL(localePath(world.course.path, locale))
              await expect(page.getByRole('dialog')).toHaveCount(0)
              await expect(spaceHeading(page, world.course, locale)).toBeVisible()
            })
          })

          test(`Back closes the dialog; Forward opens it again ${at}`, async ({ browser }) => {
            await inContext(browser, { viewport, role }, async (page) => {
              await openPostDialog(page, world.course, locale)
              await page.goBack()
              await expect(page).toHaveURL(localePath(world.course.path, locale))
              await expect(page.getByRole('dialog')).toHaveCount(0)
              await page.goForward()
              await expect(page).toHaveURL(localePath(world.course.postPath, locale))
              await expect(page.getByRole('dialog')).toHaveCount(1)
            })
          })

          test(`a hard load of a space page shows no dialog ${at}`, async ({ browser }) => {
            await inContext(browser, { viewport, role }, async (page) => {
              await page.goto(localePath(world.course.path, locale))
              await expect(spaceHeading(page, world.course, locale)).toBeVisible()
              await expect(page.getByRole('dialog')).toHaveCount(0)
            })
          })

          test(`a bell row on Home opens the full post page ${at}`, async ({ browser }) => {
            const account = world.accounts[role]
            const text = MESSAGES[locale].Notifications
            await payload.delete({
              collection: 'notifications',
              where: { recipient: { equals: account.id } },
              overrideAccess: true,
            })
            await notifyOf(payload, account, localePath(world.course.postPath, locale))
            await inContext(browser, { viewport, role }, async (page) => {
              await page.goto(localePath('/en/spaces', locale))
              await page.getByRole('button', { name: new RegExp(`^${text.label}(,|،|$)`) }).click()
              const panel = page.getByRole('dialog', { name: text.label, exact: true })
              await panel
                .getByRole('button', { name: new RegExp(`^${text.kinds.comment}`) })
                .click()
              await panel.getByRole('link', { name: text.open }).click()
              await expect(page).toHaveURL(localePath(world.course.postPath, locale))
              await expect(page.getByRole('dialog')).toHaveCount(0)
              await expect(page.locator('article').first()).toBeVisible()
            })
          })
        }
  })

  test.describe('spaces off', () => {
    test.beforeAll(async () => {
      await spaces.set('off')
    })

    test.afterAll(async () => {
      await spaces.set('on')
    })

    for (const role of ROLES)
      for (const locale of LOCALES) {
        for (const viewport of PHONE_FIRST) {
          const at = `(${role}, ${locale} ${viewport.width})`

          test(`spaces off: /spaces loads with no space ${at}`, async ({ browser }) => {
            await inContext(browser, { viewport, role }, async (page) => {
              const response = await page.goto(localePath('/en/spaces', locale))
              expect(response!.status()).toBe(200)
              await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
              await expect(
                page.locator('section[aria-labelledby="spaces-shortcuts"]'),
              ).toBeVisible()
              await expect(page.locator('section[aria-labelledby^="spaces-"]')).toHaveCount(1)
              await expect(page.locator('a[href*="/spaces/course/"]')).toHaveCount(0)
              await expect(page.getByText(MESSAGES[locale].Spaces.empty)).toHaveCount(0)
            })
          })

          test(`spaces off: no spaces in the nav ${at}`, async ({ browser }) => {
            const portal = MESSAGES[locale].Portal
            await inContext(browser, { viewport, role }, async (page) => {
              await page.goto(localePath('/en/spaces', locale))
              await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
              const links =
                viewport.width < 700
                  ? await openMore(page, locale)
                  : page.getByRole('navigation', { name: portal.nav.label, exact: true })
              await expect(links.getByRole('heading', { name: portal.nav.spaces })).toHaveCount(0)
              await expect(
                links.locator('a[href*="/spaces/course/"], a[href*="/spaces/community/"]'),
              ).toHaveCount(0)
              await expect(page.getByText(MESSAGES[locale].Spaces.empty)).toHaveCount(0)
            })
          })

          test(`spaces switched off while a reader is on a space page ${at}`, async ({
            browser,
          }) => {
            await inContext(browser, { viewport, role }, async (page) => {
              try {
                await spaces.set('on')
                await page.goto(localePath(world.course.path, locale))
                await expect(spaceHeading(page, world.course, locale)).toBeVisible()
                await spaces.set('off')
                const links =
                  viewport.width < 700
                    ? await openMore(page, locale)
                    : page.getByRole('navigation', {
                        name: MESSAGES[locale].Portal.nav.label,
                        exact: true,
                      })
                await links
                  .locator(`a[href="${localePath(world.otherCourse.path, locale)}"]`)
                  .click()
                await expect(
                  page.getByRole('heading', { level: 1, name: MESSAGES[locale].NotFound.title }),
                ).toBeVisible()
              } finally {
                await spaces.set('off')
              }
            })
          })

          test(`a post opened by a soft navigation after spaces go off is not found ${at}`, async ({
            browser,
          }) => {
            await inContext(browser, { viewport, role }, async (page) => {
              try {
                await spaces.set('on')
                await page.goto(localePath(world.course.path, locale))
                await expect(spaceHeading(page, world.course, locale)).toBeVisible()
                await spaces.set('off')
                await page
                  .locator(`a[href="${localePath(world.course.postPath, locale)}"]`)
                  .first()
                  .click()
                await expect(page).toHaveURL(localePath(world.course.postPath, locale))
                await expect(
                  page.getByRole('heading', { level: 1, name: MESSAGES[locale].NotFound.title }),
                ).toBeVisible()
                await expect(page.getByRole('dialog')).toHaveCount(0)
              } finally {
                await spaces.set('off')
              }
            })
          })

          test(`an open dialog closes on Back after spaces go off ${at}`, async ({ browser }) => {
            await inContext(browser, { viewport, role }, async (page) => {
              try {
                await spaces.set('on')
                await openPostDialog(page, world.community, locale)
                await spaces.set('off')
                await page.goBack()
                await expect(page).toHaveURL(localePath(world.community.path, locale))
                await expect(page.getByRole('dialog')).toHaveCount(0)
              } finally {
                await spaces.set('off')
              }
            })
          })
        }

        test(`spaces off: every space page and dialog route is not found (${role}, ${locale})`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport: WIDTHS.desktop, role }, async (page) => {
            const paths = [
              world.course.path,
              world.course.postPath,
              world.community.path,
              world.community.postPath,
              '/en/spaces/community',
            ].map((path) => localePath(path, locale))
            const statuses = []
            for (const path of paths)
              statuses.push({ path, status: (await page.request.get(path)).status() })
            expect(statuses).toEqual(paths.map((path) => ({ path, status: 404 })))
          })
        })
      }

    for (const locale of LOCALES)
      test(`a signed-out reader is sent to login from /spaces and from a space page (${locale})`, async ({
        browser,
      }) => {
        await inContext(browser, { viewport: WIDTHS.desktop, role: null }, async (page) => {
          for (const path of ['/en/spaces', world.course.path]) {
            await page.goto(localePath(path, locale))
            await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?next=`))
          }
        })
      })
  })

  test.describe('dev server only', () => {
    test.beforeAll(async () => {
      const dev = await fetch(new URL('/_next/static/development/_devPagesManifest.json', baseURL))
      test.skip(
        !dev.ok,
        'needs `next dev`: the probe drives window.nd, which a build does not have',
      )
    })

    test('a soft navigation from Home to a post shows the dialog over an empty page', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: WIDTHS.desktop, role: 'fellow' }, async (page) => {
        await page.goto('/en/spaces')
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
        await pushWithDevRouter(page, world.course.postPath)
        await expect(page).toHaveURL(world.course.postPath)
        await expect(page.getByRole('dialog')).toContainText(POST_BODY)
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0)
        await expect(page.locator('main')).toHaveText('')
      })
    })

    test('an open dialog closes on a navigation to another space page', async ({ browser }) => {
      await inContext(browser, { viewport: WIDTHS.desktop, role: 'fellow' }, async (page) => {
        await openPostDialog(page, world.course, 'en')
        await pushWithDevRouter(page, world.community.path)
        await expect(page).toHaveURL(world.community.path)
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(spaceHeading(page, world.community, 'en')).toBeVisible()
      })
    })
  })
})
