import type { GlobalConfig } from 'payload'

import { isAdmin } from '@/access'
import { INTRO_DEFAULTS } from '@/lib/space-intro'

/**
 * The introduce-yourself post every new course and cohort space opens with.
 * A new space copies it into a real post, so an edit here reaches only the
 * spaces made after it. Members read the space's other posts once they
 * comment on that post; there is no switch to turn this off.
 */
export const SpaceIntroduction: GlobalConfig = {
  slug: 'space-introduction',
  label: 'Space introduction',
  admin: {
    group: 'Community',
    description:
      'The first post of each new course and cohort space. Edits change only spaces made after them. Leave a field empty to use the text shown in it.',
  },
  access: { read: isAdmin, update: isAdmin },
  fields: [
    {
      name: 'title',
      type: 'text',
      localized: true,
      admin: { placeholder: { en: INTRO_DEFAULTS.en.title, ar: INTRO_DEFAULTS.ar.title } },
    },
    {
      name: 'body',
      type: 'textarea',
      localized: true,
      admin: {
        rows: 6,
        placeholder: { en: INTRO_DEFAULTS.en.body, ar: INTRO_DEFAULTS.ar.body },
        description: 'Markdown: **bold**, *italic*, lists and links.',
      },
    },
  ],
}
