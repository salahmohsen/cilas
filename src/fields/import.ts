import type { Field } from 'payload'

import { canSetTier } from '@/access'

/**
 * Provenance for archive imports (docs/schema.md, Archive import). The
 * importer upserts by `legacy_url`; a page that yields several documents
 * gives each a fragment, e.g. `/fall-cycle-2024.html#melancholia-in-the-city`.
 */
export const importFields = (): Field[] => [
  {
    name: 'legacy_url',
    type: 'text',
    unique: true,
    index: true,
    admin: { hidden: true },
  },
  {
    name: 'import_status',
    type: 'select',
    options: [
      { label: 'Needs review', value: 'needs_review' },
      { label: 'Reviewed', value: 'reviewed' },
    ],
    access: { create: canSetTier, update: canSetTier },
    admin: {
      position: 'sidebar',
      description: 'Imported from the old site. Mark it reviewed once checked.',
      condition: (data) => Boolean(data?.import_status),
    },
  },
]
