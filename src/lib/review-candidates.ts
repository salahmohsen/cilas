import { STATUS_KEYS, waitsOn, type StatusKey } from '@/lib/review-status'

/** The keys that wait on one side. Derived from `waitsOn`, so no list is written by hand. */
export const waitingKeys = (side: 'owner' | 'admin'): StatusKey[] =>
  STATUS_KEYS.filter((key) => waitsOn(key) === side)

/**
 * The candidate keys the admin queue reads: the 1b admin list's `workKeys('admin')`
 * (`src/portal/lists/groups.ts`). `src/lib` cannot import `groups.ts`, so this is a
 * pinned copy, and `sources.unit.test.ts` fails when the two differ.
 */
export const ADMIN_LIST_KEYS: readonly StatusKey[] = [
  'draft',
  'submitted',
  'changes_requested',
  'published_edits',
  'published_removal',
  'published_edits_returned',
]
