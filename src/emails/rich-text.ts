import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { MENTION_TYPES } from '@/blocks/mention'
import { flattenRichTextColumns } from '@/lib/flatten-rich-text-columns'
import { referenceKey, type RichTextReferences } from '@/lib/rich-text-references'

type Node = {
  type: string
  children?: Node[]
  fields?: Record<string, unknown>
  [key: string]: unknown
}
const text = (value: string): Node => ({
  type: 'text',
  version: 1,
  text: value,
  format: 0,
  mode: 'normal',
  detail: 0,
  style: '',
})
const paragraph = (children: Node[]): Node => ({
  type: 'paragraph',
  version: 1,
  children,
  format: '',
  indent: 0,
  direction: null,
})

export const emailRichTextHTML = (
  data: unknown,
  references: RichTextReferences = {},
  serverURL = '',
  locale = 'en',
): string => {
  if (!data || typeof data !== 'object' || !('root' in data)) return ''
  const linked = (collection: string, value: unknown, label?: string, summary = false): Node[] => {
    const resolved = references[referenceKey(collection, value)]
    if (!resolved) return label ? [text(label)] : []
    const href = `${serverURL.replace(/\/$/, '')}/${locale}${resolved.href}`
    const node: Node = {
      type: 'link',
      version: 3,
      format: '',
      indent: 0,
      direction: null,
      fields: { linkType: 'custom', url: href, newTab: false },
      children: [text(label ?? resolved.preview.title)],
    }
    return summary
      ? [paragraph([node, ...(resolved.preview.text ? [text(` — ${resolved.preview.text}`)] : [])])]
      : [node]
  }
  const walk = (node: Node): Node[] => {
    const fields = node.fields ?? {}
    if (node.type === 'inlineBlock' && fields.blockType === 'mention') {
      const kind = MENTION_TYPES.find((t) => t.value === fields.type)
      return kind
        ? linked(kind.relationTo, fields[kind.value], String(fields.label ?? ''))
        : [text(String(fields.label ?? ''))]
    }
    if ((node.type === 'link' || node.type === 'autolink') && fields.linkType === 'internal') {
      const ref = fields.doc as { relationTo: string; value: unknown } | undefined
      const resolved = ref && references[referenceKey(ref.relationTo, ref.value)]
      const children = (node.children ?? []).flatMap(walk)
      return resolved
        ? [
            {
              ...node,
              fields: {
                ...fields,
                linkType: 'custom',
                url: `${serverURL.replace(/\/$/, '')}/${locale}${resolved.href}`,
              },
              children,
            },
          ]
        : children
    }
    if (node.type === 'relationship' || fields.blockType === 'relatedContent') {
      const ref = (node.type === 'relationship' ? node : fields.document) as {
        relationTo: string
        value: unknown
      }
      return ref ? linked(ref.relationTo, ref.value, undefined, true) : []
    }
    if (node.type === 'block' || node.type === 'inlineBlock') {
      if (fields.blockType === 'columns') {
        return ['first', 'second', 'third', 'fourth']
          .slice(0, Number(fields.columnCount ?? 2))
          .flatMap((key) => {
            const column = fields[key] as { root?: Node } | undefined
            return column?.root?.children?.flatMap(walk) ?? []
          })
      }
      if (fields.blockType === 'personProfile')
        return linked('people', fields.person, undefined, true)
      if (fields.blockType === 'gallery') {
        return ((fields.images ?? []) as { image?: unknown; caption?: string }[]).flatMap((row) => [
          ...(row.image && typeof row.image === 'object'
            ? [{ type: 'upload', version: 3, relationTo: 'media', value: row.image } as Node]
            : []),
          ...(row.caption ? [paragraph([text(row.caption)])] : []),
        ])
      }
      if (fields.blockType === 'movie') {
        const movie = fields.movie as { title?: string } | undefined
        return movie?.title ? [paragraph([text(movie.title)])] : []
      }
      return []
    }
    return [{ ...node, ...(node.children ? { children: node.children.flatMap(walk) } : {}) }]
  }
  const flattened = flattenRichTextColumns(data as SerializedEditorState)
  const root = walk(flattened.root as unknown as Node)[0]
  return convertLexicalToHTML({
    data: { root } as unknown as SerializedEditorState,
    converters: ({ defaultConverters }) => ({
      ...defaultConverters,
      unknown: () => '',
      upload: ({ node }) => {
        const media = node.value as { url?: string | null; alt?: string | null } | number
        if (typeof media !== 'object' || !media?.url) return ''
        const alt = (media.alt ?? '').replace(/"/g, '&quot;')
        return `<img src="${media.url}" alt="${alt}" width="552" style="display:block;width:100%;max-width:100%;height:auto;border-radius:10px;margin:20px 0" />`
      },
    }),
  })
}
