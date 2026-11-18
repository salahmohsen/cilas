import type { Page } from '@playwright/test'

export async function formScreenshot(page: Page, path: string) {
  // Hiding carets mutates inline input styles and can race React hydration.
  await page.screenshot({ path, fullPage: true, caret: 'initial' })
}
