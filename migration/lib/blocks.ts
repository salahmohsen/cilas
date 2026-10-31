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
        children: [
          element('paragraph', direction, inlineToLexical(text, direction), {
            textFormat: '',
            textStyle: '',
          }),
        ],
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
export const inlineToLexical = (
  text: string,
  direction: Direction,
  footnotes?: Footnotes,
): LexicalChild[] => {
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
  element('paragraph', direction, inlineToLexical(text, direction, footnotes), {
    textFormat: '',
    textStyle: '',
  })

const heading = (text: string, level: number, direction: Direction, footnotes?: Footnotes) =>
  element('heading', direction, inlineToLexical(text, direction, footnotes), {
    tag: `h${Math.min(4, Math.max(2, level))}`,
  })

/** Leading dash or tilde of an attribution line ("– Pascal", "~ Darwish"). */
const ATTRIBUTION_LEAD = /^\s*[~–—-]\s*/
const MARKERS = /\[\^\d+\]/g

/** True for a short line that names a source: no sentence of its own, parentheses balanced. */
const looksLikeAttribution = (text: string): boolean => {
  const bare = text.replace(MARKERS, '').trim()
  return (
    bare.length > 1 &&
    bare.length <= 120 &&
    /\p{L}/u.test(bare) &&
    !/[“”"«»]/.test(bare) &&
    (bare.match(/\(/g) ?? []).length === (bare.match(/\)/g) ?? []).length
  )
}

/**
 * A quotation and the line that names its source, if the text carries one:
 * a last line starting with a dash or tilde, or a short name after the
 * closing quotation mark ("…the unknown.” – Blaise Pascal[^25]").
 */
export const splitAttribution = (text: string): [string, string | null] => {
  const lines = text.split('\n')
  const last = lines.at(-1) ?? ''
  if (
    lines.length > 1 &&
    ATTRIBUTION_LEAD.test(last) &&
    looksLikeAttribution(last.replace(ATTRIBUTION_LEAD, ''))
  ) {
    return [lines.slice(0, -1).join('\n').trimEnd(), last.replace(ATTRIBUTION_LEAD, '').trim()]
  }
  const m = text.match(/^([\s\S]*[”"»])\.?\s*[~–—-]?\s*([^”"«»\n]+)$/)
  if (m && looksLikeAttribution(m[2])) return [m[1].trimEnd(), m[2].trim()]
  return [text, null]
}

/** A quote: the quotation, then (after a line break) "— Source", which the site sets as its citation. */
const quote = (text: string, direction: Direction, footnotes?: Footnotes): LexicalChild => {
  const [quotation, source] = splitAttribution(text)
  const children = inlineToLexical(quotation, direction, footnotes)
  if (source)
    children.push(
      { type: 'linebreak', version: 1 } as LexicalChild,
      ...inlineToLexical(`— ${source}`, direction, footnotes),
    )
  return element('quote', direction, children)
}

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

  // A source line printed as its own paragraph after a quote joins the quote.
  const joined: Block[] = []
  for (const b of blocks) {
    const prev = joined.at(-1)
    const attribution =
      b.type === 'paragraph' &&
      prev?.type === 'quote' &&
      !splitAttribution(prev.text)[1] &&
      (ATTRIBUTION_LEAD.test(b.text)
        ? looksLikeAttribution(b.text.replace(ATTRIBUTION_LEAD, ''))
        : looksLikeAttribution(b.text) &&
          /\[\^\d+\]\s*$/.test(b.text) &&
          !/\.\s*\[\^\d+\]\s*$/.test(b.text))
    if (attribution && prev)
      joined[joined.length - 1] = {
        ...prev,
        text: `${prev.text}\n— ${b.text.replace(ATTRIBUTION_LEAD, '').trim()}`,
      }
    else joined.push(b)
  }

  for (const block of joined) {
    if (block.type !== 'list_item') list = null
    if (block.type === 'note') {
      notes.push(block)
    } else if (block.type === 'heading') {
      children.push(heading(block.text, block.level ?? 2, direction, footnotes))
    } else if (block.type === 'quote') {
      children.push(quote(block.text, direction, footnotes))
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
