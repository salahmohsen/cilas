'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { useToastStack } from '@/components/arc/toast-stack/toast-stack'
import { signOut } from '@/lib/sign-out'

import { usePendingStore } from './pending-provider'

export function usePortalSignOut(): () => Promise<void> {
  const pending = usePendingStore()
  const t = useTranslations()
  const { toast } = useToastStack()

  return useCallback(async () => {
    // A decision made after the flush would commit without the session, so none starts until this ends.
    const release = pending.seal()
    try {
      const { ok } = await pending.flush()
      if (!ok) {
        toast({ type: 'error', title: t('Portal.pending.signOutStopped') })
        return
      }
      await signOut()
    } catch {
      toast({ type: 'error', title: t('Session.signOutFailed') })
    } finally {
      release()
    }
  }, [pending, t, toast])
}
