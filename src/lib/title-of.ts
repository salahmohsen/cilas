import type { Locale } from '@/i18n/routing'

const trimmed = (value: string | null | undefined) => value?.trim() || null

/**
 * The title a row shows, in the reader's locale, else in the other one, else
 * `null`. The one rule for a localized title: a plain string stands for itself,
 * and a title of only whitespace is no title.
 */
export const titleOf = (value: unknown, locale: Locale) => {
  if (typeof value === 'string') return trimmed(value)
  const titles = (value ?? {}) as Record<string, string | null | undefined>
  return trimmed(titles[locale]) ?? trimmed(titles[locale === 'en' ? 'ar' : 'en'])
}
