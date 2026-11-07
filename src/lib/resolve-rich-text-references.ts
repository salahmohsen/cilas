import { MENTION_TYPES } from '@/blocks/mention'
import { otherLocale, type Locale } from '@/i18n/routing'
import { resolveMentionDocument } from '@/lib/mentions'
import {
  documentsIn,
  referenceKey,
  walkEditorNodes,
  type RichTextReferences,
} from '@/lib/rich-text-references'
import type { User } from '@/payload-types'
import type { Payload } from 'payload'
type Reader = User | null

export const resolveRichTextReferences = async (
  payload: Payload,
  data: unknown,
  { locale, user = null }: { locale: Locale; user?: Reader },
): Promise<RichTextReferences> => {
  const wanted = new Map<string, Set<number>>()
  const add = (collection: unknown, value: unknown) => {
    if (typeof collection !== 'string' || !MENTION_TYPES.some((t) => t.relationTo === collection))
      return
    const key = referenceKey(collection, value)
    const id = Number(key.slice(collection.length + 1))
    if (!key || !Number.isSafeInteger(id) || id <= 0) return
    if (!wanted.has(collection)) wanted.set(collection, new Set())
    wanted.get(collection)!.add(id)
  }
  for (const doc of documentsIn(data))
    walkEditorNodes(doc, (node) => {
      const fields = node.fields
      if (fields?.blockType === 'mention') {
        const type = MENTION_TYPES.find((t) => t.value === fields.type)
        if (type) add(type.relationTo, fields[type.value])
      }
      if (fields?.blockType === 'relatedContent') {
        const ref = fields.document as { relationTo?: string; value?: unknown } | undefined
        add(ref?.relationTo, ref?.value)
      }
      if (fields?.blockType === 'personProfile') add('people', fields.person)
      if (node.type === 'relationship') add(node.relationTo, node.value)
      if (node.type === 'link' && fields?.linkType === 'internal') {
        const ref = fields.doc as { relationTo?: string; value?: unknown } | undefined
        add(ref?.relationTo, ref?.value)
      }
    })
  const out: RichTextReferences = {}
  for (const { value, relationTo } of MENTION_TYPES) {
    const ids = wanted.get(relationTo)
    if (!ids?.size) continue
    const { docs } = await payload.find({
      collection: relationTo,
      where: { id: { in: [...ids] } },
      locale,
      fallbackLocale: otherLocale(locale),
      depth: 1,
      pagination: false,
      draft: false,
      user,
      overrideAccess: false,
    })
    for (const doc of docs) {
      if ('_status' in doc && doc._status !== 'published') continue
      if ('visible' in doc && doc.visible === false) continue
      const resolved = resolveMentionDocument(value, doc as unknown as Record<string, unknown>)
      if (resolved) out[referenceKey(relationTo, doc.id)] = resolved
    }
  }
  return out
}
