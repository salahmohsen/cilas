import type {} from '@vitest/browser-playwright'
import { cdp, page, server } from 'vitest/browser'

export const emulateMedia = (features: Record<string, string>) =>
  cdp().send('Emulation.setEmulatedMedia', {
    features: Object.entries(features).map(([name, value]) => ({ name, value })),
  })

export const resetMedia = async () => {
  const { width, height } = server.config.browser.viewport
  await page.viewport(width, height)
  await emulateMedia({})
}
