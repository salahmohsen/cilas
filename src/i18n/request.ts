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
export default getRequestConfig(async (params) => {
  // `requestLocale` is a getter that reads the request's headers, which makes a page dynamic.
  // Destructuring it would call it on every request, so it is read only when the route has no locale.
  // A server action has no route, so root params throw there; it sets the locale itself.
  const requested = params.locale ?? (await fromRoute().catch(() => params.requestLocale))
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
