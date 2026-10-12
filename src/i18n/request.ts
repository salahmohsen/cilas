import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'

import { numberingSystemOf } from '@/lib/digits'

import { routing } from './routing'

/**
 * Messages and formats per request. Arabic pages write the numbers the site
 * itself produces in Arabic-Indic digits, as Egyptian print does, so every
 * format takes the locale's numbering system; messages pass their numbers
 * through the `digits` format (`{count, number, digits}`).
 */
export default getRequestConfig(async ({ locale: override }) => {
  const requested = override ?? (await rootParams.locale())
  if (!hasLocale(routing.locales, requested)) notFound()
  const locale = requested
  const numberingSystem = numberingSystemOf(locale)

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Africa/Cairo',
    formats: {
      dateTime: {
        day: { day: 'numeric', month: 'long', year: 'numeric', numberingSystem },
        month: { month: 'long', year: 'numeric', numberingSystem },
        year: { year: 'numeric', numberingSystem },
      },
      number: {
        plain: { numberingSystem },
        // Counts, years and page numbers: no thousands separator, so 2014 stays 2014.
        digits: { numberingSystem, useGrouping: false },
      },
    },
  }
})
