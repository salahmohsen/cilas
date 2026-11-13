import { expect, test, type Page } from '@playwright/test'

import type { Course, Cycle, Session } from '../../src/payload-types.js'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

/**
 * Saving a course from the admin form keeps its data (ADR 0011, plan "Move
 * course readers to the sessions collection", unit 6). The old `schedule`
 * group and `sessions` array are hidden and read only; a save must leave
 * them, the course's sessions and its first and last day as they were.
 *
 * It edits a real published course of the local database: one with the old
 * pattern, old rows and sessions, a subtitle, no last editor and no draft
 * waiting. It changes the subtitle and publishes, then saves a draft, and
 * puts the subtitle back each time. Deleting the throwaway admin at the end
 * clears the last editor its saves stamped.
 */
const BASE = 'http://localhost:3000'
const MARK = ' (e2e save check)'

type Localized = Omit<Course, 'subtitle'> & { subtitle: Record<string, string | null> }

let page: Page
let course: Course

const api = async <T>(path: string): Promise<T> => {
  const response = await page.request.get(`${BASE}/api/${path}`)
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

/** What a save must not change. */
const kept = (doc: Pick<Course, 'schedule' | 'sessions' | 'first_day' | 'last_day'>) => ({
  schedule: doc.schedule,
  sessions: doc.sessions,
  first_day: doc.first_day,
  last_day: doc.last_day,
})

const save = async (subtitle: string, button: 'Publish changes' | 'Save Draft') => {
  await page.goto(`${BASE}/admin/collections/courses/${course.id}`)
  await page.locator('#field-subtitle').fill(subtitle)
  const response = page.waitForResponse(
    (r) => r.url().includes(`/api/courses/${course.id}`) && r.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: button, exact: true }).click()
  const result = await response
  expect(result.status(), await result.text()).toBe(200)
}

test.describe('course admin save', () => {
  // A cold dev server compiles the admin on the first visit.
  test.describe.configure({ mode: 'serial', timeout: 300_000 })
  let before: { published: Localized; sessions: Session[] }
  let subtitle: string

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    page = await (await browser.newContext()).newPage()
    await login({ page, user: testUser })

    const where = [
      'where[_status][equals]=published',
      'where[review.status][equals]=approved',
      'where[schedule.start_date][exists]=true',
      'where[last_edited_by][exists]=false',
      'where[subtitle][exists]=true',
    ].join('&')
    const { docs } = await api<{ docs: Course[] }>(`courses?${where}&depth=0&sort=id&limit=100`)
    for (const doc of docs) {
      const draft = await api<Course>(`courses/${doc.id}?depth=0&draft=true`)
      const { totalDocs } = await api<{ totalDocs: number }>(
        `sessions/count?where[course][equals]=${doc.id}`,
      )
      // A subtitle saved empty would come back as '', not as it was.
      const fits = doc.subtitle && doc.sessions?.length && doc.schedule?.slots?.length && totalDocs
      // An archived cycle may have no registration, and then the course cannot publish.
      const cycle =
        doc.registration?.mode === 'follow_cycle' && typeof doc.cycle === 'number'
          ? await api<Cycle>(`cycles/${doc.cycle}?depth=0`)
          : null
      const method = cycle?.registration?.method
      const publishable = !cycle || (method === 'form' ? !!cycle.registration?.form : !!method)
      if (fits && publishable && draft._status === 'published') {
        course = doc
        break
      }
    }
    expect(course, 'a publishable course with old data, sessions and no draft').toBeDefined()
    before = { published: await read(false), sessions: await sessionsOf() }
    subtitle = before.published.subtitle.en!
    const { schedule } = before.published
    console.log(
      `course ${course.id}: schedule ${schedule?.start_date} to ${schedule?.end_date}, ` +
        `${schedule?.slots?.length} slot(s), ${before.published.sessions?.length} old rows, ` +
        `${before.sessions.length} sessions, days ${before.published.first_day} to ` +
        `${before.published.last_day}, subtitle "${subtitle}"`,
    )
  })

  test.afterAll(async () => {
    await page?.context().close()
    await cleanupTestUser()
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
