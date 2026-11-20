import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import { consentAccept } from '../src/lib/spaces-write'
import config from '../src/payload.config.js'
import { login } from '../testing/login.test-utils'
import { createTracker, uniq, uniqEmail } from '../testing/payload.fixture'

const LOCALES = ['en', 'ar'] as const
const WIDTHS = [1440, 390] as const
const DIRECTIONS = { en: 'ltr', ar: 'rtl' } as const
const ACCOUNT_ROLES = { admin: ['admin'], fellow: ['fellow'], student: ['member'] } as const
const PASSWORD = 'e2e-site-frame'

type Locale = (typeof LOCALES)[number]
type Role = keyof typeof ACCOUNT_ROLES
type State = Awaited<ReturnType<BrowserContext['storageState']>>

const { track, cleanup } = createTracker()
let payload: Payload
let baseURL: string | undefined
const states = {} as Record<Role, State>
const articles = {} as Record<Locale, string>

const inContext = async (
  browser: Browser,
  options: { width: number; state?: State },
  run: (page: Page) => Promise<void>,
) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: options.width, height: 900 },
    storageState: options.state,
  })
  try {
    await run(await context.newPage())
  } finally {
    await context.close()
  }
}

const firstArticlePath = async (page: Page, locale: Locale) => {
  await page.goto(`/${locale}`)
  const href = await page
    .locator(`main a[href^="/${locale}/articles/"]`)
    .first()
    .getAttribute('href')
  expect(href).not.toBeNull()
  return href!
}

const expectFrame = async (
  page: Page,
  locale: Locale,
  expected: { status: number; ld: number; deadlines: number },
  status: number,
) => {
  expect(status).toBe(expected.status)
  await expect(page.locator('header.site-header')).toHaveCount(1)
  await expect(page.locator('header.site-header')).toBeVisible()
  await expect(page.locator('main.max-w-page')).toHaveCount(1)
  await expect(page.getByRole('contentinfo')).toBeVisible()
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(expected.ld)
  await expect(page.locator('.deadline-message')).toHaveCount(expected.deadlines)
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
  await expect(page.locator('html')).toHaveAttribute('dir', DIRECTIONS[locale])
}

const SIGNED_OUT = [
  { name: 'home', open: (locale: Locale) => `/${locale}`, status: 200, ld: 1, deadlines: 0 },
  { name: 'an article', open: 'article', status: 200, ld: 2, deadlines: 0 },
  { name: 'login', open: (locale: Locale) => `/${locale}/login`, status: 200, ld: 1, deadlines: 0 },
  {
    name: 'a welcome page',
    open: (locale: Locale) => `/${locale}/welcome/e2e-token`,
    status: 200,
    ld: 1,
    deadlines: 0,
  },
  {
    name: 'a page that does not exist',
    open: (locale: Locale) => `/${locale}/e2e-no-such-page`,
    status: 404,
    ld: 1,
    deadlines: 0,
  },
] as const

const SIGNED_IN = [
  { name: 'home', open: (locale: Locale) => `/${locale}`, ld: 1, deadlines: 0 },
  { name: 'an article', open: 'article', ld: 2, deadlines: 0 },
] as const

test.describe('site frame', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    baseURL = test.info().project.use.baseURL
    payload = await getPayload({ config, key: uniq('site-frame') })
    for (const locale of LOCALES)
      await inContext(browser, { width: WIDTHS[0] }, async (page) => {
        articles[locale] = await firstArticlePath(page, locale)
      })
    for (const role of Object.keys(ACCOUNT_ROLES) as Role[]) {
      const email = uniqEmail(`site-frame-${role}`)
      const user = track(
        'users',
        await payload.create({
          collection: 'users',
          data: { email, password: PASSWORD, roles: [...ACCOUNT_ROLES[role]] },
          overrideAccess: true,
        }),
      )
      expect({ role, roles: user.roles, person: user.person != null }).toEqual({
        role,
        roles: [...ACCOUNT_ROLES[role]],
        person: role !== 'admin',
      })
      expect((await consentAccept({ payload, user })).ok).toBe(true)
      const context = await browser.newContext({ baseURL })
      try {
        await login({
          page: await context.newPage(),
          user: { email, password: PASSWORD },
          next: '/en/contact',
        })
        states[role] = await context.storageState()
      } finally {
        await context.close()
      }
    }
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    await cleanup(payload)
    await payload.destroy()
  })

  for (const locale of LOCALES)
    for (const width of WIDTHS)
      for (const row of SIGNED_OUT)
        test(`${row.name} keeps the site header, main and footer (${locale} ${width})`, async ({
          browser,
        }) => {
          await inContext(browser, { width }, async (page) => {
            const path = row.open === 'article' ? articles[locale] : row.open(locale)
            const response = await page.goto(path)
            await expectFrame(page, locale, row, response!.status())
          })
        })

  for (const role of Object.keys(ACCOUNT_ROLES) as Role[])
    for (const locale of LOCALES)
      for (const width of WIDTHS)
        for (const row of SIGNED_IN)
          test(`${row.name} keeps the site header, main and footer (signed in as ${role}, ${locale} ${width})`, async ({
            browser,
          }) => {
            await inContext(browser, { width, state: states[role] }, async (page) => {
              const path = row.open === 'article' ? articles[locale] : row.open(locale)
              const response = await page.goto(path)
              await expectFrame(page, locale, { ...row, status: 200 }, response!.status())
            })
          })
})
