import { expect, test } from '@playwright/test'

const BASE = 'http://localhost:3000'
const CLEAR = 'rgba(0, 0, 0, 0)'

const scrollTo = (top: number) => window.scrollTo({ top, behavior: 'instant' })

for (const locale of ['en', 'ar']) {
  test(`the header is clear over the home hero and solid past it (${locale})`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`${BASE}/${locale}`, { timeout: 90_000 })
    const header = page.locator('.site-header')

    await expect(header).toHaveCSS('background-color', CLEAR)

    // Scrolled, so solid anywhere else, but still over the hero: clear.
    await page.evaluate(scrollTo, 250)
    await expect(header).toHaveAttribute('data-scrolled', /.*/)
    await expect(header).toHaveCSS('background-color', CLEAR)

    await page.evaluate(scrollTo, await page.evaluate(() => window.innerHeight * 1.5))
    await expect(header).not.toHaveCSS('background-color', CLEAR)

    await page.evaluate(scrollTo, 0)
    await expect(header).toHaveCSS('background-color', CLEAR)
  })
}

test('elsewhere the header turns solid after a small scroll, as before', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto(`${BASE}/en/articles`, { timeout: 90_000 })
  const header = page.locator('.site-header')
  await page.evaluate(scrollTo, 400)
  await expect(header).not.toHaveCSS('background-color', CLEAR)
})
