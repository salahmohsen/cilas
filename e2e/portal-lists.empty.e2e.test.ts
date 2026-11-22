import { expect, test } from '@playwright/test'

import { EMPTY_ACCOUNTS } from '../seed/empty'
import { login } from '../testing/login.test-utils'
import { inContext, LOCALES, MESSAGES, WIDTHS, type Locale } from '../testing/portal.fixture'
import { axeOver } from '../testing/portal-e2e.test-utils'

type Role = keyof typeof EMPTY_ACCOUNTS

const CASES = [
  {
    role: 'student',
    path: '/spaces/articles',
    view: 'ownerArticles',
    action: { label: 'writeArticle', href: '/admin/collections/articles/create' },
  },
  {
    role: 'fellow',
    path: '/spaces/articles',
    view: 'ownerArticles',
    action: { label: 'writeArticle', href: '/admin/collections/articles/create' },
  },
  {
    role: 'fellow',
    path: '/spaces/courses',
    view: 'fellowCourses',
    action: { label: 'proposeCourse', href: '/admin/collections/courses/create' },
  },
  { role: 'admin', path: '/spaces/articles', view: 'adminArticles', action: null },
  {
    role: 'admin',
    path: '/spaces/courses',
    view: 'adminCourses',
    action: { label: 'openDashboard', href: '/admin' },
  },
] as const satisfies readonly {
  role: Role
  path: string
  view: string
  action: { label: string; href: string } | null
}[]

const emptyCard = (page: import('@playwright/test').Page, locale: Locale, view: string) => {
  const t = MESSAGES[locale].Portal.lists.empty[view as 'ownerArticles']
  return page.locator('main div', {
    has: page.getByRole('heading', { level: 2, name: t.title, exact: true }),
  })
}

test.describe('portal lists on the empty seed', () => {
  test.describe.configure({ timeout: 120_000 })

  for (const { role, path, view, action } of CASES)
    for (const locale of LOCALES)
      for (const viewport of Object.values(WIDTHS))
        test(`an empty list shows its role's empty state (${role} ${path} ${locale} ${viewport.width})`, async ({
          browser,
        }) => {
          const baseURL = test.info().project.use.baseURL
          await inContext(browser, { baseURL, viewport }, async (page) => {
            const target = `/${locale}${path}`
            await login({ page, user: EMPTY_ACCOUNTS[role], next: target })
            await page.waitForURL(`**${target}`)
            const lists = MESSAGES[locale].Portal.lists
            const t = lists.empty[view as 'ownerArticles']
            const card = emptyCard(page, locale, view).last()
            await expect(card).toBeVisible()
            await expect(card).toContainText(t.body)
            if ('next' in t) await expect(card).toContainText(t.next)
            const links = card.getByRole('link')
            if (action) {
              await expect(links).toHaveCount(1)
              await expect(links).toHaveText(lists[action.label])
              await expect(links).toHaveAttribute('href', action.href)
            } else await expect(links).toHaveCount(0)
            await expect(page.locator('section[data-list-group]')).toHaveCount(0)
            await expect(
              page.getByRole('navigation', { name: lists.chips.label, exact: true }),
            ).toHaveCount(0)
            await expect(page.getByRole('search')).toHaveCount(0)
            expect(await axeOver(page, {})).toEqual({})
          })
        })
})
