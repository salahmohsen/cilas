import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { createTracker, uniq } from '../int/fixtures'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

/**
 * The calendar in a course's Sessions tab (ADR 0011, plan "The calendar
 * component", unit 5). It works on a course made for the run and removes it
 * after, so no real course changes. The two meetings are in 2034, so the
 * calendar opens on their week whatever day the test runs.
 */
const BASE = 'http://localhost:3000'
const FIRST = '2034-10-05'
const SECOND = '2034-10-12'

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

    page = await (await browser.newContext()).newPage()
    await login({ page, user: testUser })
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
    await page.getByRole('button', { name: 'Edit', exact: true }).click()

    await calendar()
      .getByRole('button', { name: /^Add a block on/ })
      .first()
      .click()
    await block('E2E first session').focus({ timeout: 15_000 })
    await page.keyboard.press('ArrowDown')
    await expect(unsaved('2 unsaved changes')).toBeVisible()

    await calendar().getByRole('button', { name: 'Save', exact: true }).click()
    await expect(unsaved(/unsaved change/)).toHaveCount(0)

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

  test('cancelling leaves the database as it was', async () => {
    const before = await meetingsOf()
    await openSessionsTab()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await calendar()
      .getByRole('button', { name: /^Add a block on/ })
      .first()
      .click()
    await expect(unsaved('1 unsaved change')).toBeVisible()
    await calendar().getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(unsaved(/unsaved change/)).toHaveCount(0)
    expect(await meetingsOf()).toEqual(before)
  })

  test('a block opens the session in the drawer', async () => {
    await openSessionsTab()
    await block('E2E first session').click({ timeout: 15_000 })
    await expect(page.locator('.doc-drawer')).toBeVisible()
    await expect(page.locator('.doc-drawer #field-title')).toHaveValue('E2E first session')
    await page.keyboard.press('Escape')
    await expect(page.locator('.doc-drawer')).toBeHidden()
    await expect(block('E2E first session')).toBeFocused()
  })

  test('Repeat weekly adds the next meetings, or new sessions, one a week', async () => {
    const stored = async () => (await sessionsOf()).find((s) => s.id === session)!
    const latest = (meetings: { date: string }[]) =>
      meetings
        .map((m) => m.date)
        .sort()
        .at(-1)!
    const weekAfter = (day: string, weeks: number) =>
      new Date(Date.parse(`${day}T00:00:00Z`) + weeks * 7 * 86_400_000).toISOString().slice(0, 10)

    await page.goto(`${BASE}/admin/collections/sessions/${session}`)
    const tool = page.getByRole('group', { name: 'Repeat weekly' }).first()
    await expect(tool).toBeVisible({ timeout: 60_000 })
    const before = await stored()
    const rowsBefore = await page.locator('#field-meetings .array-field__row').count()
    const last = latest(before.meetings ?? [])

    await tool.getByLabel('How many weeks').fill('2')
    await tool.getByRole('button', { name: 'Repeat', exact: true }).click()
    await expect(tool.getByRole('status')).toHaveText('Added 2 meetings.', { timeout: 30_000 })
    const after = await stored()
    expect(
      (after.meetings ?? [])
        .map((m) => m.date)
        .sort()
        .slice(-2),
    ).toEqual([weekAfter(last, 1), weekAfter(last, 2)])
    // The form shows the saved meetings, so a later save does not undo them.
    await expect(page.locator('#field-meetings .array-field__row')).toHaveCount(rowsBefore + 2)

    const sessionsBefore = (await sessionsOf()).length
    await tool.getByLabel('Make new sessions, one meeting each').check()
    await tool.getByLabel('How many weeks').fill('2')
    await tool.getByRole('button', { name: 'Repeat', exact: true }).click()
    await expect(tool.getByRole('status')).toHaveText('Made 2 sessions.', { timeout: 30_000 })
    const made = (await sessionsOf()).filter((s) => s.id !== session).slice(-2)
    expect((await sessionsOf()).length).toBe(sessionsBefore + 2)
    expect(made.map((s) => s.meetings?.map((m) => m.date))).toEqual([
      [weekAfter(latest(after.meetings ?? []), 1)],
      [weekAfter(latest(after.meetings ?? []), 2)],
    ])
  })
})
