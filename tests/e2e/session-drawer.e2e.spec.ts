import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import { scheduleToken } from '../../src/lib/session-refs'
import { consentAccept } from '../../src/lib/spaces-write'
import config from '../../src/payload.config.js'
import { createTracker, uniq, lockSpacesMode } from '../int/fixtures'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

/**
 * The session drawer (ADR 0011 step 4, unit 3): a session's block in the
 * Calendar tab, its row in the Syllabus tab, and its block in a post's
 * schedule open the same drawer on the same session, with the session in the
 * URL. It works on a course, space and post made for the run and removes
 * them after. The meeting is in 2034, so the calendar opens on its week.
 */
const BASE = 'http://localhost:3000'
const MEETING = '2034-10-05'
const TITLE = 'E2E drawer session'

const { track, cleanup } = createTracker()
let payload: Payload
let page: Page
let session: number
let space: number
let post: number
let spacePath: string
let account: number
let modeBefore: 'off' | 'trial' | 'on' = 'off'
let unlock: (() => Promise<void>) | undefined

const drawer = () => page.getByRole('dialog', { name: 'Session 1', exact: true })
/** The one session view inside the drawer, named in full. */
const sessionView = () => drawer().getByRole('region', { name: `Session 1: ${TITLE}` })
const param = () => new URL(page.url()).searchParams.get('open')
const focusInDrawer = () =>
  page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))
/** A session's block in a calendar, by the title in its spoken name. */
const block = () => page.locator(`[data-span-id][aria-label^="${TITLE}"]`).first()

/** Opens the drawer from `trigger`, checks it, and returns what the drawer shows. */
const openFrom = async (trigger: ReturnType<Page['locator']>) => {
  await trigger.click()
  await expect(sessionView()).toBeVisible({ timeout: 60_000 })
  expect(param()).toBe(String(session))
  await expect.poll(focusInDrawer).toBe(true)
  return (await sessionView().textContent()) ?? ''
}

test.describe('session drawer', () => {
  // A cold production server renders each page once before it is fast.
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async ({ browser }) => {
    // Playwright 1.58 starts all-hooks with the project timeout, not describe.timeout.
    test.setTimeout(300_000)
    unlock = await lockSpacesMode()
    payload = await getPayload({ config, key: uniq('session-drawer') })
    await seedTestUser(payload)
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Drawer e2e place', slug: uniq('drawer-e2e-place'), city: uniq('E2E') },
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
    const slug = uniq('drawer-e2e-course')
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Drawer e2e course',
          slug,
          course_type: 'THEMATIC',
          tier: 'public',
          cycle,
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
    // No introduction gate: the run reads the feed and posts at once.
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
          description: 'Read **closely**.',
          meetings: [{ date: MEETING, start_time: '19:00', end_time: '21:00' }],
        },
        overrideAccess: true,
      })
    ).id
    const person = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Drawer admin', slug: uniq('drawer-admin') },
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
    account = user.id
    expect((await consentAccept({ payload, user })).ok).toBe(true)
    post = track(
      'space-posts',
      await payload.create({
        collection: 'space-posts',
        data: {
          space,
          kind: 'announcement',
          author: person.id,
          body: `The first meeting.\n\n${scheduleToken({ from: MEETING, weeks: 1, ids: [String(session)] })}`,
        },
        overrideAccess: true,
      }),
    ).id
    page = await (await browser.newContext()).newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    test.setTimeout(120_000)
    await page?.context().close()
    // Rows the run made through the app: the post's visits, and the test user's consent.
    if (space) {
      for (const [collection, where] of [
        ['space-posts', { space: { equals: space } }],
        ['space-visits', { space: { equals: space } }],
        ['space-consents', { account: { equals: account } }],
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
    // Sessions first: the tracker deletes courses before collections it does not list.
    if (session) await payload.delete({ collection: 'sessions', id: session, overrideAccess: true })
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

  test('the Calendar tab, the Syllabus tab and a schedule block open the same drawer', async () => {
    await page.goto(`${BASE}${spacePath}?tab=calendar`)
    const fromCalendar = await openFrom(block())
    expect(fromCalendar).toContain(TITLE)
    expect(fromCalendar).toContain('19:00–21:00')
    await expect(drawer().locator('strong')).toHaveText('closely')
    await expect(drawer().getByRole('link', { name: 'Posts about this session' })).toHaveAttribute(
      'href',
      `${spacePath}?session=${session}`,
    )
    // Escape closes it, drops the param, and gives focus back to the block.
    await page.keyboard.press('Escape')
    await expect(drawer()).toHaveCount(0)
    expect(param()).toBeNull()
    await expect(block()).toBeFocused()

    // Back closes it, and does not open it again.
    await openFrom(block())
    await page.goBack()
    await expect(drawer()).toHaveCount(0)
    expect(new URL(page.url()).search).toBe('?tab=calendar')

    // A link with the param opens it.
    await page.goto(`${BASE}${spacePath}?tab=calendar&open=${session}`)
    await expect(sessionView()).toBeVisible({ timeout: 60_000 })
    await drawer().getByRole('button', { name: 'Close session' }).click()
    await expect(drawer()).toHaveCount(0)
    expect(param()).toBeNull()

    await page.goto(`${BASE}${spacePath}?tab=syllabus`)
    const opener = page.getByRole('link', { name: 'Open session' }).first()
    const fromSyllabus = await openFrom(opener)
    expect(page.url()).toContain('tab=syllabus')
    await page.keyboard.press('Escape')
    await expect(drawer()).toHaveCount(0)
    await expect(opener).toBeFocused()

    await page.goto(`${BASE}${spacePath}/posts/${post}`)
    const fromSchedule = await openFrom(block())
    expect(new URL(page.url()).pathname).toBe(`${spacePath}/posts/${post}`)
    await page.keyboard.press('Escape')
    await expect(drawer()).toHaveCount(0)
    await expect(block()).toBeFocused()

    expect(fromSyllabus).toBe(fromCalendar)
    expect(fromSchedule).toBe(fromCalendar)
  })
})
