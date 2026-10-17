import { expect, test } from '@playwright/test'

const BASE = 'http://localhost:3000'
const CLEAR = 'rgba(0, 0, 0, 0)'

const scrollTo = (top: number) => window.scrollTo({ top, behavior: 'instant' })

// The hero starts under the header, so the header behaves on the home page as
// it does everywhere: solid as soon as the page scrolls.
for (const path of ['/en', '/ar', '/en/articles']) {
  test(`the header turns solid after a small scroll (${path})`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`${BASE}${path}`, { timeout: 90_000 })
    const header = page.locator('.site-header')
    await page.evaluate(scrollTo, 250)
    await expect(header).not.toHaveCSS('background-color', CLEAR)
  })
}

// Two short laptop screens: the copy and its numbers still fit above the fold.
for (const size of [
  { width: 1280, height: 720 },
  { width: 1366, height: 660 },
]) {
  test(`the hero ends at the fold, its numbers inside it (${size.width}×${size.height})`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(size)
    await page.goto(`${BASE}/en`, { timeout: 90_000 })
    const hero = page.locator('.home-hero')
    const bottom = await hero.evaluate((el) => el.getBoundingClientRect().bottom)
    expect(bottom).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight + 1))
    await expect(hero.locator('.home-numbers')).toBeInViewport()
  })
}

for (const locale of ['en', 'ar']) {
  test(`the header's brand waits for the hero's name to scroll away (${locale})`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.goto(`${BASE}/${locale}`, { timeout: 90_000 })
    const brand = page.locator('.site-header [data-brand]')
    await expect(brand).toHaveCSS('opacity', '0')
    // Hidden, the brand link is out of the tab order too.
    await expect(brand.locator('a')).toBeHidden()

    await page.evaluate(scrollTo, 600)
    await expect(brand).toHaveCSS('opacity', '1')
    await expect(brand.locator('a')).toBeVisible()

    await page.evaluate(scrollTo, 0)
    await expect(brand).toHaveCSS('opacity', '0')
  })
}

test('elsewhere the header shows its brand from the start', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto(`${BASE}/en/articles`, { timeout: 90_000 })
  await expect(page.locator('.site-header [data-brand]')).toHaveCSS('opacity', '1')
})
