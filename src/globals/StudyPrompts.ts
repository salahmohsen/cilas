import { revalidatePath, revalidateTag } from 'next/cache'
import type { Field, GlobalConfig } from 'payload'

import { isAdmin } from '@/access'
import { routing } from '@/i18n/routing'
import {
  promptProblem,
  STUDY_KINDS,
  STUDY_PROMPTS_TAG,
  STUDY_TIERS,
  type StudyKind,
  type StudyTier,
} from '@/lib/ai-study'
import { AI_GROUP } from '@/plugins/role-nav'

const FIELD = '/components/admin/study-prompt-field'

const KINDS: Record<StudyKind, string> = {
  course: 'Course page',
  article: 'Article page',
  session: 'Session in a course space',
}

const TIERS: Record<StudyTier, { label: string; description: string }> = {
  full: {
    label: 'Full prompt',
    description: 'Used when its link fits the assistant.',
  },
  compact: {
    label: 'Compact prompt',
    description: 'Used when the full prompt makes the link too long for the assistant.',
  },
  short: {
    label: 'Short prompt',
    description:
      'Used when the compact prompt is too long too. Arabic links are about six times longer, so Arabic readers on Grok and Z.ai often get this one.',
  },
}

const section = (kind: StudyKind): Field => ({
  type: 'collapsible',
  label: KINDS[kind],
  admin: { initCollapsed: kind !== 'course' },
  fields: [
    {
      name: kind,
      type: 'group',
      label: false,
      fields: [
        {
          name: 'about',
          type: 'ui',
          admin: {
            components: { Field: { path: `${FIELD}#StudyPromptAbout`, clientProps: { kind } } },
          },
        },
        ...STUDY_TIERS.map((tier): Field => ({
          name: tier,
          label: TIERS[tier].label,
          type: 'textarea',
          localized: true,
          validate: (value: string | null | undefined) =>
            !value?.trim() || (promptProblem(kind, value) ?? true),
          admin: {
            rows: tier === 'short' ? 6 : 14,
            description: TIERS[tier].description,
            components: {
              Field: { path: `${FIELD}#StudyPromptField`, clientProps: { kind, tier } },
            },
          },
        })),
      ],
    },
  ],
})

/**
 * The "study with AI" prompts on course, article and session pages. An empty
 * field uses the default from the messages files (StudyPrompt), which the
 * field shows in grey; a saved one replaces it for that language.
 */
export const StudyPrompts: GlobalConfig = {
  slug: 'study-prompts',
  label: 'Study prompts',
  admin: {
    group: AI_GROUP,
    description:
      'The prompt each "Study with AI" button hands the assistant. Switch the language at the top of the page to edit the Arabic prompts.',
  },
  access: { read: isAdmin, update: isAdmin },
  hooks: {
    // Every page reads the prompts with its messages, in the layout.
    afterChange: [
      ({ doc }) => {
        try {
          revalidateTag(STUDY_PROMPTS_TAG, 'max')
          for (const locale of routing.locales) revalidatePath(`/${locale}`, 'layout')
        } catch {
          // Seed and import scripts have no Next cache, and these calls throw there.
        }
        return doc
      },
    ],
  },
  fields: STUDY_KINDS.map(section),
}
