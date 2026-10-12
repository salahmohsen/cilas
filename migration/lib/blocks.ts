import type { LexicalChild, LexicalJSON } from '../../seed/seed.type'

export type Block = {
  type: 'heading' | 'paragraph' | 'quote' | 'list_item' | 'note'
  level?: number | null
  text: string
}

type Direction = 'ltr' | 'rtl'

const textNode = (text: string, format = 0): LexicalChild => ({
  type: 'text',
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text,
  version: 1,
})

/** Fields every Lexical element node carries (see ElementNode.exportJSON). */
const element = (
  type: string,
  direction: Direction,
  children: LexicalChild[],
  extra: object = {},
): LexicalChild => ({
  type,
  format: '',
  indent: 0,
  version: 1,
  direction,
  children,
  ...extra,
})

const BOLD = 1
const LINK = /\[([^\]]*)\]\(([^)\s]+)\)/g

/** Text with `[label](url)` links: link nodes around text nodes of the given format. */
const withLinks = (text: string, format: number, direction: Direction): LexicalChild[] => {
  const out: LexicalChild[] = []
  let last = 0
  for (const match of text.matchAll(LINK)) {
    if (match.index > last) out.push(textNode(text.slice(last, match.index), format))
    out.push(
      element('link', direction, [textNode(match[1].trim() || match[2], format)], {
        fields: { url: match[2], newTab: false, linkType: 'custom' },
        version: 3,
      }),
    )
    last = match.index + match[0].length
  }
  if (last < text.length) out.push(textNode(text.slice(last), format))
  return out
}

/** A note's number and text: "25 Pascal, Pensées" → 25, "Pascal, Pensées". */
const NOTE_NUMBER = /^\s*(\d+)\s*/
const FOOTNOTE = /\[\^(\d+)\]/g

/** Notes by number, and the ones already placed in the text as footnotes. */
type Footnotes = { notes: Map<number, string>; used: Set<number> }

/** A Footnote inline block (src/blocks/footnote.ts) holding the note's text. */
const footnote = (number: number, text: string, direction: Direction): LexicalChild => ({
  type: 'inlineBlock',
  version: 1,
  fields: {
    id: `fn${number}`,
    blockType: 'footnote',
    blockName: '',
    note: {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction,
        children: [element('paragraph', direction, inlineToLexical(text, direction), { textFormat: '', textStyle: '' })],
      },
    },
  },
})

/**
 * Inline content: `**bold**` becomes bold text (format 1) and `[label](url)` a
 * custom link. Markers around only whitespace, and an unpaired `**`, are
 * dropped rather than shown. With `footnotes`, a `[^n]` marker becomes a
 * Footnote inline block holding note n.
 */
export const inlineToLexical = (text: string, direction: Direction, footnotes?: Footnotes): LexicalChild[] => {
  if (footnotes && FOOTNOTE.test(text)) {
    FOOTNOTE.lastIndex = 0
    const out: LexicalChild[] = []
    let last = 0
    for (const match of text.matchAll(FOOTNOTE)) {
      if (match.index > last) out.push(...inlineToLexical(text.slice(last, match.index), direction))
      const number = Number(match[1])
      const note = footnotes.notes.get(number)
      if (note !== undefined) {
        out.push(footnote(number, note, direction))
        footnotes.used.add(number)
      }
      last = match.index + match[0].length
    }
    if (last < text.length) out.push(...inlineToLexical(text.slice(last), direction))
    return out
  }
  FOOTNOTE.lastIndex = 0
  const parts = text.split('**')
  const paired = parts.length % 2 === 1
  const out: LexicalChild[] = []
  parts.forEach((part, i) => {
    if (!part) return
    const bold = paired && i % 2 === 1 && part.trim() !== ''
    out.push(...withLinks(part, bold ? BOLD : 0, direction))
  })
  return out.length ? out : [textNode(text)]
}

const paragraph = (text: string, direction: Direction, footnotes?: Footnotes) =>
  element('paragraph', direction, inlineToLexical(text, direction, footnotes), { textFormat: '', textStyle: '' })

const heading = (text: string, level: number, direction: Direction, footnotes?: Footnotes) =>
  element('heading', direction, inlineToLexical(text, direction, footnotes), {
    tag: `h${Math.min(4, Math.max(2, level))}`,
  })

/**
 * Typed article blocks as a Lexical document: real headings, quotes and lists.
 * A `[^n]` marker in the text becomes a footnote holding note n (see
 * src/blocks/footnote.ts); notes no marker points to go last under one
 * "Notes" heading. No blocks → null.
 */
export const blocksToLexical = (blocks: Block[], direction: Direction): LexicalJSON | null => {
  if (blocks.length === 0) return null

  const children: LexicalChild[] = []
  const notes: Block[] = []
  let list: LexicalChild | null = null
  const footnotes: Footnotes = { notes: new Map(), used: new Set() }
  for (const b of blocks) {
    const m = b.type === 'note' ? b.text.match(NOTE_NUMBER) : null
    if (m) footnotes.notes.set(Number(m[1]), b.text.slice(m[0].length))
  }

  for (const block of blocks) {
    if (block.type !== 'list_item') list = null
    if (block.type === 'note') {
      notes.push(block)
    } else if (block.type === 'heading') {
      children.push(heading(block.text, block.level ?? 2, direction, footnotes))
    } else if (block.type === 'quote') {
      children.push(element('quote', direction, inlineToLexical(block.text, direction, footnotes)))
    } else if (block.type === 'list_item') {
      if (!list) {
        list = element('list', direction, [], { listType: 'bullet', tag: 'ul', start: 1 })
        children.push(list)
      }
      const items = list.children as LexicalChild[]
      items.push(
        element('listitem', direction, inlineToLexical(block.text, direction, footnotes), {
          value: items.length + 1,
        }),
      )
    } else {
      children.push(paragraph(block.text, direction, footnotes))
    }
  }

  // Notes placed as footnotes are not repeated at the end.
  const rest = notes.filter((n) => {
    const m = n.text.match(NOTE_NUMBER)
    return !(m && footnotes.used.has(Number(m[1])))
  })
  if (rest.length) {
    children.push(heading(direction === 'rtl' ? 'ملاحظات' : 'Notes', 3, direction))
    for (const note of rest) children.push(paragraph(note.text, direction))
  }

  return { root: { type: 'root', format: '', indent: 0, version: 1, direction, children } }
}
