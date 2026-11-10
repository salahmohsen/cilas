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

type Option = { id?: string | null; value?: string | null; label?: string | null }

type Question = {
  blockType?: string
  id?: string | null
  name?: string | null
  label?: string | null
  options?: readonly Option[] | null
}

const shortId = (id: string | null | undefined) =>
  (id ?? crypto.randomUUID())
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toLowerCase()

/**
 * Gives each row without a `key` one, once. A row saved before (`saved`,
 * matched by row id) keeps its value even when its label changes, because
 * answers refer to it. A new row's value comes from its label, or
 * `<prefix>_<id>` when the label has no Latin letters or digits. A value
 * already taken in the list, or in `reserved`, gets `_2`, `_3` and so on.
 */
const fill = <R extends { id?: string | null; label?: string | null }>(
  rows: readonly R[],
  key: 'name' | 'value',
  prefix: string,
  saved: readonly R[],
  reserved: readonly string[],
  skip: (row: R) => boolean = () => false,
): R[] => {
  const get = (row: R) => (row as Record<string, unknown>)[key] as string | null | undefined
  const savedValues = new Map(saved.flatMap((r) => (r.id && get(r) ? [[r.id, get(r)!]] : [])))
  const kept = rows.map((r) =>
    get(r) || !r.id || !savedValues.has(r.id) ? r : { ...r, [key]: savedValues.get(r.id) },
  )
  const taken = new Set([...reserved, ...kept.flatMap((r) => get(r) ?? [])])
  return kept.map((row) => {
    if (get(row) || skip(row)) return row
    const base = toQuestionName(row.label ?? '') || `${prefix}_${shortId(row.id)}`
    let value = base
    for (let n = 2; taken.has(value); n++) value = `${base.slice(0, 39 - String(n).length)}_${n}`
    taken.add(value)
    return { ...row, [key]: value }
  })
}

/**
 * Names each question that has no name, and gives each of its options that
 * has no value one, the same way: see `fill`.
 */
export const nameQuestions = <B extends Question>(
  blocks: readonly B[],
  { saved = [], reserved = [] }: { saved?: readonly Question[]; reserved?: readonly string[] } = {},
): (B & Pick<Question, 'name'>)[] => {
  const savedBlocks = new Map(saved.flatMap((b) => (b.id ? [[b.id, b]] : [])))
  return fill(
    blocks,
    'name',
    'question',
    saved as readonly B[],
    reserved,
    (b) => b.blockType === 'message',
  ).map((block) =>
    block.options
      ? {
          ...block,
          options: fill(
            block.options,
            'value',
            'option',
            (block.id && savedBlocks.get(block.id)?.options) || [],
            [],
          ),
        }
      : block,
  )
}
