import type { GlobalConfig } from 'payload'

// Site-wide config with no collection home: footer, contact, social links, donations.
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  fields: [
    { name: 'site_title', type: 'text' },
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
              options: ['facebook', 'twitter', 'youtube', 'instagram'].map((s) => ({ label: s, value: s })),
            },
            { name: 'url', type: 'text' },
          ],
        },
      ],
    },
    {
      label: 'Footer',
      type: 'group',
      fields: [
        { name: 'footer_text', type: 'richText', localized: true },
        { name: 'support_us', type: 'richText', localized: true }, // IBAN bank-transfer donation details
      ],
    },
  ],
}
