import type { Field } from 'payload'

import { httpUrl } from './validators'

export const SOCIAL_PLATFORMS = ['facebook', 'x', 'youtube', 'instagram', 'linkedin'] as const

/**
 * Where to find and follow someone. `website` owns the primary link; each
 * social entry is one platform, one URL.
 */
export const socialFields: Field = {
  label: 'Social',
  type: 'group',
  fields: [
    { name: 'website', type: 'text', admin: { placeholder: 'https://…' } },
    {
      name: 'social_links',
      type: 'array',
      label: 'Social media',
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: SOCIAL_PLATFORMS.map((v) => ({
            label: v.charAt(0).toUpperCase() + v.slice(1),
            value: v,
          })),
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          admin: { placeholder: 'https://…' },
          validate: httpUrl,
        },
      ],
    },
  ],
}
