import { expect, test } from '@playwright/test'

const CLEAR = 'rgba(0, 0, 0, 0)'

const scrollTo = (top: number) => window.scrollTo({ top, behavior: 'instant' })

for (const path of ['/en', '/ar', '/en/articles']) {
  test(`the header turns solid after a small scroll (${path})`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`${path}`, { timeout: 90_000 })
    const header = page.locator('.site-header')
    await page.evaluate(scrollTo, 250)
    await expect(header).not.toHaveCSS('background-color', CLEAR)
  })
}

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
    await page.goto(`/en`, { timeout: 90_000 })
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
    await page.goto(`/${locale}`, { timeout: 90_000 })
    const brand = page.locator('.site-header [data-brand]')
    await expect(brand).toHaveCSS('opacity', '0')
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
  await page.goto(`/en/articles`, { timeout: 90_000 })
  await expect(page.locator('.site-header [data-brand]')).toHaveCSS('opacity', '1')
})
