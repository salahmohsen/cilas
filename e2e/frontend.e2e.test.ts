import { test, expect } from '@playwright/test'

import ar from '../messages/ar.json'
import en from '../messages/en.json'

for (const [locale, browserLanguage, title] of [
  ['en', 'ar', 'Cairo Institute of Liberal Arts and Sciences'],
  ['ar', 'en', 'معهد القاهرة للعلوم والآداب الحرة'],
]) {
  test(`renders the ${locale} homepage`, async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'Accept-Language': browserLanguage })
    const response = await page.goto(`/${locale}`)
    expect(response?.status()).toBe(200)
    expect(await response!.headerValue('set-cookie')).toBeNull()
    await expect(page).toHaveTitle(title)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('navigation').first()).toBeVisible()
  })
}

test('the root path uses the browser language or falls back to English', async ({ request }) => {
  for (const [language, locale] of [
    ['ar-EG', 'ar'],
    ['fr-FR', 'en'],
  ]) {
    const response = await request.get('/', {
      headers: { 'Accept-Language': language },
      maxRedirects: 0,
    })
    expect(response.status()).toBe(307)
    expect(new URL(response.headers().location!, response.url()).pathname).toBe(`/${locale}`)
  }
})

test('the root path remembers the language switch', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en' })
  await page.goto('/')
  await expect(page).toHaveURL(/\/en$/)

  await page.getByRole('link', { name: en.Language.switchToLabel, exact: true }).click()
  await expect(page).toHaveURL(/\/ar$/)
  await page.goto('/en')
  await page.goto('/')
  await expect(page).toHaveURL(/\/ar$/)

  await page.getByRole('link', { name: ar.Language.switchToLabel, exact: true }).click()
  await expect(page).toHaveURL(/\/en$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/en$/)
})
