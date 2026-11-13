import type { Formats } from 'next-intl'

import { numberingSystemOf } from '@/lib/digits'

/**
 * The site's named formats in a language. Arabic pages write the numbers the
 * site itself produces in Arabic-Indic digits, as Egyptian print does, so
 * every format takes the locale's numbering system; messages pass their
 * numbers through the `digits` format (`{count, number, digits}`).
 */
export const formatsOf = (locale: string) => {
  const numberingSystem = numberingSystemOf(locale)
  return {
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
  } satisfies Formats
}
