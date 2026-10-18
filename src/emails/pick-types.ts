import type { Where } from 'payload'

import type { PickRelation } from './cards'

/**
 * What a newsletter pick can be. The admin chooses the type first, then the
 * document from that type's list only (src/collections/Newsletters.ts).
 * `filter` keeps the list to what a visitor can open.
 */
export const PICK_TYPES = [
  {
    value: 'course',
    label: 'Course',
    relationTo: 'courses',
    filter: { and: [{ _status: { equals: 'published' } }, { tier: { equals: 'public' } }] },
  },
  {
    value: 'article',
    label: 'Article',
    relationTo: 'articles',
    filter: { and: [{ _status: { equals: 'published' } }, { tier: { equals: 'public' } }] },
  },
  {
    value: 'publication',
    label: 'Article collection',
    relationTo: 'publications',
    filter: { _status: { equals: 'published' } },
  },
  { value: 'cycle', label: 'Cycle (all its courses)', relationTo: 'cycles', filter: null },
  // Events have no drafts, so no `_status` to ask about.
  { value: 'event', label: 'Event', relationTo: 'events', filter: { tier: { equals: 'public' } } },
  {
    value: 'programme',
    label: 'The Bridge',
    relationTo: 'programmes',
    filter: { and: [{ kind: { equals: 'bridge' } }, { _status: { equals: 'published' } }] },
  },
] as const satisfies ReadonlyArray<{
  value: string
  label: string
  relationTo: PickRelation
  filter: Where | null
}>

export type PickType = (typeof PICK_TYPES)[number]['value']

/** A stored pick as `{ relationTo, value }`, from its type and that type's field. */
export const pickItemOf = (pick: Record<string, unknown>): { relationTo: PickRelation; value: unknown } | null => {
  const type = PICK_TYPES.find((t) => t.value === pick.type)
  const value = type ? pick[type.value] : null
  return type && value ? { relationTo: type.relationTo, value } : null
}
