import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import { consentAccept } from '../src/lib/spaces-write'
import config from '../src/payload.config.js'
import type { User } from '../src/payload-types.js'
import { createTracker, lockSpacesMode, uniq, uniqEmail } from '../testing/payload.fixture'

const MEETING = '2034-10-05'
const TITLE = 'E2E drawer session'

const { track, cleanup } = createTracker()
let payload: Payload
let session: number
let space: number
let spacePath: string
let modeBefore: 'off' | 'trial' | 'on' | undefined
let unlock: (() => Promise<void>) | undefined
let account: { email: string; password: string; id: number }
let fellow: Page

const sessionRow = () =>
  payload.findByID({ collection: 'sessions', id: session, depth: 0, overrideAccess: true })

const block = (page: Page, title: string) =>
  page.locator(`[data-span-id][aria-label^="${title}"]`).first()
const drawer = (page: Page, title: string) => page.getByRole('dialog', { name: title, exact: true })
const offer = (page: Page) => page.getByRole('dialog', { name: 'Announce this change?' })

const signIn = async (browser: Browser) => {
  const page = await (
    await browser.newContext({ baseURL: test.info().project.use.baseURL })
  ).newPage()
  const path = `${spacePath}?tab=calendar`
  await page.goto(`/en/login?next=${encodeURIComponent(path)}`)
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(`**${spacePath}?tab=calendar`, { timeout: 120_000 })
  await expect(block(page, TITLE)).toBeVisible({ timeout: 120_000 })
  return page
}

