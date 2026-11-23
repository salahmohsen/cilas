import { expect, test } from '@playwright/test'

import { articleSlug, courseSlug } from '../scripts/smoke.fixture'

const paths = [
  ...['en', 'ar'].flatMap((locale) =>
    [
      '',
      '/contact',
      `/study/${courseSlug}`,
      `/articles/${articleSlug}`,
      '/study/bridge',
      '/study/bridge/apply',
    ].map((page) => `/${locale}${page}`),
  ),
  '/en/study',
  '/en/events',
  '/en/login',
]

for (const path of paths) {
  test(`production JavaScript renders ${path}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const response = await page.goto(path, { waitUntil: 'networkidle' })

    expect(response?.status()).toBe(200)
    await expect(page.locator('.site-header')).toBeVisible()
    await expect(page.getByRole('heading').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'This page couldn’t load' })).toHaveCount(0)
    expect(errors).toEqual([])

    if (path.endsWith('/study/bridge/apply')) {
      await expect(page.getByRole('textbox', { name: 'Why apply?' })).toBeVisible()
    }
    if (path === '/en' || path === '/en/contact') {
      const name = page.getByRole('textbox', { name: 'Name', exact: true })
      await name.fill('Smoke visitor')
      await expect(name).toHaveValue('Smoke visitor')
      await page.getByRole('button', { name: 'Send message', exact: true }).click()
      await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveAttribute(
        'aria-invalid',
        'true',
      )
    }
  })
}
