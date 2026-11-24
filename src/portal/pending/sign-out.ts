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
    const { ok } = await pending.flush()
    if (!ok) {
      toast({ type: 'error', title: t('Portal.pending.signOutStopped') })
      return
    }
    try {
      await signOut()
    } catch {
      toast({ type: 'error', title: t('Session.signOutFailed') })
    }
  }, [pending, t, toast])
}
