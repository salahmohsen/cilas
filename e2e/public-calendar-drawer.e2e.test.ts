import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import { createTracker, uniq, uniqEmail } from '../testing/payload.fixture'

const MEETING = '2038-02-11'
const TITLE = 'E2E public drawer session'

const { track, cleanup } = createTracker()
const email = uniqEmail('public-drawer-admin')
const password = crypto.randomUUID()
let payload: Payload

test.describe('the public calendar page', () => {
  test.beforeAll(async () => {
    payload = await getPayload({ config, key: uniq('public-calendar-drawer') })
    track(
      'users',
      await payload.create({
        collection: 'users',
        data: { email, password, roles: ['admin'] },
        overrideAccess: true,
      }),
    )
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Public drawer place', slug: uniq('public-drawer-place'), city: uniq('E2E') },
        overrideAccess: true,
      }),
    ).id
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'spring', start_year: 2038, place, start_date: '2038-02-01' },
        overrideAccess: true,
      }),
    ).id
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Public drawer course',
          slug: uniq('public-drawer-course'),
          course_type: 'THEMATIC',
          tier: 'public',
          cycle,
          registration: { mode: 'closed' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id
    track(
      'sessions',
      await payload.create({
        collection: 'sessions',
        data: {
          course,
          title: TITLE,
          meetings: [{ date: MEETING, start_time: '19:00', end_time: '21:00' }],
        },
        overrideAccess: true,
      }),
    )
  })

  test.afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  test('mounts the schedule actions: an admin opens a session from Edit', async ({ page }) => {
    const login = await page.request.post('/api/users/login', { data: { email, password } })
    expect(login.ok()).toBe(true)
    await page.goto(`/en/calendar?view=week&date=${MEETING}`)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.locator('[data-mode="edit"]')).toHaveCount(1)
    await expect(page.getByText('Schedule actions are missing')).toHaveCount(0)
    const block = page.locator(`[data-span-id][aria-label^="${TITLE}"]`).first()
    await block.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Open', exact: true }).click()
    await expect(page.getByRole('dialog').filter({ hasText: TITLE })).toBeVisible()
  })
})
