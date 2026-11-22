import { createFormatter, createTranslator } from 'next-intl'
import type { getFormatter, getTranslations } from 'next-intl/server'

import { CAIRO } from '../src/lib/cairo-day'
import { formatsOf } from '../src/i18n/formats'
import type { Locale } from '../src/i18n/routing'
import { messagesOf } from './intl.test-utils'

type Namespace = 'Events' | 'Spaces' | 'Calendar.eventTypes' | 'Portal' | 'Study.filters'

/** The real next-intl translator for a namespace, with the app's formats and time zone (`src/i18n/request.ts`), typed as `getTranslations` types its result. */
export const serverTranslator = <Scope extends Namespace>(
  namespace: Scope,
  locale: Locale = 'en',
) =>
  createTranslator({
    locale,
    messages: messagesOf[locale],
    namespace: namespace as never,
    formats: formatsOf(locale),
    timeZone: CAIRO,
  }) as unknown as Awaited<ReturnType<typeof getTranslations<Scope>>>

/** The real next-intl formatter in the Cairo time zone, typed as `getFormatter` types its result. */
export const serverFormatter = (locale: Locale = 'en') =>
  createFormatter({ locale, timeZone: CAIRO }) as Awaited<ReturnType<typeof getFormatter>>
