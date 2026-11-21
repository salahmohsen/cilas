import { localDigits } from '@/lib/digits'

/** Above this, a count shows as "9+" and reads as "more than 9" (spec, Navigation). */
const CAP = 9

/** The words for a count in the reader's language: `shown` and `cap` already carry the page's digits. */
export type UnreadWords = {
  some: (values: { count: number; shown: string }) => string
  many: (values: { cap: string }) => string
}

/**
 * An unread count as the site writes it: `shown` for the badge or circle,
 * `spoken` for the accessible name. Every count badge reads it from here.
 */
export const unreadCount = (
  count: number,
  locale: string,
  words: UnreadWords,
): { shown: string; spoken: string } => {
  if (count > CAP) {
    const cap = localDigits(CAP, locale)
    return { shown: `${cap}+`, spoken: words.many({ cap }) }
  }
  const shown = localDigits(count, locale)
  return { shown, spoken: words.some({ count, shown }) }
}
