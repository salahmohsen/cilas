import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'

import { routing } from './routing'

/**
 * Messages and formats per request. Arabic pages use Western digits with
 * Arabic month names, matching the printed Arabic texts, so every format
 * pins `numberingSystem: 'latn'`.
 */
export default getRequestConfig(async ({ locale: override }) => {
  const requested = override ?? (await rootParams.locale())
  if (!hasLocale(routing.locales, requested)) notFound()
  const locale = requested

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Africa/Cairo',
    formats: {
      dateTime: {
        day: { day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' },
        month: { month: 'long', year: 'numeric', numberingSystem: 'latn' },
        year: { year: 'numeric', numberingSystem: 'latn' },
      },
      number: {
        plain: { numberingSystem: 'latn' },
      },
    },
  }
})
