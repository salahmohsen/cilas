import { defineRouting } from 'next-intl/routing'

/**
 * Site languages (CONTEXT.md). Every public URL carries one, always
 * (ADR 0006); a bare path redirects to the saved choice, the browser's
 * language, then English.
 */
export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]

export const localeOf = (value: unknown): Locale =>
  routing.locales.find((locale) => locale === value) ?? routing.defaultLocale

export const isRtl = (locale: string): boolean => locale === 'ar'

export const otherLocale = (locale: string): Locale => (locale === 'ar' ? 'en' : 'ar')
