import type { GlobalConfig } from 'payload'

import { anyone, isAdmin } from '@/access'

/**
 * The About page (/about, linked from the footer): what CILAS is, in each
 * site language. Its first text came from what the site already says about
 * CILAS (migration 20261018_165545_about_page_segment_setting); admins keep it current here.
 */
export const About: GlobalConfig = {
  slug: 'about',
  label: 'About page',
  admin: { group: 'Site' },
  access: { read: anyone, update: isAdmin },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    {
      name: 'intro',
      type: 'textarea',
      localized: true,
      admin: { description: 'The opening lines, set larger under the title.' },
    },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    {
      name: 'body',
      type: 'richText',
      localized: true,
      admin: { description: 'The page itself: headings, paragraphs, lists and links.' },
    },
  ],
}
