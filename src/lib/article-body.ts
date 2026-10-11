import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'

import type { Article } from '@/payload-types'

type Body = NonNullable<Article['body']>
type Node = Body['root']['children'][number]

/** The heading the importer puts above an essay's notes (migration/lib/blocks.ts). */
const NOTES_HEADINGS = new Set(['Notes', 'ملاحظات'])

const textOf = (node: Node): string =>
  convertLexicalToPlaintext({ data: { root: { type: 'root', children: [node], direction: null, format: '', indent: 0, version: 1 } } })
    .replace(/\s+/g, ' ')
    .trim()

const withChildren = (body: Body, children: Node[]): Body => ({ ...body, root: { ...body.root, children } })

export type Section = { id: string; title: string }

/**
 * Splits an essay into its text and its notes, and lists its sections.
 * The notes are everything after the closing "Notes" heading. Section ids
 * are `section-<n>` in order; the page gives its h2 elements the same ids.
 */
export const splitBody = (
  body: Article['body'],
): { text: Body | null; notes: Body | null; noteCount: number; sections: Section[] } => {
  if (!body?.root?.children?.length) return { text: null, notes: null, noteCount: 0, sections: [] }
  const children = body.root.children
  let cut = -1
  for (let i = children.length - 1; i >= 0; i--) {
    const n = children[i]
    if (n.type === 'heading' && n.tag === 'h3' && NOTES_HEADINGS.has(textOf(n))) {
      cut = i
      break
    }
  }
  const main = cut === -1 ? children : children.slice(0, cut)
  const notes = cut === -1 ? [] : children.slice(cut + 1)
  const sections = main
    .filter((n) => n.type === 'heading' && n.tag === 'h2')
    .map((n, i) => ({ id: `section-${i + 1}`, title: textOf(n) }))
  return {
    text: withChildren(body, main),
    notes: notes.length ? withChildren(body, notes) : null,
    noteCount: notes.length,
    sections,
  }
}
