/**
 * Arabic text in visual order, for Satori (the share cards, src/lib/og-card.tsx).
 * Satori shapes Arabic itself but measures the unjoined letters, so words
 * overlap or drift apart. Here each letter becomes its joined presentation
 * form (U+FE70–U+FEFF), which needs no shaping, and the letters run in the
 * order they are drawn, left to right. Digits and Latin keep their order;
 * paired marks such as « » swap, as they mirror in right-to-left text.
 * Short vowels are dropped: Satori cannot place a mark over its letter.
 */

// [isolated, final, initial, medial]; two forms for letters that never join the next one.
const FORMS: Record<string, number[]> = {
  ء: [0xfe80],
  آ: [0xfe81, 0xfe82],
  أ: [0xfe83, 0xfe84],
  ؤ: [0xfe85, 0xfe86],
  إ: [0xfe87, 0xfe88],
  ئ: [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c],
  ا: [0xfe8d, 0xfe8e],
  ب: [0xfe8f, 0xfe90, 0xfe91, 0xfe92],
  ة: [0xfe93, 0xfe94],
  ت: [0xfe95, 0xfe96, 0xfe97, 0xfe98],
  ث: [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c],
  ج: [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0],
  ح: [0xfea1, 0xfea2, 0xfea3, 0xfea4],
  خ: [0xfea5, 0xfea6, 0xfea7, 0xfea8],
  د: [0xfea9, 0xfeaa],
  ذ: [0xfeab, 0xfeac],
  ر: [0xfead, 0xfeae],
  ز: [0xfeaf, 0xfeb0],
  س: [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4],
  ش: [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8],
  ص: [0xfeb9, 0xfeba, 0xfebb, 0xfebc],
  ض: [0xfebd, 0xfebe, 0xfebf, 0xfec0],
  ط: [0xfec1, 0xfec2, 0xfec3, 0xfec4],
  ظ: [0xfec5, 0xfec6, 0xfec7, 0xfec8],
  ع: [0xfec9, 0xfeca, 0xfecb, 0xfecc],
  غ: [0xfecd, 0xfece, 0xfecf, 0xfed0],
  ف: [0xfed1, 0xfed2, 0xfed3, 0xfed4],
  ق: [0xfed5, 0xfed6, 0xfed7, 0xfed8],
  ك: [0xfed9, 0xfeda, 0xfedb, 0xfedc],
  ل: [0xfedd, 0xfede, 0xfedf, 0xfee0],
  م: [0xfee1, 0xfee2, 0xfee3, 0xfee4],
  ن: [0xfee5, 0xfee6, 0xfee7, 0xfee8],
  ه: [0xfee9, 0xfeea, 0xfeeb, 0xfeec],
  و: [0xfeed, 0xfeee],
  ى: [0xfeef, 0xfef0],
  ي: [0xfef1, 0xfef2, 0xfef3, 0xfef4],
}
// Lam with an alef after it: one letter. [isolated, final]
const LAM_ALEF: Record<string, number[]> = {
  آ: [0xfef5, 0xfef6],
  أ: [0xfef7, 0xfef8],
  إ: [0xfef9, 0xfefa],
  ا: [0xfefb, 0xfefc],
}
const TATWEEL = 'ـ'
const MARKS = /[ً-ٰٟۖ-ۭ]/g
const MIRROR: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  '«': '»',
  '»': '«',
}
const ARABIC_RUN = /[؀-ۿﹰ-﻿]+/

const joinsNext = (c: string | undefined) =>
  c === TATWEEL || (c !== undefined && (FORMS[c]?.length ?? 0) === 4)
const joinsPrevious = (c: string | undefined) => c === TATWEEL || (c !== undefined && c in FORMS)

/** One word's Arabic letters, joined, in logical order. */
function join(letters: string): string {
  const chars = [...letters]
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const forms = FORMS[c]
    if (!forms) {
      out += c
      continue
    }
    const previous = joinsNext(chars[i - 1])
    const ligature = c === 'ل' ? LAM_ALEF[chars[i + 1]] : undefined
    if (ligature) {
      out += String.fromCodePoint(ligature[previous ? 1 : 0])
      i++
      continue
    }
    const next = forms.length === 4 && joinsPrevious(chars[i + 1])
    const form = previous ? (next ? 3 : 1) : next ? 2 : 0
    out += String.fromCodePoint(forms[form] ?? forms[previous ? 1 : 0])
  }
  return out
}

/** A word drawn left to right: its runs reversed, Arabic letters joined and reversed. */
export function arabicVisualWord(word: string): string {
  const runs: string[] = []
  let rest = word.replace(MARKS, '')
  while (rest) {
    const match = ARABIC_RUN.exec(rest)
    if (!match) {
      runs.push(rest)
      break
    }
    if (match.index > 0) runs.push(rest.slice(0, match.index))
    runs.push(
      [...join(match[0])]
        .reverse()
        .join('')
        // Arabic digits read left to right, inside right-to-left text too.
        .replace(/[٠-٩۰-۹]+/g, (digits) => [...digits].reverse().join('')),
    )
    rest = rest.slice(match.index + match[0].length)
  }
  return runs
    .reverse()
    .map((run) =>
      ARABIC_RUN.test(run)
        ? run
        : // Paired marks between Arabic letters mirror; digits and Latin keep their order.
          /^[^\p{L}\p{N}]+$/u.test(run)
          ? [...run]
              .reverse()
              .map((c) => MIRROR[c] ?? c)
              .join('')
          : run,
    )
    .join('')
}
