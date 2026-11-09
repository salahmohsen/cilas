import { randomUUID } from 'node:crypto'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Payload } from 'payload'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

import { articleBodyFeatures } from '@/lexical/article-body'
import { ToolInputError } from './errors'

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkStringify)
type MarkdownNode =
  | ReturnType<typeof processor.parse>
  | ReturnType<typeof processor.parse>['children'][number]
export type MarkdownTarget = 'default' | 'article'

export const markdownToLexical = async (
  payload: Payload,
  target: MarkdownTarget,
  markdown: string,
): Promise<SerializedEditorState> => {
  const tree = processor.parse(markdown)
  const definitions = new Map<string, string>()
  const references = new Map<string, string>()
  const scan = (node: MarkdownNode): void => {
    if ('url' in node && !/^(https?:|mailto:|#)/i.test(node.url)) {
      throw new ToolInputError(
        'A link in the Markdown does not start with https:, http: or mailto:. Use a web link or remove it.',
      )
    }
    if (target === 'article' && node.type === 'footnoteDefinition') {
      if (definitions.has(node.identifier))
        throw new ToolInputError(`Duplicate footnote definition: ${node.identifier}`)
      definitions.set(
        node.identifier,
        processor.stringify({ type: 'root', children: node.children }),
      )
      return
    }
    if ('children' in node) node.children.forEach(scan)
  }
  scan(tree)
  const rewrite = (node: MarkdownNode): MarkdownNode => {
    if (node.type === 'footnoteReference') {
      const token = `MCPFOOTNOTE${randomUUID().replaceAll('-', '')}`
      references.set(token, node.identifier)
      return { type: 'text', value: token }
    }
    if (node.type === 'text') {
      const raw = markdown.slice(node.position?.start.offset, node.position?.end.offset)
      for (const match of raw.matchAll(/(\\*)\[\^([^\]]+)\]/g)) {
        if (match[1].length % 2 === 0)
          throw new ToolInputError(`Footnote ${match[2]} has no definition. Nothing was saved.`)
      }
    }
    if ('children' in node)
      Object.assign(node, {
        children: node.children.filter((child) => child.type !== 'footnoteDefinition').map(rewrite),
      })
    return node
  }
  const editorConfig = await (target === 'article'
    ? editorConfigFactory.fromFeatures({ config: payload.config, features: articleBodyFeatures })
    : editorConfigFactory.default({ config: payload.config }))
  if (target !== 'article') return convertMarkdownToLexical({ editorConfig, markdown })
  const state = convertMarkdownToLexical({
    editorConfig,
    markdown: processor.stringify(rewrite(tree) as typeof tree),
  })
  const used = new Set<string>()
  type Node = { type: string; text: string; children?: Node[]; [key: string]: unknown }
  const pattern = /MCPFOOTNOTE[a-f0-9]{32}/g
  const walk = async (node: Node): Promise<void> => {
    if (!Array.isArray(node.children)) return
    const children: Node[] = []
    for (const child of node.children) {
      if (child.type !== 'text') {
        await walk(child)
        children.push(child)
        continue
      }
      let cursor = 0
      for (const match of child.text.matchAll(pattern)) {
        const key = references.get(match[0])
        if (key === undefined) continue
        const note = definitions.get(key)
        if (note === undefined)
          throw new ToolInputError(`Footnote ${key} has no definition. Nothing was saved.`)
        if (match.index > cursor)
          children.push({ ...child, text: child.text.slice(cursor, match.index) })
        used.add(key)
        children.push({
          text: '',
          type: 'inlineBlock',
          version: 1,
          format: '',
          fields: {
            id: randomUUID(),
            blockType: 'footnote',
            note: await markdownToLexical(payload, 'default', note),
          },
        })
        cursor = match.index + match[0].length
      }
      if (cursor < child.text.length) children.push({ ...child, text: child.text.slice(cursor) })
    }
    node.children = children
  }
  await walk(state.root as unknown as Node)
  for (const key of definitions.keys())
    if (!used.has(key))
      throw new ToolInputError(`Footnote ${key} has no reference. Nothing was saved.`)
  return state
}
