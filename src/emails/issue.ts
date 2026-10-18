import type { Payload, PayloadRequest } from 'payload'

import type { PickRelation } from './cards'
import type { Issue } from './newsletter'

/**
 * A newsletter issue's latest draft, its picks filled in for the cards.
 *
 * Reading the draft populates relationships from their drafts too, and a
 * document never saved as a draft (most imported ones) has no version row,
 * so it comes back as a bare id: those are read again as published. A
 * cycle's courses come from a query, as its join holds only ids at this depth.
 */
export const issueForEmail = async (payload: Payload, id: number, req?: PayloadRequest) => {
  const local = { overrideAccess: true, locale: 'en' as const, req }
  const issue = (await payload.findByID({ collection: 'newsletters', id, depth: 2, draft: true, ...local })) as Issue & {
    title: string
    sent_at?: string | null
  }
  for (const section of issue.sections ?? []) {
    if (section.blockType !== 'picks') continue
    for (const pick of section.items ?? []) {
      const item = pick.item as { relationTo: PickRelation; value: unknown } | null | undefined
      if (!item) continue
      if (typeof item.value === 'number') {
        item.value = await payload
          .findByID({ collection: item.relationTo, id: item.value, depth: 1, ...local })
          .catch(() => null)
      }
      if (item.relationTo === 'cycles' && item.value && typeof item.value === 'object') {
        const { docs } = await payload.find({
          collection: 'courses',
          where: {
            and: [
              { cycle: { equals: (item.value as { id: number }).id } },
              { _status: { equals: 'published' } },
              { tier: { equals: 'public' } },
            ],
          },
          sort: 'title',
          depth: 0,
          limit: 20,
          ...local,
        })
        ;(item.value as { courses?: unknown }).courses = { docs }
      }
    }
  }
  return issue
}
