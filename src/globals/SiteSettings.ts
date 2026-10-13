import type { GlobalConfig } from 'payload'

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
