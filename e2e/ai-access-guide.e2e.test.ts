import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config.js'
import { createTracker, uniq, uniqEmail } from '../testing/payload.fixture'
import { login } from '../testing/login.test-utils'

const { track, cleanup } = createTracker()
const password = crypto.randomUUID()
const accounts = {
  admin: { email: uniqEmail('ai-guide-admin'), password },
  member: { email: uniqEmail('ai-guide-member'), password },
}
let payload: Payload

test.describe('AI access guide', () => {
  test.beforeAll(async () => {
    payload = await getPayload({ config, key: uniq('ai-access-guide') })
    for (const [role, account] of Object.entries(accounts)) {
      track(
        'users',
        await payload.create({
          collection: 'users',
          data: { ...account, roles: [role as 'admin' | 'member'] },
          overrideAccess: true,
        }),
      )
    }
  })

  test.afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  test('an administrator reads the guide under its title', async ({ page }) => {
    await login({ page, user: accounts.admin })
    await page.goto('/admin/ai-access')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Connect an AI assistant' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Connected assistants' })).toBeVisible()
    await expect(page.getByText('You do not have access to this page.')).toHaveCount(0)
  })

  test('a member sees the title and a refusal, and nothing of the guide', async ({ page }) => {
    await login({ page, user: accounts.member })
    await page.goto('/admin/ai-access')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Connect an AI assistant' }),
    ).toBeVisible()
    await expect(page.getByText('You do not have access to this page.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Connected assistants' })).toHaveCount(0)
  })
})
