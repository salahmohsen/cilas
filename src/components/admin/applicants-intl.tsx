'use client'

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import type { ReactNode } from 'react'

/**
 * The admin has no locale route, so the public form's text comes from here.
 * A client file, so next-intl's server request config is never asked for a locale.
 */
export function ApplicantsIntl({
  locale,
  messages,
  children,
}: {
  locale: string
  messages: AbstractIntlMessages
  children: ReactNode
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={{ Forms: messages }}>
      {children}
    </NextIntlClientProvider>
  )
}
