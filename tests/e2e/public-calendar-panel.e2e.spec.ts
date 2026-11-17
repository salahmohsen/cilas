import { expect, test, type Locator, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import { createTracker, lockSpacesMode, uniq, uniqEmail } from '../int/fixtures'

/**
 * The public calendar's side panel (decisions 22 to 25): the Month view opens on
 * the selected day, a press on a day selects it and writes `date` with
 * replaceState, an item's details replace the day with Back and Escape and
 * focus return, and a host or admin cancels a session from the "⋯" menu after
 * a confirm. It works on courses made for the run, in 2035, and removes them.
 */
const { track, cleanup } = createTracker()
let payload: Payload
let unlock: (() => Promise<void>) | undefined
let modeBefore: 'off' | 'trial' | 'on' = 'off'
const password = crypto.randomUUID()
const accounts: Record<'admin' | 'host' | 'student' | 'outsider', string> = {
  admin: uniqEmail('panel-admin'),
  host: uniqEmail('panel-host'),
  student: uniqEmail('panel-student'),
  outsider: uniqEmail('panel-outsider'),
}
let courseA: number
let courseB: number
let spaceHref: string
/** The study-page slug of each course. */
const slugs = { a: '', b: '' }
const sessions: Record<'a1' | 'a2' | 'b1', number> = { a1: 0, a2: 0, b1: 0 }
const MONTH = '/en/calendar?view=month&date=2035-10-04'
const day = (page: Page, date: string) => page.locator(`[role="gridcell"][data-day="${date}"]`)
const chip = (page: Page, date: string, title: string) =>
  page
    .locator(`[role="gridcell"][data-day="${date}"] [data-block-id][aria-label^="${title}"]`)
    .first()
const panel = (page: Page) => page.locator('[class*="panelBody"]')
const shot = async (page: Page, name: string) => {
  if (process.env.D22_SHOTS) await page.screenshot({ path: `${process.env.D22_SHOTS}/${name}.png` })
}

/**
 * Opens the "⋯" menu. Right after a dialog closes, the page still ignores a
 * press for a frame or two (the modal's pointer lock), so a first press can
 * land on nothing; the press repeats until the menu shows.
 */
const openMore = async (scope: Page | Locator) => {
  const more = scope.getByRole('button', { name: 'More actions' })
  await expect(async () => {
    if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click({ timeout: 2_000 })
    await expect(more).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
}

const as = async (browser: import('@playwright/test').Browser, who: keyof typeof accounts) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 1440, height: 900 },
  })
  const response = await context.request.post('/api/users/login', {
    data: { email: accounts[who], password },
  })
  expect(response.ok()).toBe(true)
  return { context, page: await context.newPage() }
}

