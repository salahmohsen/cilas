import type {} from '@vitest/browser-playwright'
import { cdp } from 'vitest/browser'

type Setting = 'granted' | 'denied' | 'prompt'

export const setClipboardAccess = async (setting: Setting) => {
  const { targetInfo } = (await cdp().send('Target.getTargetInfo')) as {
    targetInfo: { browserContextId?: string }
  }
  for (const name of ['clipboard-write', 'clipboard-read'])
    await cdp().send('Browser.setPermission', {
      permission: { name },
      setting,
      browserContextId: targetInfo.browserContextId,
    })
  window.focus()
}
