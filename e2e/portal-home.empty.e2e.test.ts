import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../src/payload.config.js'

import { EMPTY_ACCOUNTS } from '../seed/empty'
import { login } from '../testing/login.test-utils'
import { createTracker, uniq } from '../testing/payload.fixture'
import { trustedWrites } from '../testing/portal-lists.fixture'
import {
  account,
  holdSpacesMode,
  inContext,
  LOCALES,
  MESSAGES,
  WIDTHS,
} from '../testing/portal.fixture'
import { mailOff, navName, observeWorkStream } from '../testing/portal-e2e.test-utils'

type Role = keyof typeof EMPTY_ACCOUNTS

test.describe('portal Home on the empty seed', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })
  let spaces: Awaited<ReturnType<typeof holdSpacesMode>> | undefined

  test.beforeAll(async () => {
    const payload = await getPayload({ config, key: uniq('portal-home-empty') })
    mailOff(payload)
    spaces = await holdSpacesMode(payload)
    await spaces.set('on')
  })

  test.afterAll(async () => {
    await spaces?.release()
  })

  for (const role of Object.keys(EMPTY_ACCOUNTS) as Role[])
    for (const locale of LOCALES)
      for (const viewport of Object.values(WIDTHS))
        test(`an empty Home shows its empty cards (${role} ${locale} ${viewport.width})`, async ({
          browser,
          baseURL,
        }) => {
          await inContext(browser, { baseURL, viewport }, async (page) => {
            const errors: string[] = []
            page.on('console', (message) => {
              if (message.type() === 'error') errors.push(message.text())
            })
            page.on('pageerror', (error) => errors.push(error.message))
            const portal = MESSAGES[locale].Portal
            await login({ page, user: EMPTY_ACCOUNTS[role], next: `/${locale}/spaces` })
            const main = page.locator('#main')
            await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1)
            for (const empty of [
              portal.needs.empty,
              portal.home.noSession,
              portal.home.noSpaces,
              portal.latest.empty,
            ])
              await expect(main.getByText(empty, { exact: true })).toBeVisible()
            const actions = {
              admin: portal.home.openCalendar,
              fellow: portal.home.openCourses,
              student: portal.home.seeCourses,
            }
            await expect(
              main
                .locator('section[aria-labelledby="home-next-session"]')
                .getByRole('link', { name: actions[role] }),
            ).toBeVisible()
            await expect(main.getByRole('link', { name: portal.home.browseSpaces })).toHaveCount(0)
            if (role === 'student')
              await expect(
                main
                  .locator('section[aria-labelledby="home-spaces"]')
                  .getByRole('link', { name: portal.home.seeCourses }),
              ).toBeVisible()
            expect(errors).toEqual([])
          })
        })
})

test.describe('portal Inbox on the empty seed', () => {
  test.describe.configure({ timeout: 120_000 })

  for (const role of Object.keys(EMPTY_ACCOUNTS) as Role[])
    for (const locale of LOCALES)
      for (const viewport of Object.values(WIDTHS))
        test(`an empty Inbox says nothing needs the reader (${role} ${locale} ${viewport.width})`, async ({
          browser,
        }) => {
          const baseURL = test.info().project.use.baseURL
          await inContext(browser, { baseURL, viewport }, async (page) => {
            const errors: string[] = []
            page.on('console', (message) => {
              if (message.type() === 'error') errors.push(message.text())
            })
            const target = `/${locale}/spaces/inbox`
            const counts = page.waitForResponse(
              (response) => new URL(response.url()).pathname === '/api/portal/counts',
            )
            await login({ page, user: EMPTY_ACCOUNTS[role], next: target })
            await page.waitForURL(`**${target}`)
            const portal = MESSAGES[locale].Portal
            await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(portal.inbox.title)
            const main = page.locator('#main')
            await expect(main.getByText(portal.needs.empty, { exact: true })).toBeVisible()
            await expect(main.getByText(portal.latest.empty, { exact: true })).toBeVisible()
            const link = page
              .getByRole('navigation', { name: portal.nav.label, exact: true })
              .getByRole('link', { name: navName(portal.nav.inbox) })
            const countsResponse = await counts
            expect(countsResponse.ok()).toBe(true)
            expect(await countsResponse.json()).toMatchObject({ total: 0 })
            await expect(link).toHaveAccessibleName(portal.nav.inbox)
            await expect(link.locator('[data-nav-count]')).toHaveCount(0)
            expect(errors).toEqual([])
          })
        })
})

const inbox = '/en/spaces/inbox'
const portal = MESSAGES.en.Portal
const inboxLink = (page: Page) =>
  page
    .getByRole('navigation', { name: portal.nav.label, exact: true })
    .getByRole('link', { name: navName(portal.nav.inbox) })
