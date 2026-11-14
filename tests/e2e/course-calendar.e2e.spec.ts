import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { createTracker, uniq } from '../int/fixtures'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

/**
 * The calendar in a course's Sessions tab (ADR 0011, plan "The calendar
 * component"). It works on a course made for the run and removes it after, so
 * no real course changes. The two meetings are in 2034, so the calendar opens
 * on their week whatever day the test runs. Each test starts from the same
 * one session.
 */
const BASE = 'http://localhost:3000'
const FIRST = '2034-10-05'
const SECOND = '2034-10-12'
const SAVE = 'Save schedule'

const { track, cleanup } = createTracker()
let payload: Payload
let page: Page
let course: number
let session: number

const sessionsOf = async () =>
  (
    await payload.find({
      collection: 'sessions',
      where: { course: { equals: course } },
      depth: 0,
      pagination: false,
      sort: 'id',
      overrideAccess: true,
    })
  ).docs

const meetingsOf = async () =>
  (await sessionsOf()).flatMap((s) =>
    (s.meetings ?? []).map((m) => `${s.id}:${m.date} ${m.start_time}-${m.end_time}`),
  )

const openSessionsTab = async () => {
  await page.goto(`${BASE}/admin/collections/courses/${course}`)
  await page.getByRole('button', { name: 'Sessions', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Calendar' })).toBeVisible({ timeout: 60_000 })
}

const calendar = () => page.getByRole('group', { name: 'Calendar' })

/** The count of unsaved changes, as screen readers hear it. */
const unsaved = (text: string | RegExp) => calendar().getByRole('status').filter({ hasText: text })

/** A block of the grid, by the title in its spoken name. */
const block = (title: string) =>
  calendar().locator(`[data-span-id][aria-label*="${title}"]`).first()

const saveButton = () => calendar().getByRole('button', { name: SAVE, exact: true })

/** The save bar is gone: the save came back. (While it saves, its button says "Saving".) */
const barGone = () =>
  expect(calendar().getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0)

/** Right-click a block and choose an action of its menu. */
const choose = async (target: ReturnType<typeof block>, action: string) => {
  await target.click({ button: 'right' })
  await page.getByRole('menuitem', { name: action, exact: true }).click()
  await expect(page.getByRole('menu')).toBeHidden()
}

const thursday = () => block('E2E first session, Thursday, October 5')

test.describe('course calendar', () => {
  // A cold dev server compiles the admin on the first visit.
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    payload = await getPayload({ config })
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Calendar e2e place', slug: uniq('calendar-e2e-place'), city: uniq('E2E') },
        overrideAccess: true,
      }),
    ).id
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2034, place, start_date: '2034-10-04' },
        overrideAccess: true,
      }),
    ).id
    course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Calendar e2e course',
          slug: uniq('calendar-e2e-course'),
          course_type: 'THEMATIC',
          session_unit: 'session',
          tier: 'public',
          cycle,
          registration: { mode: 'closed' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id
    page = await (await browser.newContext()).newPage()
    await login({ page, user: testUser })
  })

  test.beforeEach(async () => {
    await payload.delete({
      collection: 'sessions',
      where: { course: { equals: course } },
      overrideAccess: true,
    })
    session = (
      await payload.create({
        collection: 'sessions',
        data: {
          course,
          title: 'E2E first session',
          meetings: [
            { date: FIRST, start_time: '19:00', end_time: '21:00' },
            { date: SECOND, start_time: '19:00', end_time: '21:00' },
          ],
        },
        overrideAccess: true,
      })
    ).id
  })

  test.afterAll(async () => {
    await page?.context().close()
    await cleanup(payload)
    await cleanupTestUser()
    await payload.destroy()
  })

  test('draws a session and moves a meeting, saves, and the database has them after a reload', async () => {
    const before = await meetingsOf()
    expect(before).toHaveLength(2)

    await openSessionsTab()
    // The calendar is always in edit mode for someone who may edit: no Edit button.
    await expect(calendar().getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
    await expect(saveButton()).toHaveCount(0)

    await calendar()
      .getByRole('button', { name: /^Add a block on/ })
      .first()
      .click()
    await block('E2E first session').focus({ timeout: 15_000 })
    await page.keyboard.press('ArrowDown')
    await expect(unsaved('2 unsaved changes')).toBeVisible()

    await saveButton().click()
    await expect(unsaved(/unsaved change/)).toHaveCount(0)
    await barGone()

    const after = await meetingsOf()
    expect(after).toHaveLength(3)
    // The key press moved one meeting of the session that was there; the other stayed.
    const kept = after.filter((m) => m.startsWith(`${session}:`))
    expect(kept).toHaveLength(2)
    expect(kept.filter((m) => before.includes(m))).toHaveLength(1)
    expect((await sessionsOf()).length).toBe(2)

    await openSessionsTab()
    // The drawn session has no title yet, so it shows as "Session 1" by its place in the order.
    await expect(calendar().locator('[data-span-id][aria-label^="Session "]')).toHaveCount(1)
  })

  test('Add meeting puts a block on the next day, which a drag moves, and Save stores it', async () => {
    await openSessionsTab()
    await choose(thursday(), 'Add meeting')
    const added = block('E2E first session, Friday, October 6')
    await expect(added).toHaveAccessibleName(/Unsaved/)
    await expect(unsaved('1 unsaved change')).toBeVisible()

    const box = (await added.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 70, { steps: 10 })
    await page.mouse.up()
    await expect(unsaved('1 unsaved change')).toBeVisible()

    await saveButton().click()
    await barGone()

    const meetings = (await sessionsOf()).find((s) => s.id === session)!.meetings ?? []
    expect(meetings).toHaveLength(3)
    const friday = meetings.find((m) => m.date === '2034-10-06')!
    expect(friday.start_time).not.toBe('19:00')
    expect(friday.start_time! > '19:00').toBe(true)
  })

  test('New session next week copies all the meetings a week later, with no title', async () => {
    await openSessionsTab()
    // The two meetings are in different weeks; both are copied.
    await choose(thursday(), 'New session next week')
    await expect(unsaved('1 unsaved change')).toBeVisible()
    await saveButton().click()
    await barGone()

    const sessions = await sessionsOf()
    expect(sessions).toHaveLength(2)
    const copy = sessions.find((s) => s.id !== session)!
    expect(copy.title ?? '').toBe('')
    expect(
      (copy.meetings ?? []).map((m) => `${m.date} ${m.start_time}-${m.end_time}`).sort(),
    ).toEqual(['2034-10-12 19:00-21:00', '2034-10-19 19:00-21:00'])
    expect(await meetingsOf()).toHaveLength(4)
  })

  test('Delete meeting removes one meeting on Save, and the session stays', async () => {
    await openSessionsTab()
    await choose(thursday(), 'Delete meeting')
    await expect(
      calendar().getByRole('button', { name: /^Restore E2E first session/ }),
    ).toBeVisible()
    await saveButton().click()
    await barGone()

    const sessions = await sessionsOf()
    expect(sessions.map((s) => s.id)).toEqual([session])
    expect((sessions[0]!.meetings ?? []).map((m) => m.date)).toEqual([SECOND])
  })

  test('a session with no meeting left shows in Unscheduled, with its content', async () => {
    await openSessionsTab()
    await choose(thursday(), 'Delete meeting')
    await calendar().getByRole('button', { name: 'Next week' }).click()
    await choose(block('E2E first session, Thursday, October 12'), 'Delete meeting')
    await saveButton().click()
    await barGone()

    expect((await sessionsOf()).map((s) => s.title)).toEqual(['E2E first session'])
    await openSessionsTab()
    await expect(
      calendar().getByRole('group', { name: 'Unscheduled' }).getByText('E2E first session'),
    ).toBeVisible()
  })

  test('an empty course shows 06:00 to 23:00, and a drag at 07:00 saves a 07:00 meeting', async () => {
    await payload.delete({
      collection: 'sessions',
      where: { course: { equals: course } },
      overrideAccess: true,
    })
    await openSessionsTab()
    const hours = calendar().locator('[aria-hidden="true"] > span')
    await expect(hours.first()).toHaveText('06:00')
    await expect(hours.last()).toHaveText('23:00')

    // The hours scroll in their own area. Scroll it to 06:00 so 07:00 is in reach.
    const area = calendar().locator('[data-scroll]')
    await area.evaluate((el) => el.scrollTo({ top: 0, behavior: 'instant' }))
    const track = calendar().locator('[data-track]:visible').first()
    const box = (await track.boundingBox())!
    const hour = box.height / 18
    const x = box.x + box.width / 2
    const y = box.y + hour * 1.1
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + hour * 0.9, { steps: 10 })
    await page.mouse.up()
    await expect(unsaved('1 unsaved change')).toBeVisible()

    await saveButton().click()
    await barGone()
    const [created] = await sessionsOf()
    const meeting = created!.meetings![0]!
    expect(meeting.start_time).toBe('07:00')
  })

  test('cancelling leaves the database as it was', async () => {
    const before = await meetingsOf()
    await openSessionsTab()
    await calendar()
      .getByRole('button', { name: /^Add a block on/ })
      .first()
      .click()
    await expect(unsaved('1 unsaved change')).toBeVisible()
    await calendar().getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(unsaved(/unsaved change/)).toHaveCount(0)
    await barGone()
    expect(await meetingsOf()).toEqual(before)
  })

  test('leaving the page warns while calendar changes are unsaved, and not after Cancel', async () => {
    await openSessionsTab()
    // What the browser asks of a page before a reload or a closed tab.
    const asked = () =>
      page.evaluate(() => {
        const event = new Event('beforeunload', { cancelable: true })
        window.dispatchEvent(event)
        return event.defaultPrevented
      })
    expect(await asked()).toBe(false)

    await calendar()
      .getByRole('button', { name: /^Add a block on/ })
      .first()
      .click()
    await expect(unsaved('1 unsaved change')).toBeVisible()
    expect(await asked()).toBe(true)

    // A link inside the admin opens Payload's own confirmation.
    const link = page.locator('a[href$="/admin/collections/courses"]').first()
    // The nav is off screen at this width, so send the click to the link itself.
    await link.dispatchEvent('click')
    const modal = page.getByRole('dialog').filter({ hasText: 'Leave without saving' })
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: 'Stay on this page' }).click()
    await expect(modal).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`/admin/collections/courses/${course}`))

    await calendar().getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(await asked()).toBe(false)
  })

  test('a block opens the session in the drawer, and focus comes back', async () => {
    await openSessionsTab()
    await block('E2E first session').click({ timeout: 15_000 })
    await expect(page.locator('.doc-drawer')).toBeVisible()
    await expect(page.locator('.doc-drawer #field-title')).toHaveValue('E2E first session')
    await page.keyboard.press('Escape')
    await expect(page.locator('.doc-drawer')).toBeHidden()
    await expect(block('E2E first session')).toBeFocused()
  })

  test('the menu opens the drawer with Open, from the keyboard, and Escape returns focus', async () => {
    await openSessionsTab()
    await block('E2E first session').focus({ timeout: 15_000 })
    await page.keyboard.press('Shift+F10')
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Open', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(block('E2E first session')).toBeFocused()

    await page.keyboard.press('ContextMenu')
    await page.keyboard.press('Enter')
    await expect(page.locator('.doc-drawer')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.doc-drawer')).toBeHidden()
    await expect(block('E2E first session')).toBeFocused()
  })
})
