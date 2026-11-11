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
  // Pages declare their own hreflang links (src/lib/seo.ts). The middleware's
  // Link header builds them from the proxied http:// request and disagrees.
  alternateLinks: false,
})

export type Locale = (typeof routing.locales)[number]

export const localeOf = (value: unknown): Locale =>
  routing.locales.find((locale) => locale === value) ?? routing.defaultLocale

export const isRtl = (locale: string): boolean => locale === 'ar'

export const otherLocale = (locale: string): Locale => (locale === 'ar' ? 'en' : 'ar')
