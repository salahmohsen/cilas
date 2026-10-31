/** Hebrew, Arabic, Syriac, Thaana, N'Ko and the Arabic presentation forms. */
const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/
/** A letter that sets a direction: Latin, Greek, Cyrillic, or a right-to-left script. */
const STRONG = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ֐-ࣿיִ-﷿ﹰ-﻿]/

/**
 * The direction of a text, from its first strong letter, as `dir="auto"`
 * decides it. Use it where CSS must know the direction: the build turns
 * `:dir()` into `:lang()` lists, which follow the page language, not the text.
 */
export function textDirection(text: string): 'ltr' | 'rtl' {
  const first = text.match(STRONG)?.[0]
  return first && RTL.test(first) ? 'rtl' : 'ltr'
}
