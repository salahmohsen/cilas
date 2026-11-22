import type { Locale } from '@/i18n/routing'

/**
 * The title a row shows, in the reader's locale, else in the other one, else
 * `null`. The one rule for a localized title: a plain string stands for itself.
 */
export const titleOf = (value: unknown, locale: Locale) => {
  if (typeof value === 'string') return value || null
  const titles = (value ?? {}) as Record<string, string | null | undefined>
  return titles[locale] || titles[locale === 'en' ? 'ar' : 'en'] || null
}
