import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import { consentAccept } from '../src/lib/spaces-write'
import config from '../src/payload.config.js'
import { createTracker, uniq, lockSpacesMode } from '../testing/payload.fixture'
import { login } from '../testing/login.test-utils'
import { cleanupTestUser, seedTestUser, testUser } from '../testing/seed-user.test-utils'

const FIRST = '2034-10-05'
const SECOND = '2034-10-12'
const SAVE = 'Save schedule'

const { track, cleanup } = createTracker()
let payload: Payload
let page: Page
let course: number
let session: number
let space: number
let modeBefore: 'off' | 'trial' | 'on' = 'off'
let unlock: (() => Promise<void>) | undefined

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

const openSessionsTab = async () => {
  await page.goto(`/admin/collections/courses/${course}`)
  await page.getByRole('button', { name: 'Sessions', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Calendar' })).toBeVisible({ timeout: 60_000 })
}

const calendar = () => page.getByRole('group', { name: 'Calendar' })

const unsaved = (text: string | RegExp) => calendar().getByRole('status').filter({ hasText: text })

const block = (title: string) =>
  calendar().locator(`[data-span-id][aria-label*="${title}"]`).first()

const saveButton = () => calendar().getByRole('button', { name: SAVE, exact: true })

const barGone = () =>
  expect(calendar().getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0)

const thursday = () => block('E2E first session, Thursday, October 5')

test.describe('course schedule announcements', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    unlock = await lockSpacesMode()
    payload = await getPayload({ config, key: uniq('schedule-offer') })
    await seedTestUser(payload)
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
          tier: 'public',
          cycle,
          registration: { mode: 'closed' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id
    modeBefore =
      (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })).spaces_mode ??
      'off'
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
    const spaces = await payload.find({
      collection: 'spaces',
      where: { course: { equals: course } },
      depth: 0,
      overrideAccess: true,
    })
    expect(spaces.docs).toHaveLength(1)
    space = track('spaces', spaces.docs[0]!.id)
    const person = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Announcement admin', slug: uniq('announcement-admin') },
        overrideAccess: true,
      }),
    )
    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: testUser.email } },
      overrideAccess: true,
    })
    const user = await payload.update({
      collection: 'users',
      id: users.docs[0]!.id,
      data: { person: person.id },
      overrideAccess: true,
    })
    expect((await consentAccept({ payload, user })).ok).toBe(true)
    const consents = await payload.find({
      collection: 'space-consents',
      where: { account: { equals: user.id } },
      overrideAccess: true,
    })
    for (const row of consents.docs) track('space-consents', row.id)
    page = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage()
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
    test.setTimeout(120_000)
    await page?.context().close()
    if (space) {
      const posts = await payload.find({
        collection: 'space-posts',
        where: { space: { equals: space } },
        pagination: false,
        overrideAccess: true,
      })
      for (const row of posts.docs) track('space-posts', row.id)
    }
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: modeBefore },
      overrideAccess: true,
    })
    await cleanup(payload)
    await cleanupTestUser(payload)
    await payload.destroy()
    await unlock?.()
  })

  const announcements = async () =>
    (
      await payload.find({
        collection: 'space-posts',
        depth: 0,
        where: { and: [{ space: { equals: space } }, { kind: { equals: 'announcement' } }] },
        pagination: false,
        overrideAccess: true,
      })
    ).docs
  const dialog = () => page.getByRole('dialog', { name: 'Announce this change?' })
  const move = async () => {
    await block('E2E first session').focus()
    await page.keyboard.press('ArrowDown')
    await expect(unsaved('1 unsaved change')).toBeVisible()
  }

  test('a moved meeting offers text and publishes a pinned announcement with the schedule', async () => {
    const before = await announcements()
    await openSessionsTab()
    await move()
    await expect(saveButton()).toBeVisible()
    await saveButton().click()
    await expect(dialog()).toBeVisible()
    await expect(dialog().getByRole('textbox', { name: 'Announcement' })).toContainText(
      'Session 1: E2E first session moves',
    )
    await expect(dialog().getByRole('checkbox', { name: 'Include the calendar' })).toBeChecked()
    await dialog().getByRole('button', { name: 'Publish to space', exact: true }).click()
    await expect(dialog()).toBeHidden()
    const posts = await announcements()
    expect(posts).toHaveLength(before.length + 1)
    expect(posts.find((post) => !before.some((old) => old.id === post.id))).toMatchObject({
      pinned: true,
      body: expect.stringContaining('::schedule['),
    })
  })

  test('Skip makes no post', async () => {
    const before = await announcements()
    await openSessionsTab()
    await move()
    await saveButton().click()
    await expect(dialog()).toBeVisible()
    await dialog().getByRole('button', { name: 'Skip', exact: true }).click()
    await expect(dialog()).toBeHidden()
    expect(await announcements()).toEqual(before)
  })

  test('a change only to past meetings opens no dialog', async () => {
    await payload.update({
      collection: 'sessions',
      id: session,
      data: { meetings: [{ date: '2020-10-05', start_time: '19:00', end_time: '21:00' }] },
      overrideAccess: true,
    })
    await openSessionsTab()
    await move()
    const response = page.waitForResponse(
      async (r) =>
        r.request().method() === 'POST' && (r.request().postData()?.includes('"before"') ?? false),
    )
    await saveButton().click()
    await barGone()
    await response
    await expect(dialog()).toHaveCount(0)
    expect((await sessionsOf())[0]!.meetings![0]!.start_time).not.toBe('19:00')
  })

  test('Cancelled in the session drawer offers an announcement after save', async () => {
    await openSessionsTab()
    await thursday().click()
    const drawer = page.getByRole('dialog', { name: 'E2E first session', exact: true })
    await drawer.getByLabel('Cancelled', { exact: true }).check()
    await drawer.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(drawer).toBeHidden()
    await saveButton().click()
    await expect(dialog()).toBeVisible()
    await expect(dialog().getByRole('textbox', { name: 'Announcement' })).toContainText(
      'is cancelled',
    )
    await dialog().getByRole('button', { name: 'Skip', exact: true }).click()
    expect((await sessionsOf())[0]!.cancelled).toBe(true)
  })

  test('a stale save names the session and offers Reload and lose my changes', async () => {
    await openSessionsTab()
    await move()
    await payload.update({
      collection: 'sessions',
      id: session,
      data: { title: 'E2E first session changed elsewhere' },
      overrideAccess: true,
    })
    await saveButton().click()
    await expect(calendar().getByRole('alert')).toContainText(
      'The changes were not saved. They are still here. Someone else changed Session 1: E2E first session changed elsewhere after the calendar loaded.',
    )
    await expect(unsaved('1 unsaved change')).toBeVisible()
    await expect(dialog()).toHaveCount(0)
    await calendar()
      .getByRole('button', { name: 'Reload and lose my changes', exact: true })
      .click()
    await expect(unsaved(/unsaved change/)).toHaveCount(0)
    await expect(block('E2E first session changed elsewhere')).toBeVisible()
  })
})
