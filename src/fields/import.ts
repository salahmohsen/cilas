import type { Field } from 'payload'

import { adminWrites } from '@/access'

/**
 * Provenance for archive imports (docs/schema.md, Archive import). The
 * importer upserts by `legacy_url`; a page that yields several documents
 * gives each a fragment, e.g. `/fall-cycle-2024.html#melancholia-in-the-city`.
 * Redirects from the old site resolve through it too, so only an admin sets
 * it: an owner could otherwise claim an old URL on a draft. The importer runs
 * with overrideAccess.
 */
export const importFields = (): Field[] => [
  adminWrites({
    name: 'legacy_url',
    type: 'text',
    unique: true,
    index: true,
    admin: { hidden: true },
  }),
]
