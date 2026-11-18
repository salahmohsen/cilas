import type { Page } from '@playwright/test'

export async function formScreenshot(page: Page, path: string) {
  await page.screenshot({ path, fullPage: true, caret: 'initial' })
}
