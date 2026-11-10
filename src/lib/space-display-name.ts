import type { FieldHook } from 'payload'

import { relId } from '@/lib/relation'

type Parent = { title?: unknown } | number | null | undefined

/**
 * afterRead for the spaces list's "Name" column. A populated relation already
 * carries its title; an ID (depth 0) costs one small read in the reader's
 * locale. A course space whose course is gone says so; a parent that
 * cannot be read shows its ID.
 */
export const spaceDisplayName: FieldHook = async ({ siblingData, req }) => {
  const kind = siblingData?.kind as string | undefined
  if (kind === 'community') {
    const name = siblingData?.name
    return typeof name === 'string' && name.trim() ? name.trim() : 'Community'
  }
  const field = kind === 'cohort' ? 'programme' : 'course'
  const parent = siblingData?.[field] as Parent
  if (parent && typeof parent === 'object' && typeof parent.title === 'string') return parent.title
  const id = relId(parent as never)
  const missing = kind === 'cohort' ? 'Programme deleted' : 'Course deleted'
  if (id == null) return missing
  const doc = await req.payload
    .findByID({
      collection: kind === 'cohort' ? 'programmes' : 'courses',
      id,
      depth: 0,
      locale: req.locale ?? undefined,
      overrideAccess: true,
      req,
      select: { title: true },
    })
    .catch(() => null)
  if (typeof doc?.title === 'string' && doc.title) return doc.title
  return `${kind === 'cohort' ? 'Programme' : 'Course'} #${id}`
}
