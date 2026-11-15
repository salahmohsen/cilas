import { expect, test, type Browser, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import { consentAccept } from '../../src/lib/spaces-write'
import config from '../../src/payload.config.js'
import type { User } from '../../src/payload-types.js'
import { createTracker, lockSpacesMode, uniq, uniqEmail } from '../int/fixtures'

/**
 * Edit mode in a course space's Calendar tab (ADR 0011 step 4, unit 4). A
 * fellow of the course moves a session and saves, and the announcement
 * dialog opens; Cancel changes nothing; Done with a waiting change asks; a
 * student sees no Edit. It works on a course, space, fellow and student made
 * for the run and removes them after. The meeting is in 2034, so the
 * calendar opens on its week.
 */
const BASE = 'http://localhost:3000'
const MEETING = '2034-10-05'
const TITLE = 'E2E space edit session'

const { track, cleanup } = createTracker()
let payload: Payload
let session: number
let space: number
let spacePath: string
/** The site's spaces mode before the run; unset until it was read. */
let modeBefore: 'off' | 'trial' | 'on' | undefined
let unlock: (() => Promise<void>) | undefined
const accounts: Record<'fellow' | 'student', { email: string; password: string; id: number }> =
  {} as never
let fellow: Page

const meetings = async () =>
  (await payload.findByID({ collection: 'sessions', id: session, depth: 0, overrideAccess: true }))
    .meetings
const sessionRow = async () =>
  payload.findByID({ collection: 'sessions', id: session, depth: 0, overrideAccess: true })

/** A session's block in the calendar, by the title in its spoken name. */
const block = (page: Page) => page.locator(`[data-span-id][aria-label^="${TITLE}"]`).first()
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save', exact: true })

const signIn = async (browser: Browser, who: 'fellow' | 'student') => {
  const page = await (await browser.newContext()).newPage()
  const path = `${spacePath}?tab=calendar`
  await page.goto(`${BASE}/en/login?next=${encodeURIComponent(path)}`)
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(accounts[who].email)
  await page.getByLabel('Password', { exact: true }).fill(accounts[who].password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(`**${spacePath}?tab=calendar`, { timeout: 120_000 })
  await expect(block(page)).toBeVisible({ timeout: 120_000 })
  return page
}

const startEditing = async (page: Page) => {
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.locator('[data-mode="edit"]')).toHaveCount(1)
}

/** One day later, from the keyboard. */
const moveOneDay = async (page: Page) => {
  await block(page).focus()
  await page.keyboard.press('ArrowRight')
  await expect(block(page)).toHaveAccessibleName(/Friday, October 6.*Unsaved/)
}

test.describe('space calendar edit mode', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    // Playwright 1.58 starts all-hooks with the project timeout, not describe.timeout.
    test.setTimeout(300_000)
    unlock = await lockSpacesMode()
    payload = await getPayload({ config })
    const account = async (name: string, roles: User['roles']) => {
      const person = track(
        'people',
        await payload.create({
          collection: 'people',
          data: { name, slug: uniq(name) },
          overrideAccess: true,
        }),
      ).id
      const password = crypto.randomUUID()
      const email = uniqEmail(name)
      const user = track(
        'users',
        await payload.create({
          collection: 'users',
          data: { email, password, roles, person },
          overrideAccess: true,
        }),
      ) as unknown as User
      return { person, user, email, password }
    }
    const f = await account('space-edit-fellow', ['fellow'])
    const s = await account('space-edit-student', ['member'])
    accounts.fellow = { email: f.email, password: f.password, id: f.user.id }
    accounts.student = { email: s.email, password: s.password, id: s.user.id }

    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Space edit e2e place', slug: uniq('space-edit-place'), city: uniq('E2E') },
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
    const slug = uniq('space-edit-course')
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Space edit e2e course',
          slug,
          course_type: 'THEMATIC',
          tier: 'public',
          cycle,
          fellows: [f.person],
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
    track(
      'enrollments',
      await payload.create({
        collection: 'enrollments',
        data: { person: s.person, course, status: 'confirmed', source: 'admin' },
        overrideAccess: true,
      }),
    )
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
    for (const user of [f.user, s.user])
      expect((await consentAccept({ payload, user })).ok).toBe(true)
    fellow = await signIn(browser, 'fellow')
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    await fellow?.context().close()
    if (space && payload) {
      for (const [collection, where] of [
        ['space-posts', { space: { equals: space } }],
        ['space-visits', { space: { equals: space } }],
        [
          'space-consents',
          { account: { in: [accounts.fellow?.id, accounts.student?.id].filter(Boolean) } },
        ],
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

  test('a student sees the calendar and no Edit', async ({ browser }) => {
    const student = await signIn(browser, 'student')
    await expect(student.locator('[data-mode="view"]')).toHaveCount(1)
    await expect(student.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
    await student.context().close()
  })

  test('Cancel changes nothing in the database', async () => {
    const before = await sessionRow()
    await startEditing(fellow)
    await moveOneDay(fellow)
    await fellow.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(saveButton(fellow)).toHaveCount(0)
    await expect(block(fellow)).toHaveAccessibleName(/^E2E space edit session, Thursday, October 5/)
    const after = await sessionRow()
    expect(after.meetings).toEqual(before.meetings)
    expect(after.updatedAt).toBe(before.updatedAt)
  })

  test('Done with a waiting change asks before it leaves', async () => {
    await moveOneDay(fellow)
    await fellow.getByRole('button', { name: 'Done', exact: true }).click()
    const ask = fellow.getByRole('dialog', { name: 'Leave without saving?' })
    await expect(ask).toBeVisible()
    await expect(ask.getByRole('button', { name: 'Close', exact: true })).toHaveCount(1)
    await expect(ask.getByRole('button', { name: 'Stay', exact: true })).toHaveCount(1)
    await ask.getByRole('button', { name: 'Stay', exact: true }).click()
    await expect(ask).toBeHidden()
    await expect(block(fellow)).toHaveAccessibleName(/Unsaved/)
    // A tab switch asks too, and Stay keeps the tab.
    await fellow.getByRole('button', { name: 'Announcements', exact: true }).click()
    await expect(ask).toBeVisible()
    await expect(ask.getByRole('button', { name: 'Close', exact: true })).toHaveCount(1)
    await expect(ask.getByRole('button', { name: 'Stay', exact: true })).toHaveCount(1)
    await ask.getByRole('button', { name: 'Stay', exact: true }).click()
    await expect(ask).toBeHidden()
    expect(fellow.url()).toContain('tab=calendar')
    await fellow.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect((await meetings())?.[0]?.date?.slice(0, 10)).toBe(MEETING)
  })

  test('a fellow moves a session to a later day, saves, and the announcement opens prefilled', async () => {
    await moveOneDay(fellow)
    await saveButton(fellow).click()
    const offer = fellow.getByRole('dialog', { name: 'Announce this change?' })
    await expect(offer).toBeVisible({ timeout: 60_000 })
    await expect(offer.getByText(/Space edit e2e course/).first()).toBeVisible()
    await expect(offer.getByText(new RegExp(`${TITLE} moves`)).first()).toBeVisible()
    expect((await meetings())?.[0]?.date?.slice(0, 10)).toBe('2034-10-06')
    await offer.getByRole('button', { name: 'Skip', exact: true }).click()
    await expect(offer).toBeHidden()

    // Nothing waits now: Done goes back to view mode with the saved day.
    await fellow.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(fellow.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    await expect(block(fellow)).toHaveAccessibleName(/^E2E space edit session, Friday, October 6/)
  })
})
