import { expect, test, type Browser, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import { login } from '../testing/login.test-utils'
import { createTracker, uniq } from '../testing/payload.fixture'
import { axeOver, known, PHONE } from '../testing/portal-e2e.test-utils'
import {
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
  type StorageState,
} from '../testing/portal.fixture'

type Viewport = { width: number; height: number }

const DESKTOP = WIDTHS.desktop
const NARROW = { width: 320, height: 640 }

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

const ACCOUNT = '/en/spaces/account'

const tab = (page: Page, locale: Locale, name: 'profile' | 'signIn' | 'notifications') => {
  const label =
    name === 'signIn' ? MESSAGES[locale].Portal.account.signIn : MESSAGES[locale].Settings[name]
  return page.getByRole('tab', { name: new RegExp(`^${label}(?:\\s|$)`) })
}

const saveBar = (page: Page, locale: Locale) => {
  const text = MESSAGES[locale].Settings
  const actions = page
    .locator('div')
    .filter({ has: page.getByRole('button', { name: text.save, exact: true }) })
    .filter({ has: page.getByRole('button', { name: text.discard, exact: true }) })
    .last()
  return actions.locator('xpath=..')
}

const editName = async (page: Page, locale: Locale, value: string) => {
  await page.getByLabel(MESSAGES[locale].Profile.nameEn, { exact: true }).fill(value)
}

const signIn = async (page: Page, user: { email: string; password: string }) => {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

const accountButton = (page: Page) =>
  page
    .locator('[data-portal-rail]')
    .getByRole('button', { name: new RegExp(`^${MESSAGES.en.Portal.account.label}, `) })

test.describe('portal account', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    baseURL = test.info().project.use.baseURL
    payload = await getPayload({ config, key: uniq('portal-account') })
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

  test.describe('redirects', () => {
    for (const role of ROLES)
      for (const locale of LOCALES) {
        test(`/settings lands on /spaces/account (${role} ${locale})`, async ({ browser }) => {
          await inContext(browser, { viewport: DESKTOP, role }, async (page) => {
            await page.goto(`/${locale}/settings`)
            await page.waitForURL(new RegExp(`/${locale}/spaces/account$`))
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(
              MESSAGES[locale].Settings.title,
            )
          })
        })

        test(`/profile lands on /spaces/account#profile (${role} ${locale})`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport: DESKTOP, role }, async (page) => {
            await page.goto(`/${locale}/profile`)
            await page.waitForURL(new RegExp(`/${locale}/spaces/account#profile$`))
            await expect(page.locator('#profile')).toBeInViewport()
            await expect(tab(page, locale, 'profile')).toHaveAttribute('aria-selected', 'true')
          })
        })

        test(`/settings#notifications opens Notifications (${role} ${locale})`, async ({
          browser,
        }) => {
          await inContext(browser, { viewport: DESKTOP, role }, async (page) => {
            await page.goto(`/${locale}/settings#notifications`)
            await page.waitForURL(new RegExp(`/${locale}/spaces/account#notifications$`))
            await expect(tab(page, locale, 'notifications')).toHaveAttribute(
              'aria-selected',
              'true',
            )
            await expect(page.locator('#notifications')).toHaveCount(1)
          })
        })
      }

    test('signed out, /settings returns to the account page after login', async ({ browser }) => {
      await inContextAt(browser, { baseURL, viewport: DESKTOP }, async (page) => {
        await page.goto('/en/settings')
        await page.waitForURL('**/en/login**')
        expect(new URL(page.url()).searchParams.get('next')).toBe(ACCOUNT)
        await signIn(page, world.accounts.student)
        await page.waitForURL('**/en/spaces/account')
      })
    })

    test('signed out, /spaces/account returns to the portal home after login', async ({
      browser,
    }) => {
      await inContextAt(browser, { baseURL, viewport: DESKTOP }, async (page) => {
        await page.goto(ACCOUNT)
        await page.waitForURL('**/en/login**')
        expect(new URL(page.url()).searchParams.get('next')).toBe('/en/spaces')
        await signIn(page, world.accounts.student)
        await page.waitForURL(/\/en\/spaces$/)
      })
    })

    test('a signed-in reader on /forgot lands on /spaces/account', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto('/en/forgot')
        await page.waitForURL('**/en/spaces/account')
      })
    })
  })

  test.describe('the page', () => {
    for (const locale of LOCALES)
      test(`three groups in order (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
          await page.goto(localePath(ACCOUNT, locale))
          await expect(page.getByRole('tab')).toHaveText([
            MESSAGES[locale].Settings.profile,
            MESSAGES[locale].Portal.account.signIn,
            MESSAGES[locale].Settings.notifications,
          ])
        })
      })

    test('a profile save works', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        const name = uniq('Account name')
        const bio = uniq('Account bio')
        await page.goto(ACCOUNT)
        await editName(page, 'en', name)
        const bioField = page.getByRole('textbox', { name: MESSAGES.en.Profile.bioEn })
        await bioField.click()
        await page.keyboard.type(bio)
        await page.getByRole('button', { name: MESSAGES.en.Settings.save, exact: true }).click()
        await expect(saveBar(page, 'en')).toBeHidden()
        await expect.poll(() => accountButton(page).getAttribute('aria-label')).toContain(name)
        await page.reload()
        await expect(page.getByLabel(MESSAGES.en.Profile.nameEn, { exact: true })).toHaveValue(name)
        await expect(bioField).toContainText(bio)
      })
    })

    test('the space email choices hide with spaces off', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        const group = page.getByRole('heading', { name: MESSAGES.en.Settings.spaceGroup })
        try {
          await spaces.set('off')
          await page.goto(`${ACCOUNT}#notifications`)
          await expect(tab(page, 'en', 'notifications')).toHaveAttribute('aria-selected', 'true')
          await expect(group).toHaveCount(0)
        } finally {
          await spaces.set('on')
        }
        await page.reload()
        await expect(group).toBeVisible()
      })
    })

    test('a reader with no person sees the no-person text', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'admin' }, async (page) => {
        await page.goto(ACCOUNT)
        await expect(page.getByText(MESSAGES.en.Profile.noPerson)).toBeVisible()
      })
    })

    test('Change password says where the link went, once', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        const posted: unknown[] = []
        await page.route('**/api/users/forgot-password', (route) => {
          posted.push(route.request().postDataJSON())
          return route.fulfill({ status: 200, json: {} })
        })
        await page.goto(`${ACCOUNT}#sign-in`)
        const portal = MESSAGES.en.Portal.account
        const words = portal.resetSent.replace('{email}', world.accounts.student.email)
        await page.getByRole('button', { name: portal.changePassword }).click()
        const exposed = page
          .getByRole('status')
          .or(page.getByRole('alert'))
          .filter({ hasText: words })
        await expect(exposed).toHaveCount(1)
        await expect(exposed).toHaveAttribute('data-portal-live')
        await expect(page.locator('[aria-hidden="true"]').getByText(words)).toBeVisible()
        expect(posted).toEqual([{ email: world.accounts.student.email }])
      })
    })

    test('the Change password button keeps its width while it sends', async ({ browser }) => {
      await inContext(browser, { viewport: PHONE, role: 'student' }, async (page) => {
        await page.route('**/api/users/forgot-password', async (route) => {
          await new Promise((done) => setTimeout(done, 800))
          await route.fulfill({ status: 200, json: {} })
        })
        await page.goto(`${ACCOUNT}#sign-in`)
        const portal = MESSAGES.en.Portal.account
        const widthOf = async (name: string) =>
          (await page.getByRole('button', { name }).boundingBox())?.width ?? 0
        const idle = await widthOf(portal.changePassword)
        await page.getByRole('button', { name: portal.changePassword }).click()
        await expect(page.getByRole('button', { name: portal.sending })).toBeVisible()
        expect(Math.abs((await widthOf(portal.sending)) - idle)).toBeLessThanOrEqual(1)
        await expect(page.getByRole('button', { name: portal.changePassword })).toBeVisible()
        expect(Math.abs((await widthOf(portal.changePassword)) - idle)).toBeLessThanOrEqual(1)
      })
    })

    test('the photo takes one Tab stop: the avatar is for pointers', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(ACCOUNT)
        const text = MESSAGES.en.ImageUpload
        const avatar = page.getByRole('button', {
          name: new RegExp(`^(${text.avatarChange}|${text.avatarUpload})$`),
        })
        await expect(avatar).toHaveAttribute('tabindex', '-1')
        await expect(
          page.getByRole('button', { name: new RegExp(`^(${text.upload}|${text.replace})$`) }),
        ).toBeVisible()
      })
    })

    test('the save bar clears the bottom bar at 390', async ({ browser }) => {
      await inContext(browser, { viewport: PHONE, role: 'student' }, async (page) => {
        await page.goto(ACCOUNT)
        await editName(page, 'en', uniq('Bar name'))
        const bar = saveBar(page, 'en')
        await expect(bar).toBeVisible()
        const bottomBar = page.getByRole('navigation', {
          name: MESSAGES.en.Portal.nav.label,
          exact: true,
        })
        await expect
          .poll(async () => {
            const [save, nav] = await Promise.all([bar.boundingBox(), bottomBar.boundingBox()])
            return save && nav ? nav.y - (save.y + save.height) : null
          })
          .toBeGreaterThanOrEqual(15.5)
      })
    })

    for (const locale of LOCALES)
      test(`at 390 the tab row stays put and no tab is cut off (${locale})`, async ({
        browser,
      }) => {
        await inContext(browser, { viewport: PHONE, role: 'student' }, async (page) => {
          await page.goto(localePath(ACCOUNT, locale))
          const list = page.getByRole('tablist')
          await expect(list).toBeVisible()
          const rowY: number[] = []
          const fits = async () => {
            const box = (await list.boundingBox())!
            for (const tabBox of await Promise.all(
              (await page.getByRole('tab').all()).map((node) => node.boundingBox()),
            )) {
              expect(tabBox!.x).toBeGreaterThanOrEqual(box.x - 0.5)
              expect(tabBox!.x + tabBox!.width).toBeLessThanOrEqual(box.x + box.width + 0.5)
            }
            expect(await list.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
          }
          await fits()
          await editName(page, locale, uniq('Phone name'))
          await expect(
            page.getByRole('button', { name: MESSAGES[locale].Settings.save, exact: true }),
          ).toBeVisible()
          await fits()
          for (const group of ['profile', 'signIn', 'notifications'] as const) {
            await tab(page, locale, group).click()
            await expect(tab(page, locale, group)).toHaveAttribute('aria-selected', 'true')
            rowY.push((await list.boundingBox())!.y)
          }
          expect(Math.max(...rowY) - Math.min(...rowY)).toBeLessThanOrEqual(1)
        })
      })

    test("the save bar on a wide screen sits 16 px above the viewport's bottom", async ({
      browser,
    }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(ACCOUNT)
        await editName(page, 'en', uniq('Wide name'))
        const bar = saveBar(page, 'en')
        await expect(bar).toBeVisible()
        await expect
          .poll(async () => {
            const box = await bar.boundingBox()
            return box ? DESKTOP.height - (box.y + box.height) : null
          })
          .toBeCloseTo(16, 0)
      })
    })

    for (const viewport of Object.values(WIDTHS))
      for (const role of ROLES)
        for (const locale of LOCALES)
          test(`axe finds no violation on the account page (${role} ${locale} ${viewport.width})`, async ({
            browser,
          }) => {
            await inContext(browser, { viewport, role }, async (page) => {
              const route = localePath(ACCOUNT, locale)
              await page.goto(route)
              await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
              expect(await axeOver(page, known(route, role, locale, viewport.width))).toEqual({})
            })
          })

    for (const locale of LOCALES)
      test(`reflow at 320 (${locale})`, async ({ browser }) => {
        await inContext(browser, { viewport: NARROW, role: 'student' }, async (page) => {
          await page.goto(localePath(ACCOUNT, locale))
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
          for (const group of ['profile', 'signIn', 'notifications'] as const) {
            await tab(page, locale, group).click()
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
            ).toBe(true)
          }
        })
      })

    test('a keyboard walk reaches the tabs, the profile fields, Change password and the save bar', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(ACCOUNT)
        const text = MESSAGES.en
        const tabUntil = async (matches: () => Promise<boolean>) => {
          for (let step = 0; step < 60; step++) {
            await page.keyboard.press('Tab')
            if (await matches()) return
          }
          throw new Error('the keyboard never reached the control')
        }
        await tab(page, 'en', 'profile').focus()
        const nameField = page.getByLabel(text.Profile.nameEn, { exact: true })
        await tabUntil(() => nameField.evaluate((node) => node === document.activeElement))
        await page.keyboard.type('x')
        const save = page.getByRole('button', { name: text.Settings.save, exact: true })
        await tabUntil(() => save.evaluate((node) => node === document.activeElement))

        await tab(page, 'en', 'profile').focus()
        await page.keyboard.press('ArrowDown')
        await expect(tab(page, 'en', 'signIn')).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(
          page.getByRole('button', { name: text.Portal.account.changePassword }),
        ).toBeFocused()
      })
    })
  })
})
