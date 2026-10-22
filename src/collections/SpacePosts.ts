import type { CollectionConfig } from 'payload'

import { isAdminUser } from '@/access'

// filled in Task 4 of docs/superpowers/plans/2026-10-22-spaces-step-1-core.md
export const SpacePosts: CollectionConfig = {
  slug: 'space-posts',
  // REST refusal (plan decision): members never create rows through the
  // collection surface — the write actions are the member path. Admins may.
  access: {
    read: () => false,
    create: ({ req }) => isAdminUser(req.user),
    update: ({ req }) => isAdminUser(req.user),
    delete: ({ req }) => isAdminUser(req.user),
  },
  fields: [{ name: 'space', type: 'relationship', relationTo: 'spaces', index: true }],
  admin: { hidden: true },
}
