import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

type MdNode = { type: string; value?: string; children?: MdNode[] }

/** Blocks that end a line of text. */
const BLOCKS = new Set(['paragraph', 'heading', 'code', 'tableCell'])

/**
 * The words of a Markdown text, one line per paragraph, heading or code
 * block, without its syntax: what a search index or a word count reads.
 * Raw HTML tags are left out, as the page drops them; the text between stays.
 */
export const markdownText = (markdown: string): string => {
  const walk = (node: MdNode): string => {
    if (node.type === 'html') return ''
    if (node.type === 'break') return '\n'
    if (typeof node.value === 'string') return node.value
    const inner = (node.children ?? []).map(walk).join('')
    return BLOCKS.has(node.type) ? `${inner}\n` : inner
  }
  return walk(unified().use(remarkParse).use(remarkGfm).parse(markdown) as MdNode)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}
