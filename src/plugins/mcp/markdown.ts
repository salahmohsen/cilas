import { randomUUID } from 'node:crypto'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Payload } from 'payload'

import { articleBodyFeatures } from '@/lexical/article-body'

import { ToolInputError } from './errors'

/** The same rule as the profile page: a link is a web or mail link, nothing else. */
const linksAreSafe = (markdown: string): boolean =>
  [...markdown.matchAll(/\]\(\s*<?([^)\s>]*)/g)].every(([, url]) =>
    /^(https?:|mailto:|#)/i.test(url ?? ''),
  )

export type MarkdownTarget = 'default' | 'article'

/**
 * Markdown to the Lexical state a field stores. A course description and a form's
 * confirmation use the site's default editor; an article body uses the article editor, so the
 * conversion knows the same nodes the field does.
 */
export const markdownToLexical = async (
  payload: Payload,
  target: MarkdownTarget,
  markdown: string,
): Promise<SerializedEditorState> => {
  if (!linksAreSafe(markdown)) {
    throw new ToolInputError(
      'A link in the Markdown does not start with https:, http: or mailto:. Use a web link or remove it.',
    )
  }
  const editorConfig = await (target === 'article'
    ? editorConfigFactory.fromFeatures({ config: payload.config, features: articleBodyFeatures })
    : editorConfigFactory.default({ config: payload.config }))
  if (target !== 'article') return convertMarkdownToLexical({ editorConfig, markdown })
  const definitions = new Map<string, string>()
  let fenced = false
  const lines = markdown.split('\n')
  const body: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const definition = !fenced && line.match(/^\[\^([^\]]+)\]:\s*(.*)$/)
    if (!definition) {
      body.push(line)
      continue
    }
    const [, key, first] = definition
    if (definitions.has(key!)) throw new ToolInputError(`Duplicate footnote definition: ${key}`)
    let note = first!
    while (i + 1 < lines.length && /^( {4}|\t)/.test(lines[i + 1]!))
      note += `\n${lines[++i]!.replace(/^( {4}|\t)/, '')}`
    definitions.set(key!, note)
  }
  const state = convertMarkdownToLexical({ editorConfig, markdown: body.join('\n') })
  const used = new Set<string>()
  type Node = { type: string; text: string; children?: Node[]; [key: string]: unknown }
  const walk = async (node: Node): Promise<void> => {
    if (!Array.isArray(node.children) || node.type === 'code') return
    const children: Node[] = []
    for (const child of node.children) {
      if (child.type !== 'text' || !/\[\^([^\]]+)\]/.test(child.text)) {
        await walk(child)
        children.push(child)
        continue
      }
      let cursor = 0
      for (const match of child.text.matchAll(/\[\^([^\]]+)\]/g)) {
        const note = definitions.get(match[1])
        if (note === undefined)
          throw new ToolInputError(`Footnote ${match[1]} has no definition. Nothing was saved.`)
        if (match.index > cursor)
          children.push({ ...child, text: child.text.slice(cursor, match.index) })
        used.add(match[1])
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
