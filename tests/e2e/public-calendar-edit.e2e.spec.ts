import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import { createTracker, uniq, uniqEmail } from '../int/fixtures'

// Its own day: the panel spec shows 2035-10-04, and a second spec's sessions on it fold into "2 more".
const { track, cleanup } = createTracker()
let payload: Payload
const email = uniqEmail('public-calendar-admin')
const password = crypto.randomUUID()
const courses: number[] = []
const sessions: number[] = []

test.describe('the public calendar editor', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })
  test.beforeAll(async () => {
    payload = await getPayload({ config, key: uniq('public-calendar-edit') })
    const person = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Calendar admin', slug: uniq('public-calendar-admin') },
      }),
    )
    track(
      'users',
      await payload.create({
        collection: 'users',
        data: { email, password, roles: ['admin'], person: person.id },
      }),
    )
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Calendar place', slug: uniq('public-calendar-place'), city: uniq('Probe') },
      }),
    )
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2035, start_date: '2035-10-01', place: place.id },
      }),
    )
    for (const name of ['City', 'Maps']) {
      const course = track(
        'courses',
        await payload.create({
          collection: 'courses',
          data: {
            title: name,
            slug: uniq(`public-calendar-${name.toLowerCase()}`),
            course_type: 'THEMATIC',
            cycle: cycle.id,
            tier: 'public',
            registration: { mode: 'closed' },
            _status: 'published',
          },
        }),
      )
      courses.push(course.id)
      const session = await payload.create({
        collection: 'sessions',
        data: {
          course: course.id,
          title: `${name} session`,
          meetings: [{ date: '2037-04-09', start_time: '10:00', end_time: '12:00' }],
        },
      })
      sessions.push(session.id)
    }
  })
  test.afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  test('an anonymous edit URL contains no editable items', async ({ page }) => {
    await page.goto('/en/calendar?view=week&date=2037-04-09&edit=1')
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
    await expect(page.locator('[data-mode="edit"]')).toHaveCount(0)
  })

  test('an admin saves two courses and gets one dialog for both spaces', async ({ page }) => {
    const login = await page.request.post('/api/users/login', { data: { email, password } })
    expect(login.ok()).toBe(true)
    await page.goto('/en/calendar?view=week&date=2037-04-09')
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.locator('[data-mode="edit"]')).toHaveCount(1)
    for (const title of ['City session', 'Maps session']) {
      const block = page.locator(`[data-span-id][aria-label*="${title}"]`).first()
      await block.focus()
      await page.keyboard.press('ArrowRight')
      await expect(block).toHaveAccessibleName(/Unsaved/)
    }
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Announce this change?' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('region')).toHaveCount(2)
    await dialog.getByRole('button', { name: 'Skip', exact: true }).first().click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Skip', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page).toHaveURL(/view=week&date=2037-04-09$/)
    for (const id of sessions) {
      const session = await payload.findByID({ collection: 'sessions', id, depth: 0 })
      expect(session.meetings![0]!.date).toBe('2037-04-10')
    }
  })
})
