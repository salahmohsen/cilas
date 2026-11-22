import path from 'node:path'

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
const PHOTO = path.resolve('testing/files/pixel.png')

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
  return page.getByRole('tab', { name: label, exact: true })
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

  test('a photo change shows in the account menu avatar', async ({ browser }) => {
    await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
      await page.goto('/en/spaces/account')
      const avatar = accountButton(page).locator('img')
      const srcNow = async () =>
        (await avatar.count()) ? avatar.first().getAttribute('src') : null
      const before = await srcNow()

      const group = page.getByRole('group', { name: MESSAGES.en.ImageUpload.avatarLabel })
      await group.locator('input[type="file"]').setInputFiles(PHOTO)
      await page.getByRole('button', { name: MESSAGES.en.ImageUpload.save }).click()
      await expect(page.getByText(MESSAGES.en.ImageUpload.updated).first()).toBeVisible()

      await expect.poll(srcNow, { timeout: 15_000 }).not.toBe(before)
    })
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

    test('signed out, /spaces/account returns to the account page after login', async ({
      browser,
    }) => {
      await inContextAt(browser, { baseURL, viewport: DESKTOP }, async (page) => {
        await page.goto(ACCOUNT)
        await page.waitForURL('**/en/login**')
        await signIn(page, world.accounts.student)
        await page.waitForURL('**/en/spaces/account')
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
        await page.goto(ACCOUNT)
        await editName(page, 'en', name)
        await page.getByRole('button', { name: MESSAGES.en.Settings.save, exact: true }).click()
        await expect(saveBar(page, 'en')).toBeHidden()
        await page.reload()
        await expect(page.getByLabel(MESSAGES.en.Profile.nameEn, { exact: true })).toHaveValue(name)
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

    test('Change password says where the link went', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.route('**/api/users/forgot-password', (route) =>
          route.fulfill({ status: 200, json: {} }),
        )
        await page.goto(`${ACCOUNT}#sign-in`)
        const portal = MESSAGES.en.Portal.account
        await page.getByRole('button', { name: portal.changePassword }).click()
        await expect(
          page.getByText(portal.resetSent.replace('{email}', world.accounts.student.email)),
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
