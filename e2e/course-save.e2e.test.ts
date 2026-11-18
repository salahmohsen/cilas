import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import type { Course, Session } from '../src/payload-types.js'
import { createTracker, uniq } from '../testing/payload.fixture'
import { login } from '../testing/login.test-utils'
import { cleanupTestUser, seedTestUser, testUser } from '../testing/seed-user.test-utils'

const MARK = ' (e2e save check)'
const SUBTITLE = 'Teaching as a case'

const { track, cleanup } = createTracker()
let payload: Payload

type Localized = Omit<Course, 'subtitle'> & { subtitle: Record<string, string | null> }

let page: Page
let course: Course

const api = async <T>(path: string) => {
  const response = await page.request.get(`/api/${path}`)
  expect(response.status(), path).toBe(200)
  return (await response.json()) as T
}

const read = (draft: boolean) =>
  api<Localized>(`courses/${course.id}?depth=0&locale=all&draft=${draft}`)

const sessionsOf = async () =>
  (
    await api<{ docs: Session[] }>(
      `sessions?where[course][equals]=${course.id}&depth=0&locale=all&pagination=false&sort=id`,
    )
  ).docs

const kept = (doc: Pick<Course, 'schedule' | 'sessions' | 'first_day' | 'last_day'>) => ({
  schedule: doc.schedule,
  sessions: doc.sessions,
  first_day: doc.first_day,
  last_day: doc.last_day,
})

const save = async (subtitle: string, button: 'Publish changes' | 'Save Draft') => {
  await page.goto(`/admin/collections/courses/${course.id}`)
  await page.locator('#field-subtitle').fill(subtitle)
  const response = page.waitForResponse(
    (r) => r.url().includes(`/api/courses/${course.id}`) && r.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: button, exact: true }).click()
  const result = await response
  expect(result.status(), await result.text()).toBe(200)
}

test.describe('course admin save', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })
  let before: { published: Localized; sessions: Session[] }
  let subtitle: string

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000)
    payload = await getPayload({ config, key: uniq('course-save') })
    await seedTestUser(payload)
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Save e2e place', slug: uniq('save-e2e-place'), city: uniq('E2E') },
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
          title: 'Save e2e course',
          slug: uniq('save-e2e-course'),
          course_type: 'THEMATIC',
          tier: 'public',
          cycle,
          registration: { mode: 'closed' },
          subtitle: SUBTITLE,
          schedule: {
            start_date: '2034-10-05T00:00:00.000Z',
            start_precision: 'day',
            weeks: 2,
            slots: [{ weekday: 'thu', start_time: '19:00', end_time: '21:00' }],
            end_date: '2034-10-12T00:00:00.000Z',
          },
          sessions: [
            { order: 1, session_title: 'First', meetings: 1 },
            { order: 2, session_title: 'Second', meetings: 1 },
          ],
          first_day: '2034-10-05',
          last_day: '2034-10-12',
          _status: 'published',
        },
        overrideAccess: true,
      }),
    )
    for (const [title, date] of [
      ['First', '2034-10-05'],
      ['Second', '2034-10-12'],
    ]) {
      await payload.create({
        collection: 'sessions',
        data: {
          course: course.id,
          title,
          meetings: [{ date, start_time: '19:00', end_time: '21:00' }],
        },
        overrideAccess: true,
      })
    }
    page = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage()
    await login({ page, user: testUser })

    before = { published: await read(false), sessions: await sessionsOf() }
    subtitle = before.published.subtitle.en!
    expect(subtitle, 'the subtitle the course was made with').toBe(SUBTITLE)
  })

  test.afterAll(async () => {
    test.setTimeout(300_000)
    await page?.context().close()
    await cleanup(payload)
    await cleanupTestUser(payload)
    await payload.destroy()
  })

  test('publishing keeps the old fields, the sessions and the days', async () => {
    await save(subtitle + MARK, 'Publish changes')
    const after = await read(false)
    expect(after.subtitle.en).toBe(subtitle + MARK)
    expect(after._status).toBe('published')
    expect(kept(after)).toEqual(kept(before.published))
    expect(await sessionsOf()).toEqual(before.sessions)

    await save(subtitle, 'Publish changes')
    const restored = await read(false)
    expect(restored.subtitle.en).toBe(subtitle)
    expect(kept(restored)).toEqual(kept(before.published))
  })

  test('a draft save keeps them on the draft and leaves the published course', async () => {
    await save(subtitle + MARK, 'Save Draft')
    const draft = await read(true)
    expect(draft.subtitle.en).toBe(subtitle + MARK)
    expect(kept(draft)).toEqual(kept(before.published))
    const published = await read(false)
    expect(published.subtitle.en).toBe(subtitle)
    expect(kept(published)).toEqual(kept(before.published))
    expect(await sessionsOf()).toEqual(before.sessions)

    await save(subtitle, 'Publish changes')
    const restored = await read(false)
    expect(restored.subtitle.en).toBe(subtitle)
    expect((await read(true))._status).toBe('published')
    expect(kept(restored)).toEqual(kept(before.published))
    expect(await sessionsOf()).toEqual(before.sessions)
  })
})
