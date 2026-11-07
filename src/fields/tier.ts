import type { SelectField } from 'payload'
import { adminOnlyField } from '@/access'

/** Tier controls visibility; Payload's `_status` controls publication. */
export const tierField = (
  options: { sidebar?: boolean; description?: string; duplicate?: boolean } = {},
): SelectField => ({
  name: 'tier',
  type: 'select',
  required: true,
  defaultValue: 'owner',
  options: [
    { label: 'Owner only', value: 'owner' },
    { label: 'Community', value: 'community' },
    { label: 'Public', value: 'public' },
  ],
  access: { create: adminOnlyField, update: adminOnlyField },
  ...(options.sidebar
    ? {
        admin: {
          position: 'sidebar',
          ...(options.description ? { description: options.description } : {}),
        },
      }
    : {}),
  ...(options.duplicate ? { hooks: { beforeDuplicate: [() => 'owner'] } } : {}),
})
