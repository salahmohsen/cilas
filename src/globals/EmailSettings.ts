import type { Field, GlobalConfig } from 'payload'

import { isAdmin } from '@/access'
import { DEFAULT_TEXTS } from '@/emails/settings'

const HINTS: Record<string, string> = {
  acceptance: 'Placeholders: {name}, {email}, {title}.',
  review: 'Placeholder: {title}.',
  reset: 'Placeholder: {email}.',
  newsletter: 'Button and link labels in newsletter issues.',
}

const LABELS: Record<string, string> = {
  acceptance: 'Application accepted',
  review: 'Article review',
  reset: 'Password reset',
  newsletter: 'Newsletter',
}

/** One group per email; each field shows its default and is used when empty. */
const textGroups: Field[] = Object.entries(DEFAULT_TEXTS).map(([group, fields]) => ({
  name: group,
  label: LABELS[group],
  type: 'group',
  admin: { description: `${HINTS[group]} Leave a field empty to use the text shown in it.` },
  fields: Object.entries(fields).map(([name, fallback]): Field => {
    const long = fallback.length > 60
    return long
      ? { name, type: 'textarea', admin: { placeholder: fallback, rows: 4 } }
      : { name, type: 'text', admin: { placeholder: fallback } }
  }),
}))

/**
 * How CILAS's emails look and what they say: the newsletter and every
 * transactional email. English only. Open the live preview to see the
 * transactional emails with sample data.
 */
export const EmailSettings: GlobalConfig = {
  slug: 'email-settings',
  label: 'Email settings',
  admin: {
    group: 'Site',
    livePreview: { url: '/api/email-preview?kind=messages' },
  },
  access: { read: isAdmin, update: isAdmin },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Brand',
          fields: [
            {
              name: 'logo',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description:
                  'PNG or JPG, about 64 px tall, shown beside the name. Empty: the CILAS sail. Outlook does not show WebP or SVG.',
              },
            },
            {
              name: 'accent',
              type: 'text',
              admin: { placeholder: '#000000', description: 'Button color, as #rrggbb.' },
              validate: (value: string | null | undefined) =>
                !value || /^#[0-9a-f]{6}$/i.test(value) ? true : 'Write the color as #rrggbb.',
            },
            {
              name: 'from_name',
              type: 'text',
              admin: { placeholder: 'CILAS', description: 'The sender name people see.' },
            },
            {
              name: 'reply_to',
              type: 'email',
              admin: { description: 'Where replies go. Empty: to the sending address.' },
            },
            {
              name: 'tagline',
              type: 'text',
              admin: {
                placeholder: 'A pedagogy of discovery and attunement.',
                description: 'One line above the social icons at the end of each email.',
              },
            },
            {
              name: 'signoff',
              label: 'Sign-off',
              type: 'text',
              admin: {
                placeholder: 'From CILAS, with love.',
                description: 'The last line of each newsletter, above the footer.',
              },
            },
            {
              name: 'address_place',
              label: 'Address',
              type: 'relationship',
              relationTo: 'places',
              admin: {
                description:
                  'The place whose address and Google Maps link end each email. Edit them in Places. Bulk email must carry a postal address.',
              },
            },
            {
              name: 'footer',
              type: 'textarea',
              admin: {
                rows: 3,
                description:
                  'The small print under the social icons: the address, for one. The icons come from Site settings → Contact.',
              },
            },
          ],
        },
        {
          label: 'Newsletter',
          fields: [
            {
              name: 'lists_note',
              type: 'ui',
              admin: {
                components: { Field: '/components/admin/mailing-lists-note#MailingListsNote' },
              },
            },
          ],
        },
        { label: 'Texts', fields: [{ name: 'texts', type: 'group', fields: textGroups }] },
      ],
    },
  ],
}
