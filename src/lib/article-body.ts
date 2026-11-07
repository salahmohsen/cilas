import { plainText } from '@/lib/plaintext'

import type { Article } from '@/payload-types'

type Body = NonNullable<Article['body']>
type Node = Body['root']['children'][number]

/** The heading the importer puts above an essay's notes (migration/lib/blocks.ts). */
const NOTES_HEADINGS = new Set(['Notes', 'ملاحظات'])

const textOf = (node: Node): string =>
  plainText({
    data: {
      root: { type: 'root', children: [node], direction: null, format: '', indent: 0, version: 1 },
    },
  })
    .replace(/\s+/g, ' ')
    .trim()

const withChildren = (body: Body, children: Node[]): Body => ({
  ...body,
  root: { ...body.root, children },
})

export type Section = { id: string; title: string }

/** The heading level that marks an essay's sections. */
export type SectionTag = 'h2' | 'h3'

/**
 * Splits an essay into its text and its notes, and lists its sections.
 * The notes are everything after the closing "Notes" heading. Sections are
 * the h2 headings; an essay with none (some imports start at h3) uses its
 * h3 headings. Section ids are `section-<n>` in order; the page gives the
 * headings of `sectionTag` the same ids.
 */
export const splitBody = (
  body: Article['body'],
): {
  text: Body | null
  notes: Body | null
  noteCount: number
  sections: Section[]
  sectionTag: SectionTag
} => {
  if (!body?.root?.children?.length)
    return { text: null, notes: null, noteCount: 0, sections: [], sectionTag: 'h2' }
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
  const headingsOf = (tag: SectionTag) => main.filter((n) => n.type === 'heading' && n.tag === tag)
  const h2s = headingsOf('h2')
  const sectionTag: SectionTag = h2s.length ? 'h2' : 'h3'
  const sections = (h2s.length ? h2s : headingsOf('h3')).map((n, i) => ({
    id: `section-${i + 1}`,
    title: textOf(n),
  }))
  return {
    text: withChildren(body, main),
    notes: notes.length ? withChildren(body, notes) : null,
    noteCount: notes.length,
    sections,
    sectionTag,
  }
}
