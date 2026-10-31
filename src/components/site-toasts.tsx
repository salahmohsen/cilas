'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { ToastStack, ToastStackProvider } from '@/components/arc/toast-stack/toast-stack'

/**
 * The site's one toast stack (Arc), at the reading end of the bottom edge.
 * Live notifications show here (src/components/site-notifications.tsx).
 */
export function SiteToasts({ children, rtl }: { children: ReactNode; rtl: boolean }) {
  const t = useTranslations('Notifications')
  return (
    <ToastStackProvider>
      {children}
      <ToastStack label={t('label')} position={rtl ? 'bottom-left' : 'bottom-right'} />
    </ToastStackProvider>
  )
}
