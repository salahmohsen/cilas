/** Arabic letters join their neighbours. */
export const JOINING = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/

/**
 * The pieces a label may move in. A letter in a box of its own loses its joined
 * shape, and boxes in a row lose the order of a mixed direction line, so text in
 * a joining script stays whole. Other text moves letter by letter.
 */
export const textUnits = (text: string): string[] => (JOINING.test(text) ? [text] : [...text])
