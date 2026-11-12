import type { Field, GlobalConfig } from 'payload'

import { isAdmin } from '@/access'
import { EMAIL_IDS, EMAILS } from '@/emails/catalog'

const TEXTS = '/components/admin/email-texts'

/**
 * One collapsible section per email of the catalog: when it goes out and its
 * placeholders, its texts (empty: the default, shown in grey), and a preview
 * of the texts as typed. The group keeps each text at texts.<email>.<field>.
 */
const textSections: Field[] = EMAIL_IDS.map((id): Field => {
  const email = EMAILS[id]
  const part = (name: string, component: string): Field => ({
    name,
    type: 'ui',
    admin: { components: { Field: { path: `${TEXTS}#${component}`, clientProps: { email: id } } } },
  })
  return {
    type: 'collapsible',
    label: email.label,
    admin: { initCollapsed: true },
    fields: [
      {
        name: id,
        type: 'group',
        label: false,
        fields: [
          part('about', 'EmailAbout'),
          ...Object.entries(email.texts.en).map(([name, fallback]): Field => {
            const input = { path: `${TEXTS}#EmailTextField`, clientProps: { email: id } }
            return fallback.length > 60
              ? {
                  name,
                  type: 'textarea',
                  localized: email.localized,
                  admin: { rows: 4, components: { Field: input } },
                }
              : {
                  name,
                  type: 'text',
                  localized: email.localized,
                  admin: { components: { Field: input } },
                }
          }),
          part('preview', 'EmailPreview'),
        ],
      },
    ],
  }
})

/**
 * How CILAS's emails look and what they say: the newsletter and every email
 * the system sends (src/emails/catalog.ts). Each email in the Emails tab has its own
 * preview with sample data.
 */
export const EmailSettings: GlobalConfig = {
  slug: 'email-settings',
  label: 'Email settings',
  admin: { group: 'Site' },
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
        {
          label: 'Emails',
          fields: [{ name: 'texts', type: 'group', label: false, fields: textSections }],
        },
      ],
    },
  ],
}
