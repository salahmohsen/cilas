import { render, type RenderOptions } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'

import ar from '../messages/ar.json'
import en from '../messages/en.json'
import { formatsOf } from '../src/i18n/formats'
import type { Locale } from '../src/i18n/routing'
import { CAIRO } from '../src/lib/cairo-day'

export const messagesOf = { en, ar }

/** The real next-intl client provider, set up as `src/i18n/request.ts` sets up a request. */
export function IntlProvider({
  locale = 'en',
  children,
}: {
  locale?: Locale
  children: ReactNode
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messagesOf[locale]}
      timeZone={CAIRO}
      formats={formatsOf(locale)}
    >
      {children}
    </NextIntlClientProvider>
  )
}

/** `render` inside `IntlProvider`, so `useTranslations` and `useLocale` read the real messages. */
export const renderWithIntl = (
  ui: ReactNode,
  { locale = 'en', ...options }: RenderOptions & { locale?: Locale } = {},
) =>
  render(ui, {
    wrapper: ({ children }) => <IntlProvider locale={locale}>{children}</IntlProvider>,
    ...options,
  })
