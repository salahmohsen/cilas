/**
 * Digits as each language writes them. Arabic pages show the numbers the site
 * itself writes (dates, times, counts, row numbers) in Arabic-Indic digits,
 * ٠١٢٣٤٥٦٧٨٩, as Egyptian print does. Text from the content (titles, notes)
 * keeps whatever digits it was written with, and so do things people copy or
 * type: addresses, links, form fields and the calendar feed.
 */

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'

/** The numbering system a locale's own numbers use, for `Intl` formats. */
export const numberingSystemOf = (locale: string): 'arab' | 'latn' => (locale === 'ar' ? 'arab' : 'latn')

/** `text` with its Western digits written as `locale` writes them. */
export const localDigits = (text: string | number, locale: string): string => {
  const s = String(text)
  return locale === 'ar' ? s.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]) : s
}

/**
 * The direction a time range like 17:00–21:00 is held in. Western digits need
 * left to right on an Arabic page, or it reads 21:00–17:00; Arabic-Indic digits
 * are Arabic numbers to the bidi algorithm and read right only in the page's
 * own flow, start time first, so they get none.
 */
export const timeDir = (locale: string): 'ltr' | undefined => (locale === 'ar' ? undefined : 'ltr')

/** `text` with Arabic-Indic (and Persian) digits written as Western ones, for search and parsing. */
export const latinDigits = (text: string): string =>
  text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