const openForm = async (title: string, by: 'block' | 'link' = 'block') => {
  const panel = drawer(fellow, title)
  if (by === 'block') await block(fellow, title).click()
  else await fellow.goto(`${spacePath}?tab=calendar&open=${session}`)
  await panel.getByRole('button', { name: 'Edit session', exact: true }).click()
  await expect(panel.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible({
    timeout: 60_000,
  })
  return panel
}

const pickTime = async (panel: Locator, field: string, time: string) => {
  await panel.getByRole('button', { name: new RegExp(`^${field}`) }).click()
  await panel
    .getByRole('listbox', { name: field, exact: true })
    .getByRole('option', { name: time, exact: true })
    .click()
}

const closeDrawer = async (panel: Locator) => {
  await panel.getByRole('button', { name: 'Close session', exact: true }).click()
  await expect(panel).toBeHidden()
}

test.describe('session drawer Edit form', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    unlock = await lockSpacesMode()
    payload = await getPayload({ config, key: uniq('session-edit') })
    const person = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'session-edit-fellow', slug: uniq('session-edit-fellow') },
        overrideAccess: true,
      }),
    ).id
    const password = crypto.randomUUID()
    const email = uniqEmail('session-edit-fellow')
    const user = track(
      'users',
      await payload.create({
        collection: 'users',
        data: { email, password, roles: ['fellow'], person },
        overrideAccess: true,
      }),
    ) as unknown as User
    account = { email, password, id: user.id }

    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: {
          name: 'Session edit e2e place',
          slug: uniq('session-edit-place'),
          city: uniq('E2E'),
        },
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
    const slug = uniq('session-edit-course')
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Session edit e2e course',
          slug,
          course_type: 'THEMATIC',
          tier: 'public',
          cycle,
          fellows: [person],
          registration: { mode: 'closed' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id
    spacePath = `/en/spaces/course/${slug}`
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
    await payload.update({
      collection: 'spaces',
      id: space,
      data: { introduction_post: null },
      overrideAccess: true,
    })
    session = (
      await payload.create({
        collection: 'sessions',
        data: {
          course,
          title: TITLE,
          meetings: [{ date: MEETING, start_time: '19:00', end_time: '21:00' }],
        },
        overrideAccess: true,
      })
    ).id
    expect((await consentAccept({ payload, user })).ok).toBe(true)
    fellow = await signIn(browser)
  })

  test.afterAll(async () => {
    test.setTimeout(300_000)
    await fellow?.context().close()
    if (space && payload) {
      for (const [collection, where] of [
        ['space-posts', { space: { equals: space } }],
        ['space-visits', { space: { equals: space } }],
        ['space-consents', { account: { equals: account?.id ?? 0 } }],
      ] as const) {
        const rows = await payload.find({
          collection,
          where,
          pagination: false,
          overrideAccess: true,
        })
        for (const row of rows.docs) track(collection, row.id)
      }
    }
    if (session && payload)
      await payload.delete({ collection: 'sessions', id: session, overrideAccess: true })
    if (payload) {
      if (modeBefore)
        await payload.updateGlobal({
          slug: 'site-settings',
          data: { spaces_mode: modeBefore },
          overrideAccess: true,
        })
      await cleanup(payload)
      await payload.destroy()
    }
    await unlock?.()
  })

  test('a fellow edits the title and moves the meeting; the offer opens and both views show the save', async () => {
    const panel = await openForm(TITLE)
    await panel.getByRole('textbox', { name: 'Title', exact: true }).fill('E2E drawer renamed')
    await pickTime(panel, 'Starts', '8 PM')
    await pickTime(panel, 'Ends', '10 PM')
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click()

    const dialog = offer(fellow)
    await expect(dialog).toBeVisible({ timeout: 60_000 })
    await expect(dialog.getByText(/E2E drawer renamed moves/).first()).toBeVisible()
    const row = await sessionRow()
    expect(row.title).toBe('E2E drawer renamed')
    expect(row.meetings?.[0]).toMatchObject({
      date: MEETING,
      start_time: '20:00',
      end_time: '22:00',
    })
    await dialog.getByRole('button', { name: 'Skip', exact: true }).click()
    await expect(dialog).toBeHidden()

    const renamed = drawer(fellow, 'E2E drawer renamed')
    await expect(renamed).toBeVisible()
    await expect(renamed.getByText('8 – 10 PM')).toBeVisible()
    await closeDrawer(renamed)
    await expect(block(fellow, 'E2E drawer renamed')).toHaveAccessibleName(
      /^E2E drawer renamed, Thursday, October 5, 8 PM to 10 PM/,
    )
  })

  test('a material added from the + tile saves with the session', async () => {
    const panel = await openForm('E2E drawer renamed')
    await panel.getByRole('button', { name: 'Add material', exact: true }).click()
    const dialog = fellow.getByRole('dialog', { name: 'Add material', exact: true })
    await dialog.getByRole('textbox', { name: 'Material title', exact: true }).fill('E2E reading')
    await dialog.getByRole('textbox', { name: 'Link', exact: true }).fill('not a link')
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(
      dialog
        .getByText('Enter a full link that starts with https://')
        .and(dialog.locator('[aria-hidden="true"]')),
    ).toBeVisible()
    await dialog.getByRole('textbox', { name: 'Link', exact: true }).fill('https://example.org/e2e')
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(panel.getByRole('button', { name: 'Edit material: E2E reading' })).toBeFocused()
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click()
    const saved = drawer(fellow, 'E2E drawer renamed')
    await expect(saved.getByRole('button', { name: 'Edit session', exact: true })).toBeVisible({
      timeout: 60_000,
    })
    expect((await sessionRow()).bibliography).toEqual([
      expect.objectContaining({ title: 'E2E reading', href: 'https://example.org/e2e' }),
    ])
    await closeDrawer(saved)
  })

  test('ticking Cancelled opens the offer', async () => {
    const panel = await openForm('E2E drawer renamed')
    await panel.getByRole('checkbox', { name: 'Cancelled', exact: true }).click()
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click()
    const dialog = offer(fellow)
    await expect(dialog).toBeVisible({ timeout: 60_000 })
    await expect(dialog.getByText(/cancelled/).first()).toBeVisible()
    expect((await sessionRow()).cancelled).toBe(true)
    await dialog.getByRole('button', { name: 'Skip', exact: true }).click()
    await expect(dialog).toBeHidden()
    await closeDrawer(drawer(fellow, 'E2E drawer renamed'))
  })

  test('a stale save keeps the form values and Reload shows the current data', async () => {
    const panel = await openForm('E2E drawer renamed', 'link')
    const title = panel.getByRole('textbox', { name: 'Title', exact: true })
    await title.fill('My waiting title')
    await payload.update({
      collection: 'sessions',
      id: session,
      data: { title: 'Saved elsewhere' },
      overrideAccess: true,
    })
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click()
    const reload = panel.getByRole('button', { name: 'Reload and lose my changes', exact: true })
    await expect(reload).toBeVisible({ timeout: 60_000 })
    await expect(title).toHaveValue('My waiting title')
    expect((await sessionRow()).title).toBe('Saved elsewhere')
    await reload.click()
    await expect(title).toHaveValue('Saved elsewhere', { timeout: 60_000 })
    await title.fill('E2E drawer renamed')
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click()
    const saved = drawer(fellow, 'E2E drawer renamed')
    await expect(saved.getByRole('button', { name: 'Edit session', exact: true })).toBeVisible({
      timeout: 60_000,
    })
    await closeDrawer(saved)
  })

  test('a change to the text alone opens no offer', async () => {
    const before = (await sessionRow()).updatedAt
    const panel = await openForm('E2E drawer renamed', 'link')
    await panel.getByRole('textbox', { name: 'Title', exact: true }).fill('E2E drawer text only')
    await panel.getByRole('button', { name: 'Save changes', exact: true }).click()
    const saved = drawer(fellow, 'E2E drawer text only')
    await expect(saved.getByRole('button', { name: 'Edit session', exact: true })).toBeVisible({
      timeout: 60_000,
    })
    await expect.poll(async () => (await sessionRow()).updatedAt).not.toBe(before)
    await fellow.waitForTimeout(3_000)
    await expect(offer(fellow)).toHaveCount(0)
    await closeDrawer(saved)
  })
})
