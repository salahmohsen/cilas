import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { useToastStack } from '@/components/arc/toast-stack/toast-stack'
import { announceAuthChange } from '@/lib/auth-events'
import { forgetThisDevice } from '@/lib/push/forget'

/**
 * Ends the session on this device, then reloads, so nothing of the account
 * stays on the page. Throws when the server keeps the session: the page stays.
 */
export const signOut = async (): Promise<void> => {
  announceAuthChange()
  // This device stops getting the account's alerts (needs the session, so first).
  await forgetThisDevice()
  const res = await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
  if (!res.ok) throw new Error(`logout answered ${res.status}`)
  window.location.reload()
}

/** Sign out for a control: when the server keeps the session, a toast says so and the page stays. */
export function useSignOut(): () => Promise<void> {
  const t = useTranslations('Session')
  const { toast } = useToastStack()
  return useCallback(
    () =>
      signOut().catch(() => {
        toast({ type: 'error', title: t('signOutFailed') })
      }),
    [t, toast],
  )
}
