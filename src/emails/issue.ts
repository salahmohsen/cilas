import type { Payload, PayloadRequest } from 'payload'

import type { Issue } from './newsletter'
import { PICK_TYPES } from './pick-types'
import { resolveRichTextReferences } from '@/lib/resolve-rich-text-references'

/**
 * A newsletter issue's latest draft, its picks filled in for the cards.
 *
 * Reading the draft populates relationships from their drafts too, and a
 * document never saved as a draft (most imported ones) has no version row,
 * so it comes back as a bare id: those are read again as published. A
 * cycle's public courses are read with their covers and fellows, as each
 * shows as a full card.
 */
export const issueForEmail = async (payload: Payload, id: number, req?: PayloadRequest) => {
  const local = { overrideAccess: true, locale: 'en' as const, req }
  const issue = (await payload.findByID({
    collection: 'newsletters',
    id,
    depth: 2,
    draft: true,
    ...local,
  })) as Issue & {
    send_to?: number | { id: number } | null
    title: string
    sent_at?: string | null
  }
  for (const section of issue.sections ?? []) {
    if (section.blockType !== 'picks') continue
    for (const pick of section.items ?? []) {
      const type = PICK_TYPES.find((t) => t.value === pick.type)
      if (!type) continue
      const value = pick[type.value]
      if (typeof value === 'number') {
        pick[type.value] = await payload
          .findByID({ collection: type.relationTo, id: value, depth: 1, ...local })
          .catch(() => null)
      }
      const doc = pick[type.value] as { id?: number; courses?: unknown } | null
      if (type.value === 'cycle' && doc?.id) {
        const { docs } = await payload.find({
          collection: 'courses',
          where: {
            and: [
              { cycle: { equals: doc.id } },
              { _status: { equals: 'published' } },
              { tier: { equals: 'public' } },
            ],
          },
          sort: 'title',
          depth: 1,
          limit: 20,
          ...local,
        })
        doc.courses = { docs }
      }
    }
  }
  issue.references = await resolveRichTextReferences(payload, issue, { locale: 'en', user: null })
  return issue
}
