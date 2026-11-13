import { CAIRO } from '@/lib/cairo-day'
import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'

import { withSavedPrompts } from '@/lib/study-prompts'

import { formatsOf } from './formats'
import { routing } from './routing'

const fromRoute = async () => rootParams.locale()

/** Messages and formats per request (formats: `./formats`). */
export default getRequestConfig(async ({ locale: override, requestLocale }) => {
  // A server action has no route, so root params throw there; it sets the locale itself.
  const requested = override ?? (await fromRoute().catch(() => requestLocale))
  if (!hasLocale(routing.locales, requested)) notFound()
  const locale = requested

  return {
    locale,
    messages: await withSavedPrompts(
      (await import(`../../messages/${locale}.json`)).default,
      locale,
    ),
    timeZone: CAIRO,
    formats: formatsOf(locale),
  }
})
