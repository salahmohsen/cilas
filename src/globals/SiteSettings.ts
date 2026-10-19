import type { Field, GlobalConfig } from 'payload'

import { NAV_ITEMS } from '@/lib/navigation'

// Site-wide config with no collection home: contact, social links, the home page's questions.
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  fields: [
    {
      label: 'Contact',
      type: 'group',
      fields: [
        {
          name: 'contact_emails',
          type: 'group',
          fields: [
            { name: 'admissions', type: 'text' },
            { name: 'info', type: 'text' },
          ],
        },
        {
          name: 'social_links',
          type: 'array',
          fields: [
            {
              name: 'platform',
              type: 'select',
              options: ['facebook', 'twitter', 'youtube', 'instagram'].map((s) => ({
                label: s,
                value: s,
              })),
            },
            { name: 'url', type: 'text' },
          ],
        },
      ],
    },
    {
      // What the header and footer menus show (src/lib/navigation.ts).
      name: 'navigation',
      type: 'group',
      admin: {
        description:
          'Untick an item to take it out of the header and footer menus. Its page stays reachable by link.',
      },
      fields: NAV_ITEMS.map(({ key, label }): Field => ({
        name: key,
        label,
        type: 'checkbox',
        defaultValue: true,
      })),
    },
    {
      // The home page's "Questions people ask"; each language its own.
      name: 'faq',
      label: 'FAQ',
      type: 'array',
      labels: { singular: 'Question', plural: 'Questions' },
      admin: { description: 'Shown on the home page, in this order.' },
      fields: [
        { name: 'question', type: 'text', localized: true, required: true },
        { name: 'answer', type: 'textarea', localized: true, required: true },
      ],
    },
  ],
}
