import { expect, test } from '@playwright/test'

import { EMPTY_ACCOUNTS } from '../seed/empty'
import { login } from '../testing/login.test-utils'
import { inContext, LOCALES, MESSAGES, WIDTHS } from '../testing/portal.fixture'
import { navName } from '../testing/portal-e2e.test-utils'

type Role = keyof typeof EMPTY_ACCOUNTS

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
            await login({ page, user: EMPTY_ACCOUNTS[role], next: target })
            await page.waitForURL(`**${target}`)
            const portal = MESSAGES[locale].Portal
            await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(portal.inbox.title)
            await expect(page.getByText(portal.needs.empty, { exact: true })).toBeVisible()
            await expect(page.getByText(portal.latest.empty, { exact: true })).toBeVisible()
            const link = page
              .getByRole('navigation', { name: portal.nav.label, exact: true })
              .getByRole('link', { name: navName(portal.nav.inbox) })
            await expect(link).toHaveAccessibleName(portal.nav.inbox)
            await expect(link.locator('[data-nav-count]')).toHaveCount(0)
            expect(errors).toEqual([])
          })
        })
})