const chipOf = (page: Page) => inboxLink(page).locator('[data-nav-count]')
const totalOf = (page: Page) => page.locator('main section[data-needs] h2 > span')
const write = (page: Page, id: number, data: object) =>
  page.request.patch(`/api/articles/${id}?depth=0&locale=en`, { data })

test.describe('portal Inbox with a small review queue', () => {
  test.describe.configure({ timeout: 120_000 })

  const queue = test.extend<{
    queue: {
      admin: Awaited<ReturnType<typeof account>>
      secondAdmin: Awaited<ReturnType<typeof account>>
      student: Awaited<ReturnType<typeof account>>
      draft: number
      submit: () => Promise<unknown>
    }
  }>({
    queue: async ({}, run) => {
      const payload = await getPayload({ config, key: uniq('portal-home-small-queue') })
      mailOff(payload)
      const { track, cleanup } = createTracker()
      const { create, submit } = trustedWrites(payload, track)
      const links: string[] = []
      try {
        const admin = await account(payload, track, 'admin', 'small-queue-admin')
        const secondAdmin = await account(payload, track, 'admin', 'small-queue-admin2')
        const student = await account(payload, track, 'student', 'small-queue-owner')
        const article = async (name: string) => {
          const id = await create('articles', {
            title: name,
            slug: uniq(name),
            authors: [student.person],
            tier: 'owner',
            review: { status: 'draft' },
          })
          links.push(`/admin/collections/articles/${id}`)
          return id
        }
        await submit('articles', await article('waiting'))
        const draft = await article('next-review')
        await run({ admin, secondAdmin, student, draft, submit: () => submit('articles', draft) })
      } finally {
        try {
          if (links.length > 0) {
            await payload.delete({
              collection: 'notifications',
              where: { link: { in: links } },
              overrideAccess: true,
            })
          }
        } finally {
          await cleanup(payload)
        }
      }
    },
  })

  queue(
    'an owner submits in a second session and the admin Inbox adds the row and updates its count with no reload',
    async ({ browser, baseURL, queue: { admin, student, draft } }) => {
      const at = { baseURL, viewport: WIDTHS.desktop }
      await inContext(browser, at, async (page) => {
        await observeWorkStream(page)
        await login({ page, user: admin, next: inbox })
        await expect(page.locator('html')).toHaveAttribute('data-work-stream-open', 'true')
        await expect(inboxLink(page)).toHaveAccessibleName('Inbox, 1 task')
        await expect(chipOf(page)).toHaveText('1')
        await expect(totalOf(page)).toHaveText('1')
        const newRow = page.locator('main section[data-needs]').getByText('next-review', {
          exact: true,
        })
        await expect(newRow).toHaveCount(0)
        await page.evaluate(() => {
          document.body.dataset.noReloadMark = 'true'
        })
        let lostChip = false
        const watch = setInterval(() => {
          void chipOf(page)
            .count()
            .then((count) => {
              if (count === 0) lostChip = true
            })
            .catch(() => {
              lostChip = true
            })
        }, 100)
        try {
          await inContext(browser, at, async (owner) => {
            await login({ page: owner, user: student, next: inbox })
            const response = await write(owner, draft, {
              _status: 'draft',
              review: { status: 'submitted' },
            })
            expect(response.ok(), await response.text()).toBe(true)
          })
          await expect(inboxLink(page)).toHaveAccessibleName('Inbox, 2 tasks', { timeout: 5_000 })
          await expect(chipOf(page)).toHaveText('2')
          await expect(totalOf(page)).toHaveText('2')
          await expect(newRow).toBeVisible()
        } finally {
          clearInterval(watch)
        }
        expect(lostChip).toBe(false)
        await expect(page.locator('body')).toHaveAttribute('data-no-reload-mark', 'true')
      })
    },
  )

  queue(
    "a second admin's number is right after a reload",
    async ({ browser, baseURL, queue: { admin, secondAdmin, draft, submit } }) => {
      await submit()
      const at = { baseURL, viewport: WIDTHS.desktop }
      await inContext(browser, at, async (writer) => {
        await login({ page: writer, user: admin, next: inbox })
        await inContext(browser, at, async (reader) => {
          await login({ page: reader, user: secondAdmin, next: inbox })
          await expect(inboxLink(reader)).toHaveAccessibleName('Inbox, 2 tasks')
          const response = await write(writer, draft, {
            _status: 'published',
            review: { status: 'approved', review_note: null },
          })
          expect(response.ok(), await response.text()).toBe(true)
          await reader.reload()
          await expect(inboxLink(reader)).toHaveAccessibleName('Inbox, 1 task')
          await expect(chipOf(reader)).toHaveText('1')
          await expect(totalOf(reader)).toHaveText('1')
        })
      })
    },
  )
})
