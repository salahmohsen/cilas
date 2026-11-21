import { announceAuthChange } from '@/lib/auth-events'
import { forgetThisDevice } from '@/lib/push/forget'

/** Ends the session on this device, then reloads, so nothing of the account stays on the page. */
export const signOut = async (): Promise<void> => {
  announceAuthChange()
  // This device stops getting the account's alerts (needs the session, so first).
  await forgetThisDevice()
  await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
  window.location.reload()
}
