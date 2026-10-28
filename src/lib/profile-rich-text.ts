import { walkEditorNodes } from '@/lib/rich-text-references'
import { plainText } from '@/lib/plaintext'

const editableNodes = new Set([
  'root',
  'paragraph',
  'text',
  'linebreak',
  'heading',
  'list',
  'listitem',
  'quote',
  'link',
  'autolink',
  'horizontalrule',
])

export const profileBioReadOnly = (data: unknown): boolean => {
  let readOnly = false
  walkEditorNodes(data, (node) => {
    const value = node as typeof node & {
      format?: string | number
      indent?: number
      tag?: string
      listType?: string
    }
    if (!editableNodes.has(node.type ?? '')) readOnly = true
    if (typeof value.format === 'number' && (value.format & ~23) !== 0) readOnly = true
    if (typeof value.format === 'string' && value.format !== '') readOnly = true
    if (value.indent) readOnly = true
    if (node.type === 'heading' && !['h1', 'h2', 'h3'].includes(value.tag ?? '')) readOnly = true
    if (value.listType === 'check' || node.fields?.linkType === 'internal') readOnly = true
  })
  return readOnly
}

export const protectedBioText = (data: unknown): string =>
  data && typeof data === 'object' && 'root' in data
    ? plainText({ data: data as { root: unknown } }).trim()
    : ''
