import { CAIRO } from '@/lib/cairo-day'
import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'

import { numberingSystemOf } from '@/lib/digits'
import { withSavedPrompts } from '@/lib/study-prompts'

import { routing } from './routing'

const fromRoute = async () => rootParams.locale()

/**
 * Messages and formats per request. Arabic pages write the numbers the site
 * itself produces in Arabic-Indic digits, as Egyptian print does, so every
 * format takes the locale's numbering system; messages pass their numbers
 * through the `digits` format (`{count, number, digits}`).
 */
export default getRequestConfig(async ({ locale: override, requestLocale }) => {
  // A server action has no route, so root params throw there; it sets the locale itself.
  const requested = override ?? (await fromRoute().catch(() => requestLocale))
  if (!hasLocale(routing.locales, requested)) notFound()
  const locale = requested
  const numberingSystem = numberingSystemOf(locale)

  return {
    locale,
    messages: await withSavedPrompts(
      (await import(`../../messages/${locale}.json`)).default,
      locale,
    ),
    timeZone: CAIRO,
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
