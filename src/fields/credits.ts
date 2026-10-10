import type { ArrayField } from 'payload'

export const CREDIT_ROLES = [
  'author',
  'editor',
  'translator',
  'copy_editor',
  'proofreader',
  'supervisor',
  'coordinator',
  'art_director',
  'cover_designer',
  'illustrator',
  'photographer',
  'other',
] as const

const label = (role: string): string =>
  role.charAt(0).toUpperCase() + role.slice(1).replaceAll('_', ' ')

/**
 * Named contributions to an article or publication (CONTEXT.md). One row per
 * role; `label` names an odd role exactly, e.g. "Translation & editing".
 */
export const creditsField = (): ArrayField => ({
  name: 'credits',
  type: 'array',
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          options: CREDIT_ROLES.map((value) => ({ label: label(value), value })),
          admin: { width: '30%' },
        },
        { name: 'label', type: 'text', localized: true, admin: { width: '70%' } },
      ],
    },
    { name: 'people', type: 'relationship', relationTo: 'people', hasMany: true, required: true },
  ],
})
