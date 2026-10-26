import type { GlobalConfig } from 'payload'

import { isAdmin } from '@/access'
import { NOTICE, RULES_MAX, rulesText } from '@/lib/space-consent'

/**
 * The "Privacy and rules" text every space shows and members accept before
 * their first post (spec §9). A fellow may replace it for their own space in
 * its settings; that text wins there.
 */
export const SpaceRules: GlobalConfig = {
  slug: 'space-rules',
  label: 'Privacy and rules',
  admin: {
    group: 'Community',
    description:
      'Shown in every space and accepted before a first post. Leave it empty to use the text shown in it. A fellow can replace it for one space in its settings.',
  },
  access: { read: isAdmin, update: isAdmin },
  fields: [
    {
      name: 'privacy_rules',
      label: 'Privacy and rules',
      type: 'textarea',
      localized: true,
      maxLength: RULES_MAX,
      admin: {
        rows: 14,
        placeholder: { en: rulesText(NOTICE.en), ar: rulesText(NOTICE.ar) },
        description:
          'One part per paragraph: a short title on the first line, the answer under it.',
      },
    },
  ],
}
