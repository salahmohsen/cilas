'use client'

import { catchError } from 'next/error'
import { useTranslations } from 'next-intl'

import { PortalPageHeader } from '@/portal/lists/page-header'

/** If the greeting's read fails, the page keeps its one `<h1>` ("Hello.") and the cards stay. */
export const GreetingBoundary = catchError(function GreetingFallback() {
  const t = useTranslations('Portal.home')
  return <PortalPageHeader title={t('greeting')} />
})
