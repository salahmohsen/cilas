import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import { login } from '../testing/login.test-utils'
import { createTracker, uniq } from '../testing/payload.fixture'
import { calendarWorld, type CalendarWorld } from '../testing/portal-calendar.fixture'
import { axeOver, known } from '../testing/portal-e2e.test-utils'
import {
  holdSpacesMode,
  inContext as inContextAt,
  LOCALES,
  localePath,
  MESSAGES,
  ROLES,
  WIDTHS,
  type Locale,
  type PortalRole,
  type StorageState,
} from '../testing/portal.fixture'

type Viewport = { width: number; height: number }

const DESKTOP = WIDTHS.desktop
const PHONE = WIDTHS.phone

const WEEK = '2034-10-07'
const WEEK_VIEW = '?view=week&date=2034-10-11'
const THREE_DAYS = `?view=3days&date=${WEEK}`
const PAGE = '/en/spaces/calendar'

const { track, cleanup } = createTracker()
let payload: Payload
let world: CalendarWorld
let spaces: Awaited<ReturnType<typeof holdSpacesMode>>
let baseURL: string | undefined
const states = {} as Record<PortalRole, StorageState>
let token: string

const asAdmin = (path: string, method: 'PATCH' | 'DELETE', data?: object) =>
  fetch(`${baseURL}/api/${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `JWT ${token}` },
    body: data && JSON.stringify(data),
  })

const inContext = (
  browser: Browser,
  options: { viewport: Viewport; role: PortalRole },
  run: (page: Page) => Promise<void>,
) => inContextAt(browser, { baseURL, viewport: options.viewport, state: states[options.role] }, run)

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const block = (page: Page, title: string) => {
  const name = new RegExp(`^${escape(title)}(,|،)`)
  return page.getByRole('link', { name }).or(page.getByRole('button', { name })).first()
}

const panelButton = (page: Page, locale: Locale) =>
  page.getByRole('button', { name: MESSAGES[locale].CalendarUi.panel, exact: true })

const openLegend = async (page: Page, locale: Locale) => {
  const button = panelButton(page, locale)
  await expect(button).toBeVisible()
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click()
  const legend = page.getByRole('group', { name: MESSAGES[locale].CalendarUi.legend })
  await expect(legend).toBeVisible()
  return legend
}

const toggleOf = (legend: Locator, name: string) =>
  legend.getByRole('button', { name, exact: true })

const portalAt = (locale: Locale, query: string) => `${localePath(PAGE, locale)}${query}`

const signIn = async (page: Page, user: { email: string; password: string }) => {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

const hidden = async (page: Page, titles: string[]) => {
  for (const title of titles) await expect(block(page, title)).toHaveCount(0)
}

const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test.describe('portal calendar', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    baseURL = test.info().project.use.baseURL
    payload = await getPayload({ config, key: uniq('portal-calendar') })
    spaces = await holdSpacesMode(payload)
    await spaces.set('on')
    world = await calendarWorld(payload, track)
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
    const { email, password } = world.accounts.admin
    const signedIn = await fetch(`${baseURL}/api/users/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    token = ((await signedIn.json()) as { token: string }).token
    const saved = await asAdmin(`events/${world.event.id}?locale=en`, 'PATCH', {
      title: world.event.title,
    })
    expect(saved.ok).toBe(true)
    const { slug } = await payload.findByID({
      collection: 'events',
      id: world.event.id,
      depth: 0,
      overrideAccess: true,
    })
    for (const locale of LOCALES)
      await expect
        .poll(
          async () =>
            (
              await (await fetch(`${baseURL}/${locale}/calendar?view=week&date=2034-10-08`)).text()
            ).includes(String(slug)),
          { timeout: 60_000 },
        )
        .toBe(true)
  })

  test.afterAll(async () => {
    try {
      expect((await asAdmin(`events/${world.event.id}`, 'DELETE')).ok).toBe(true)
    } finally {
      try {
        await cleanup(payload)
      } finally {
        await spaces.release()
      }
    }
  })

  test.describe('preset and access (1440, en)', () => {
    test('as a student, only their courses and public events show at first', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(portalAt('en', WEEK_VIEW))
        await expect(block(page, world.communityCourse.title)).toBeVisible()
        await expect(block(page, world.event.title)).toBeVisible()
        await hidden(page, [world.other.title])
        const legend = await openLegend(page, 'en')
        await expect(toggleOf(legend, MESSAGES.en.Portal.calendar.otherCourses)).toHaveAttribute(
          'aria-pressed',
          'false',
        )
        await expect(toggleOf(legend, MESSAGES.en.Portal.calendar.yourCourses)).toHaveAttribute(
          'aria-pressed',
          'true',
        )
      })
    })

    test('turning Other courses on adds blocks', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(portalAt('en', WEEK_VIEW))
        const legend = await openLegend(page, 'en')
        await toggleOf(legend, MESSAGES.en.Portal.calendar.otherCourses).click()
        await expect(block(page, world.other.title)).toBeVisible()
      })
    })

    test('a student of a Community-tier course sees its sessions, with the public popover', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(portalAt('en', WEEK_VIEW))
        await block(page, world.communityCourse.title).click()
        const details = page.getByRole('dialog', { name: world.communityCourse.title })
        await expect(details).toBeVisible()
        await expect(details).toContainText(MESSAGES.en.Calendar.session.replace('{n}', '1'))
        await expect(details).toContainText(/7 – 9 PM/)
        await expect(
          details.getByRole('link', { name: MESSAGES.en.Calendar.viewCourse }),
        ).toBeVisible()
      })
    })

    test('a student never sees a course they do not take at Community tier, or an owner-tier course', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(portalAt('en', WEEK_VIEW))
        const legend = await openLegend(page, 'en')
        await toggleOf(legend, MESSAGES.en.Portal.calendar.otherCourses).click()
        await expect(block(page, world.other.title)).toBeVisible()
        await hidden(page, [
          world.stranger.title,
          world.pending.title,
          world.owner.title,
          world.draft.title,
        ])
      })
    })

    test('a fellow sees their unpublished course, with no View course link', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'fellow' }, async (page) => {
        await page.goto(portalAt('en', WEEK_VIEW))
        await expect(block(page, world.draft.title)).toBeVisible()
        await block(page, world.draft.title).click()
        const details = page.getByRole('dialog', { name: world.draft.title })
        await expect(details).toBeVisible()
        await expect(
          details.getByRole('link', { name: MESSAGES.en.Calendar.viewCourse }),
        ).toHaveCount(0)
        await expect(details).not.toContainText('course:')
        const legend = await openLegend(page, 'en')
        await expect(toggleOf(legend, MESSAGES.en.Portal.calendar.yourCourses)).toBeVisible()
        await expect(toggleOf(legend, MESSAGES.en.Portal.calendar.otherCourses)).toHaveAttribute(
          'aria-pressed',
          'false',
        )
        await expect(legend.getByText(/course:course/)).toHaveCount(0)
      })
    })

    test('an admin with no course sees every public course at first', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'admin' }, async (page) => {
        await page.goto(portalAt('en', WEEK_VIEW))
        await expect(block(page, world.other.title)).toBeVisible()
        const legend = await openLegend(page, 'en')
        await expect(toggleOf(legend, MESSAGES.en.Portal.calendar.otherCourses)).toHaveAttribute(
          'aria-pressed',
          'true',
        )
      })
    })

    test('the portal page has no Edit button and no Cancel session', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'admin' }, async (page) => {
        await page.goto(portalAt('en', WEEK_VIEW))
        await expect(block(page, world.other.title)).toBeVisible()
        await expect(
          page.getByRole('button', { name: MESSAGES.en.Calendar.edit, exact: true }),
        ).toHaveCount(0)
        await block(page, world.other.title).click()
        const details = page.getByRole('dialog', { name: world.other.title })
        await expect(details).toBeVisible()
        await expect(details.getByRole('button', { name: 'More actions' })).toHaveCount(0)
        await expect(page.getByText(MESSAGES.en.SessionEdit.cancelSession)).toHaveCount(0)
      })
    })

    test('the public calendar still hides the Community-tier course', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(`/en/calendar${WEEK_VIEW}`)
        await expect(block(page, world.other.title)).toBeVisible()
        await expect(block(page, world.event.title)).toBeVisible()
        await hidden(page, [world.communityCourse.title])
      })
    })

    test('signed out, the cached public calendar holds no Community-tier or draft session after the fellow loads their draft', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'fellow' }, async (page) => {
        await page.goto(portalAt('en', WEEK_VIEW))
        await expect(block(page, world.draft.title)).toBeVisible()
      })
      await inContextAt(browser, { baseURL, viewport: DESKTOP }, async (page) => {
        const response = await page.goto(`/en/calendar${WEEK_VIEW}`)
        expect(response?.ok()).toBe(true)
        const html = await response!.text()
        expect(html).toContain(world.other.title)
        expect(html).not.toContain(world.communityCourse.title)
        expect(html).not.toContain(world.draft.title)
        await expect(block(page, world.other.title)).toBeVisible()
        await expect(block(page, world.event.title)).toBeVisible()
        await hidden(page, [
          world.communityCourse.title,
          world.stranger.title,
          world.pending.title,
          world.draft.title,
          world.owner.title,
        ])
      })
    })

    test('signed out, /spaces/calendar returns to the portal home after login', async ({
      browser,
    }) => {
      await inContextAt(browser, { baseURL, viewport: DESKTOP }, async (page) => {
        await page.goto(PAGE)
        await page.waitForURL('**/en/login**')
        expect(new URL(page.url()).searchParams.get('next')).toBe('/en/spaces')
        await signIn(page, world.accounts.student)
        await page.waitForURL(/\/en\/spaces$/)
      })
    })

    test('each course kind has its edge, in the week and in the month', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(portalAt('en', WEEK_VIEW))
        const legend = await openLegend(page, 'en')
        await toggleOf(legend, MESSAGES.en.Portal.calendar.otherCourses).click()
        await expect(block(page, world.other.title)).toBeVisible()
        await expect(block(page, world.communityCourse.title)).toHaveAttribute('data-edge', 'solid')
        await expect(block(page, world.other.title)).toHaveAttribute('data-edge', 'double')
        await expect(block(page, world.event.title)).not.toHaveAttribute('data-edge', /.+/)
        await expect(
          toggleOf(legend, MESSAGES.en.Portal.calendar.yourCourses).locator('[data-edge="solid"]'),
        ).toHaveCount(1)
        await expect(
          toggleOf(legend, MESSAGES.en.Portal.calendar.otherCourses).locator(
            '[data-edge="double"]',
          ),
        ).toHaveCount(1)

        await page
          .getByRole('group', { name: MESSAGES.en.CalendarUi.view })
          .getByRole('button', { name: 'Month', exact: true })
          .click()
        await expect(block(page, world.communityCourse.title)).toHaveAttribute('data-edge', 'solid')
        await expect(block(page, world.other.title)).toHaveAttribute('data-edge', 'double')
        await expect(block(page, world.event.title)).not.toHaveAttribute('data-edge', /.+/)
      })
    })

    test('a course block names its kind', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        const portal = MESSAGES.en.Portal.calendar
        await page.goto(portalAt('en', WEEK_VIEW))
        await expect(block(page, world.communityCourse.title)).toHaveAccessibleName(
          new RegExp(`^${escape(world.communityCourse.title)}, .*${portal.yourCourses}`),
        )
        const legend = await openLegend(page, 'en')
        await toggleOf(legend, portal.otherCourses).click()
        await expect(block(page, world.other.title)).toHaveAccessibleName(
          new RegExp(`^${escape(world.other.title)}, .*${portal.otherCourses}`),
        )
        const eventName = (await block(page, world.event.title).getAttribute('aria-label')) ?? ''
        expect(eventName).not.toContain(portal.yourCourses)
        expect(eventName).not.toContain(portal.otherCourses)
      })
    })
  })

  test.describe('URL and Arabic week', () => {
    test('the view and date stay in the URL, and Back follows them', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(portalAt('en', WEEK_VIEW))
        await expect(block(page, world.communityCourse.title)).toBeVisible()
        const view = page.getByRole('group', { name: MESSAGES.en.CalendarUi.view })
        await view.getByRole('button', { name: 'Month', exact: true }).click()
        await expect(page).toHaveURL(/view=month/)
        await page.getByRole('button', { name: 'Next month', exact: true }).click()
        await expect(page).toHaveURL(/view=month&date=2034-11-/)
        expect(new URL(page.url()).pathname).toBe(PAGE)
        await page.goBack()
        await expect(page).toHaveURL(/view=month&date=2034-10-/)
        await page.goBack()
        await expect(page).toHaveURL(/view=week&date=2034-10-11/)
        await expect(block(page, world.communityCourse.title)).toBeVisible()
        await expect(block(page, world.event.title)).toBeVisible()
        expect(new URL(page.url()).pathname).toBe(PAGE)
      })
    })

    test('in Arabic the week starts on Saturday on the right (1440)', async ({ browser }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(portalAt('ar', WEEK_VIEW))
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(MESSAGES.ar.Calendar.title)
        const tracks = await page.locator('[data-track]').evaluateAll((els) =>
          els.map((el) => ({
            day: el.getAttribute('data-track')!,
            x: el.getBoundingClientRect().x,
          })),
        )
        expect(tracks.map((track) => track.day)[0]).toBe(WEEK)
        const rightmost = tracks.reduce((best, track) => (track.x > best.x ? track : best))
        expect(rightmost.day).toBe(WEEK)
      })
    })

    test('in Arabic at 390 the first day of the run is on the right', async ({ browser }) => {
      await inContext(browser, { viewport: PHONE, role: 'student' }, async (page) => {
        await page.goto(portalAt('ar', '?view=3days&date=2034-10-11'))
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(MESSAGES.ar.Calendar.title)
        await expect(page.locator('[data-track]').first()).toBeVisible()
        const tracks = await page.locator('[data-track]').evaluateAll((els) =>
          els.map((el) => ({
            day: el.getAttribute('data-track')!,
            x: el.getBoundingClientRect().x,
          })),
        )
        const sorted = tracks.toSorted((a, b) => a.x - b.x).map((track) => track.day)
        expect(sorted[0]).toBe('2034-10-13')
        expect(sorted.at(-1)).toBe('2034-10-11')
        expect(await noSideScroll(page)).toBe(true)
      })
    })
  })

  test.describe('accessibility and layout', () => {
    test('axe finds no violation on the Calendar page (week and month, light and dark, 1440)', async ({
      browser,
    }) => {
      for (const colorScheme of ['light', 'dark'] as const)
        for (const query of [WEEK_VIEW, '?view=month&date=2034-10-11']) {
          const context = await browser.newContext({
            baseURL,
            viewport: DESKTOP,
            storageState: states.student,
            colorScheme,
          })
          try {
            const page = await context.newPage()
            const route = portalAt('en', query)
            await page.goto(route)
            await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
            await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
            await expect(block(page, world.communityCourse.title)).toBeVisible()
            expect(
              await axeOver(page, known(route.split('?')[0]!, 'student', 'en', DESKTOP.width)),
              `${colorScheme} ${query}`,
            ).toEqual({})
          } finally {
            await context.close()
          }
        }
    })

    test('at 390 a student can turn Other courses on in the legend', async ({ browser }) => {
      await inContext(browser, { viewport: PHONE, role: 'student' }, async (page) => {
        await page.goto(portalAt('en', THREE_DAYS))
        await expect(block(page, world.communityCourse.title)).toBeVisible()
        await expect(block(page, world.event.title)).toBeVisible()
        await hidden(page, [world.other.title])
        const legend = await openLegend(page, 'en')
        const other = toggleOf(legend, MESSAGES.en.Portal.calendar.otherCourses)
        await expect(other).toHaveAttribute('aria-pressed', 'false')
        await other.click()
        await expect(other).toHaveAttribute('aria-pressed', 'true')
        await expect(block(page, world.other.title)).toBeVisible()
      })
    })

    test('at 390 the public legend can hide and show events', async ({ browser }) => {
      await inContextAt(browser, { baseURL, viewport: PHONE }, async (page) => {
        await page.goto(`/en/calendar${THREE_DAYS}`)
        const event = block(page, world.event.title)
        await expect(event).toBeVisible()
        const legend = await openLegend(page, 'en')
        const talk = toggleOf(legend, MESSAGES.en.Calendar.eventTypes.talk)
        await talk.click()
        await expect(event).toHaveCount(0)
        await talk.click()
        await expect(event).toBeVisible()
      })
    })

    test('axe finds no violation at 390 with the legend open', async ({ browser }) => {
      await inContext(browser, { viewport: PHONE, role: 'student' }, async (page) => {
        await page.goto(portalAt('en', THREE_DAYS))
        await expect(block(page, world.communityCourse.title)).toBeVisible()
        await openLegend(page, 'en')
        expect(await axeOver(page, known(PAGE, 'student', 'en', PHONE.width))).toEqual({})
      })
    })

    test('a keyboard walk reaches the legend toggles, a block and its popover', async ({
      browser,
    }) => {
      await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
        await page.goto(portalAt('en', WEEK_VIEW))
        const target = block(page, world.communityCourse.title)
        await expect(target).toBeVisible()
        await target.focus()
        await page.keyboard.press('Enter')
        const details = page.getByRole('dialog', { name: world.communityCourse.title })
        await expect(details).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(details).toHaveCount(0)
        await expect(target).toBeFocused()
        const legend = await openLegend(page, 'en')
        await toggleOf(legend, MESSAGES.en.Portal.calendar.yourCourses).focus()
        await page.keyboard.press('ArrowDown')
        await expect(legend.getByRole('button').nth(1)).toBeFocused()
      })
    })

    for (const locale of LOCALES)
      test(`reflow at 320 (${locale})`, async ({ browser }) => {
        await inContext(
          browser,
          { viewport: { width: 320, height: 640 }, role: 'student' },
          async (page) => {
            await page.goto(portalAt(locale, THREE_DAYS))
            await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
            expect(await noSideScroll(page)).toBe(true)
          },
        )
      })

    test('the page loads with spaces off', async ({ browser }) => {
      await spaces.set('off')
      try {
        await inContext(browser, { viewport: DESKTOP, role: 'student' }, async (page) => {
          await page.goto(portalAt('en', WEEK_VIEW))
          await expect(block(page, world.communityCourse.title)).toBeVisible()
        })
      } finally {
        await spaces.set('on')
      }
    })
  })
})
