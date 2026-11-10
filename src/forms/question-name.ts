/**
 * A question's machine name: the key its answers are saved under, in forms,
 * course questions and the assistant's questions alike.
 */
export const QUESTION_NAME = /^[a-z][a-z0-9_]{0,39}$/

export const QUESTION_NAME_RULE =
  'Use lower-case letters, digits and underscores, starting with a letter, at most 40 characters (e.g. motivation).'

/** The machine name a label suggests, or '' when it has no Latin letters or digits. */
export const toQuestionName = (label: string): string => {
  const words = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const name = /^[0-9]/.test(words) ? `q_${words}` : words
  return name.slice(0, 40).replace(/_+$/, '')
}
