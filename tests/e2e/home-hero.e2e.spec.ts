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

// CMS-managed copy may extend below the fold; it must stay inside the hero's clipping bounds.
for (const size of [
  { width: 1280, height: 720 },
  { width: 1366, height: 660 },
]) {
  test(`the hero contains its title and numbers (${size.width}×${size.height})`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(size)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`${BASE}/en`, { timeout: 90_000 })
    const hero = page.locator('.home-hero')
    await expect(hero.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(hero.locator('.home-numbers')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const contained = await hero.evaluate((el) => {
      const bounds = el.getBoundingClientRect()
      return ['h1', '.home-hero-actions', '.home-numbers'].map((selector) => {
        const content = el.querySelector(selector)!.getBoundingClientRect()
        return (
          content.top >= bounds.top - 1 &&
          content.bottom <= bounds.bottom + 1 &&
          content.left >= bounds.left - 1 &&
          content.right <= bounds.right + 1
        )
      })
    })
    expect(contained).toEqual([true, true, true])
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
