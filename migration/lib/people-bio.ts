import type { Payload } from 'payload'

import { lexical } from '../../seed/seed.utils'
import { withSubject } from './flow-notes'
import { isMostlyArabic, splitLocales } from './normalise-courses'

/**
 * Writes an archived bio to a person, each language to its own locale: the
 * old site often gave a bio in English and Arabic one after the other, and
 * an English page should not show the Arabic half (or the reverse). The
 * person's name is required in every locale written, so an Arabic bio
 * brings the Arabic name, or the name as written.
 */
export const writeBio = async (
  payload: Payload,
  id: number,
  { name, nameAr, bio }: { name: string; nameAr?: string | null; bio: string },
): Promise<void> => {
  const { en, ar } = splitLocales(bio)
  if (en.trim()) {
    const paras = withSubject(name, en).split(/\n\s*\n/)
    await payload.update({ collection: 'people', id, data: { bio: lexical(paras, 'ltr') }, locale: 'en', overrideAccess: true })
  }
  if (ar.trim()) {
    const arName = nameAr ?? (isMostlyArabic(name) ? name : null)
    await payload.update({
      collection: 'people',
      id,
      data: { ...(arName ? { name: arName } : {}), bio: lexical(ar.split(/\n\s*\n/), 'rtl') },
      locale: 'ar',
      overrideAccess: true,
    })
  }
}
