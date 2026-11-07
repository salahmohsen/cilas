import { test, expect } from '@playwright/test'

for (const [locale, title] of [
  ['en', 'Cairo Institute of Liberal Arts and Sciences'],
  ['ar', 'معهد القاهرة للعلوم والآداب الحرة'],
]) {
  test(`renders the ${locale} homepage`, async ({ page }) => {
    const response = await page.goto(`http://localhost:3000/${locale}`)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(title)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('navigation').first()).toBeVisible()
  })
}
