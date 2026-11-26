import { expect, test } from '@playwright/test'

for (const tab of ['account', 'articles', 'calendar', 'courses', 'inbox']) {
  test(`the ${tab} tab sends a signed-out reader to login`, async ({ request }) => {
    const response = await request.get(`/en/spaces/${tab}`, { maxRedirects: 0 })

    expect(response.status()).toBe(307)
    expect(response.headers().location).toMatch(/^\/en\/login\?next=/)
  })
}
