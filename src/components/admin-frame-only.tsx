'use client'

import { useSyncExternalStore } from 'react'

const noop = () => () => {}
const framed = () => window.self !== window.top

/**
 * Whether the page is open inside the admin (live preview or visual editor
 * iframe). Draft mode is a cookie, so it stays on after a preview: a page
 * opened later in its own tab must still look like the public page.
 */
export const useInAdminFrame = () => useSyncExternalStore(noop, framed, () => false)

/** Its children only inside the admin's preview frame. */
export function AdminFrameOnly({ children }: { children: React.ReactNode }) {
  return useInAdminFrame() ? children : null
}