test.describe('the public calendar side panel', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async () => {
    test.setTimeout(300_000)
    unlock = await lockSpacesMode()
    payload = await getPayload({ config, key: uniq('public-calendar-panel') })
    modeBefore =
      (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })).spaces_mode ??
      'off'
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
    const person = async (name: string, label: string) =>
      track(
        'people',
        await payload.create({
          collection: 'people',
          data: { name, slug: uniq(`panel-${label}`) },
          overrideAccess: true,
        }),
      )
    const user = async (who: keyof typeof accounts, roles: ('admin' | 'member')[], id: number) =>
      track(
        'users',
        await payload.create({
          collection: 'users',
          data: { email: accounts[who], password, roles, person: id },
          overrideAccess: true,
        }),
      )
    const admin = await person('Panel admin', 'admin')
    const host = await person('Panel host', 'host')
    const student = await person('Panel student', 'student')
    const outsider = await person('Panel outsider', 'outsider')
    await user('admin', ['admin'], admin.id)
    await user('host', ['member'], host.id)
    await user('student', ['member'], student.id)
    await user('outsider', ['member'], outsider.id)
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Panel place', slug: uniq('panel-place'), city: uniq('Probe') },
        overrideAccess: true,
      }),
    ).id
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2035, start_date: '2035-10-01', place },
        overrideAccess: true,
      }),
    ).id
    const course = async (title: string, fellows: number[]) => {
      const slug = uniq(`panel-${title.toLowerCase().replace(/\W+/g, '-')}`)
      const made = track(
        'courses',
        await payload.create({
          collection: 'courses',
          data: {
            title,
            slug,
            course_type: 'THEMATIC',
            tier: 'public',
            cycle,
            fellows,
            registration: { mode: 'closed' },
            _status: 'published',
          },
          overrideAccess: true,
        }),
      )
      return { id: made.id, slug }
    }
    const a = await course('Panel course A', [host.id])
    const b = await course('Panel course B', [])
    courseA = a.id
    courseB = b.id
    slugs.a = a.slug
    slugs.b = b.slug
    spaceHref = `/en/spaces/course/${a.slug}`
    track(
      'enrollments',
      await payload.create({
        collection: 'enrollments',
        data: { course: courseA, person: student.id, status: 'confirmed', source: 'admin' },
        overrideAccess: true,
      }),
    )
    for (const id of [courseA, courseB]) {
      const spaces = await payload.find({
        collection: 'spaces',
        where: { course: { equals: id } },
        depth: 0,
        overrideAccess: true,
      })
      for (const space of spaces.docs) {
        track('spaces', space.id)
        const posts = await payload.find({
          collection: 'space-posts',
          where: { space: { equals: space.id } },
          depth: 0,
          pagination: false,
          overrideAccess: true,
        })
        for (const post of posts.docs) track('space-posts', post.id)
      }
    }
    const session = async (course: number, title: string, date: string, from: string, to: string) =>
      (
        await payload.create({
          collection: 'sessions',
          data: {
            course,
            title,
            description: 'About the panel.',
            meetings: [{ date, start_time: from, end_time: to }],
          },
          overrideAccess: true,
        })
      ).id
    sessions.a1 = await session(courseA, 'Panel one', '2035-10-04', '10:00', '12:00')
    sessions.a2 = await session(courseA, 'Panel two', '2035-10-04', '18:00', '20:00')
    sessions.b1 = await session(courseB, 'Panel course B', '2035-10-06', '10:00', '12:00')
    // The calendar list is cached for an hour and cleared by the app's own saves, not by this process.
    // A save through the running app (the same title) clears it, so the visitor reads the new sessions.
    const base = test.info().project.use.baseURL!
    const login = await fetch(`${base}/api/users/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: accounts.admin, password }),
    })
    const { token } = (await login.json()) as { token: string }
    const touched = await fetch(`${base}/api/sessions/${sessions.b1}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `JWT ${token}` },
      body: JSON.stringify({ title: 'Panel course B' }),
    })
    expect(touched.ok).toBe(true)
    // The app clears the list stale-while-revalidate: a read serves the old list once, then the new one.
    // Each language keeps its own list, and the title alone matches a list of an earlier run, so
    // the wait is for this run's course page link.
    for (const locale of ['en', 'ar']) {
      await expect
        .poll(
          async () =>
            (await (await fetch(`${base}/${locale}${MONTH.slice(3)}`)).text()).includes(
              `/study/${slugs.b}`,
            ),
          { timeout: 60_000 },
        )
        .toBe(true)
    }
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    for (const id of Object.values(sessions))
      if (id) await payload.delete({ collection: 'sessions', id, overrideAccess: true })
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: modeBefore },
      overrideAccess: true,
    })
    await cleanup(payload)
    await payload.destroy()
    await unlock?.()
  })

  test('a visitor sees the selected day open in the panel, and nothing for an empty day', async ({
    page,
  }) => {
    await page.goto(MONTH)
    await expect(page.locator('[class*="layout"]')).toHaveAttribute('data-panel', 'auto')
    const section = page.getByRole('region', { name: 'Thursday, October 4' })
    await expect(section).toBeVisible()
    await expect(section.getByText('2 meetings')).toBeVisible()
    await expect(section.getByRole('button')).toHaveCount(2)
    await shot(page, 'default-day')
    await day(page, '2035-10-05').click({ position: { x: 20, y: 70 } })
    await expect(page.getByRole('region', { name: 'Friday, October 5' })).toContainText(
      'Nothing on Friday, October 5',
    )
    await expect(panel(page)).toContainText('Panel course B')
    await shot(page, 'empty-day')
    await expect(panel(page)).not.toContainText(/free|booked/i)
  })

  test('a press on a day selects it and replaces the URL, so Back does not step through days', async ({
    page,
  }) => {
    await page.goto(MONTH)
    const before = await page.evaluate(() => history.length)
    await day(page, '2035-10-05').click({ position: { x: 20, y: 70 } })
    await expect(day(page, '2035-10-05')).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/view=month&date=2035-10-05$/)
    await day(page, '2035-10-06').click({ position: { x: 20, y: 70 } })
    await expect(page).toHaveURL(/date=2035-10-06$/)
    expect(await page.evaluate(() => history.length)).toBe(before)
    await expect(page.locator('p[role="status"][class*="srOnly"]')).toContainText(
      'Saturday, October 6: 1 meeting',
    )
    await shot(page, 'selected-day')
    await page.reload()
    await expect(day(page, '2035-10-06')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('region', { name: 'Saturday, October 6' })).toBeVisible()
  })

  test('the keyboard selects with Enter and Space, moves focus with the arrows, enters chips with F2', async ({
    page,
  }) => {
    await page.goto(MONTH)
    // Selected means hydrated: a focus before that would not reach the grid.
    await expect(day(page, '2035-10-04')).toHaveAttribute('aria-selected', 'true')
    const cell = day(page, '2035-10-05')
    await cell.focus()
    await page.keyboard.press('Enter')
    await expect(cell).toHaveAttribute('aria-selected', 'true')
    await expect(cell).toBeFocused()
    // The grid takes its tab stop from the selected day once the day is written to the URL.
    await expect(page).toHaveURL(/date=2035-10-05$/)
    await page.keyboard.press('ArrowLeft')
    await expect(day(page, '2035-10-04')).toBeFocused()
    await expect(cell).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Space')
    await expect(day(page, '2035-10-04')).toHaveAttribute('aria-selected', 'true')
    await expect(day(page, '2035-10-04')).toBeFocused()
    await page.keyboard.press('F2')
    await expect(chip(page, '2035-10-04', 'Panel course A')).toBeFocused()
  })

  test('details replace the day: focus on the heading, Back and Escape return it to the chip', async ({
    page,
  }) => {
    await page.goto(MONTH)
    const block = chip(page, '2035-10-04', 'Panel course A')
    await block.click()
    const details = page.getByRole('region', { name: 'Panel course A' })
    await expect(details.getByRole('heading', { name: 'Panel course A' })).toBeFocused()
    await expect(details).toContainText('10 AM')
    await expect(details).toContainText('2 hr')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(details.getByRole('link', { name: 'View course' })).toBeVisible()
    await expect(details.getByRole('button', { name: 'More actions' })).toHaveCount(0)
    await shot(page, 'details-visitor')
    await page.getByRole('button', { name: 'Back to Thursday, October 4' }).click()
    await expect(page.getByRole('region', { name: 'Thursday, October 4' })).toBeVisible()
    await expect(block).toBeFocused()
    await block.click()
    await expect(page.getByRole('region', { name: 'Panel course A' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('region', { name: 'Thursday, October 4' })).toBeVisible()
    await expect(block).toBeFocused()
  })

  test('a calendar narrower than 56rem keeps the popover and the Day view for "N more"', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 900 })
    await page.goto(MONTH)
    // The server's render assumes a docked panel (`data-panel="auto"`); the layout settles
    // closed once the browser has measured the narrow frame.
    await expect(page.locator('[data-slot="collapsible"][class*="layout"]')).toHaveAttribute(
      'data-closed',
      '',
    )
    await expect(panel(page)).toBeHidden()
    await chip(page, '2035-10-04', 'Panel course A').click()
    await expect(page.getByRole('dialog', { name: 'Panel course A' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Back to/ })).toHaveCount(0)
  })

  test('a student who may not read the space gets View course only, an enrolled one also Go to space', async ({
    browser,
  }) => {
    const outsider = await as(browser, 'outsider')
    await outsider.page.goto(MONTH)
    await chip(outsider.page, '2035-10-04', 'Panel course A').click()
    const none = outsider.page.getByRole('region', { name: 'Panel course A' })
    await expect(none.getByRole('link', { name: 'View course' })).toBeVisible()
    await outsider.page.waitForTimeout(1500)
    await expect(none.getByRole('link', { name: 'Go to space' })).toHaveCount(0)
    await expect(none.getByRole('button', { name: 'More actions' })).toHaveCount(0)
    await outsider.context.close()

    const student = await as(browser, 'student')
    await student.page.goto(MONTH)
    await chip(student.page, '2035-10-04', 'Panel course A').click()
    const links = student.page.getByRole('region', { name: 'Panel course A' }).getByRole('link')
    await expect(links.nth(1)).toHaveAttribute('href', spaceHref)
    await expect(links.first()).toHaveAttribute(
      'href',
      /\/study\/panel-panel-course-a-[0-9a-f]{8}#session-\d+$/,
    )
    await expect(student.page.getByRole('button', { name: 'More actions' })).toHaveCount(0)
    await shot(student.page, 'details-student')
    await student.context.close()
  })

  for (const locale of ['en', 'ar'] as const) {
    test(`View course lands on its session in the syllabus, open and focused (${locale})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/${locale}/calendar?view=month&date=2035-10-04`)
      await day(page, '2035-10-04').locator('[data-block-id]').first().click()
      const link = page.getByRole('region', { name: 'Panel course A' }).getByRole('link').first()
      await link.click()
      await expect(page).toHaveURL(
        new RegExp(`/${locale}/study/${slugs.a}#session-${sessions.a1}$`),
      )
      const toggle = page.locator(`#session-${sessions.a1} button[aria-expanded="true"]`).first()
      await expect(toggle).toBeVisible()
      await expect(toggle).toBeFocused()
    })
  }

  test('Back from the course page returns to the calendar on the same date', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(MONTH)
    await day(page, '2035-10-06').click({ position: { x: 20, y: 70 } })
    await expect(page).toHaveURL(/date=2035-10-06$/)
    await chip(page, '2035-10-06', 'Panel course B').click()
    await page.getByRole('region', { name: 'Panel course B' }).getByRole('link').first().click()
    await expect(page).toHaveURL(new RegExp(`/en/study/${slugs.b}#session-${sessions.b1}$`))
    await page.goBack()
    await expect(page).toHaveURL(/\/en\/calendar\?view=month&date=2035-10-06$/)
    await expect(day(page, '2035-10-06')).toHaveAttribute('aria-selected', 'true')
  })

  test('View course is one link in the accessibility tree, in the panel and in the popover', async ({
    page,
  }) => {
    const named = async () => {
      const tree = await page.getByRole('region', { name: 'Panel course A' }).ariaSnapshot()
      return tree.match(/View course/g)?.length ?? 0
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(MONTH)
    await chip(page, '2035-10-04', 'Panel course A').click()
    await expect(
      page
        .getByRole('region', { name: 'Panel course A' })
        .getByRole('link', { name: 'View course' }),
    ).toHaveCount(1)
    expect(await named()).toBe(1)

    await page.setViewportSize({ width: 900, height: 900 })
    await page.goto(MONTH)
    await chip(page, '2035-10-04', 'Panel course A').click()
    const popover = page.getByRole('dialog', { name: 'Panel course A' })
    await expect(popover.getByRole('link', { name: 'View course' })).toHaveCount(1)
    expect((await popover.ariaSnapshot()).match(/View course/g)?.length ?? 0).toBe(1)
  })

  test('"⋯" opens its menu inside the popover, which stays open, and Escape closes one layer at a time', async ({
    browser,
  }) => {
    const host = await as(browser, 'host')
    const { page } = host
    await page.setViewportSize({ width: 900, height: 900 })
    await page.goto(MONTH)
    const block = chip(page, '2035-10-04', 'Panel course A')
    await block.click()
    const popover = page.getByRole('dialog', { name: 'Panel course A' })
    const more = popover.getByRole('button', { name: 'More actions' })
    await more.click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(popover).toBeVisible()
    await shot(page, 'popover-menu')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(popover).toBeVisible()
    await expect(more).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)
    await expect(block).toBeFocused()
    await host.context.close()
  })

  test('"⋯" opens its menu in the session drawer too, and Escape closes only the menu', async ({
    browser,
  }) => {
    const admin = await as(browser, 'admin')
    const { page } = admin
    await page.goto(`${spaceHref}?open=${sessions.a1}`)
    const drawer = page.getByRole('dialog', { name: 'Panel one' })
    const more = drawer.getByRole('button', { name: 'More actions' })
    await more.click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(drawer).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(drawer).toBeVisible()
    await expect(more).toBeFocused()
    await admin.context.close()
  })

  test('a host cancels only their own course, after a confirm', async ({ browser }) => {
    const host = await as(browser, 'host')
    const { page } = host
    await page.goto(MONTH)
    await chip(page, '2035-10-06', 'Panel course B').click()
    await expect(
      page
        .getByRole('region', { name: 'Panel course B' })
        .getByRole('link', { name: 'View course' }),
    ).toBeVisible()
    await page.waitForTimeout(1500)
    await expect(page.getByRole('button', { name: 'More actions' })).toHaveCount(0)
    await page.getByRole('button', { name: /^Back to/ }).click()

    await chip(page, '2035-10-04', 'Panel course A').click()
    await openMore(page)
    await expect(page.getByRole('menuitem')).toHaveCount(1)
    await page.getByRole('menuitem', { name: 'Cancel session' }).click()
    const ask = page.getByRole('dialog', { name: 'Cancel this session?' })
    await expect(ask.getByRole('button', { name: 'Keep session' })).toBeFocused()
    await shot(page, 'cancel-confirm')
    await page.keyboard.press('Escape')
    await expect(ask).toHaveCount(0)
    expect(
      (await payload.findByID({ collection: 'sessions', id: sessions.a1 })).cancelled,
    ).toBeFalsy()

    await openMore(page)
    await page.getByRole('menuitem', { name: 'Cancel session' }).click()
    await ask.getByRole('button', { name: 'Keep session' }).click()
    await expect(ask).toHaveCount(0)
    expect(
      (await payload.findByID({ collection: 'sessions', id: sessions.a1 })).cancelled,
    ).toBeFalsy()

    await openMore(page)
    await page.getByRole('menuitem', { name: 'Cancel session' }).click()
    await ask.getByRole('button', { name: 'Cancel session' }).click()
    await expect(ask).toHaveCount(0)
    await expect
      .poll(
        async () => (await payload.findByID({ collection: 'sessions', id: sessions.a1 })).cancelled,
      )
      .toBe(true)
    const kept = await payload.findByID({ collection: 'sessions', id: sessions.a1, depth: 0 })
    expect(kept.title).toBe('Panel one')
    expect(kept.description).toBe('About the panel.')
    expect(kept.meetings?.[0]?.start_time).toBe('10:00')
    await host.context.close()
  })

  test('an admin has no Edit session in the panel, and cancels and restores with the offer each time', async ({
    browser,
  }) => {
    const admin = await as(browser, 'admin')
    const { page } = admin
    const cancelled = async () =>
      (await payload.findByID({ collection: 'sessions', id: sessions.a2 })).cancelled
    await page.goto(MONTH)
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    await page.locator('[role="gridcell"][data-day="2035-10-04"] [data-block-id]').nth(1).click()
    const details = page.getByRole('region', { name: 'Panel course A' })
    await expect(details).toContainText('6 – 8 PM')
    await expect(details.getByRole('button', { name: /Edit session/ })).toHaveCount(0)
    await shot(page, 'details-admin')
    const offer = page.getByRole('dialog', { name: 'Announce this change?' })

    await openMore(details)
    await expect(page.getByRole('menuitem')).toHaveCount(1)
    await page.getByRole('menuitem', { name: 'Cancel session' }).click()
    await page
      .getByRole('dialog', { name: 'Cancel this session?' })
      .getByRole('button', { name: 'Cancel session' })
      .click()
    await expect.poll(cancelled).toBe(true)
    await expect(offer).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await offer.getByRole('button', { name: 'Skip', exact: true }).click()
    await expect(offer).toHaveCount(0)

    await expect(details).toContainText('Cancelled')
    await openMore(details)
    await page.getByRole('menuitem', { name: 'Restore session' }).click()
    await expect(page.getByRole('dialog', { name: 'Cancel this session?' })).toHaveCount(0)
    await expect.poll(cancelled).toBe(false)
    await expect(offer).toBeVisible()
    await offer.getByRole('button', { name: 'Skip', exact: true }).click()
    await admin.context.close()
  })
})
