import { revalidatePath } from 'next/cache'
import type { Field, GlobalConfig } from 'payload'

import { routing } from '@/i18n/routing'
import { PEOPLE_PAGES } from '@/lib/people-pages'
import { isAdmin } from '@/access'
import { SOCIAL_PLATFORMS } from '@/fields/social'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  access: { read: isAdmin, update: isAdmin },
  hooks: {
    // Every page's layout reads these settings (header, footer, people pages).
    afterChange: [
      ({ doc }) => {
        try {
          for (const locale of routing.locales) revalidatePath(`/${locale}`, 'layout')
        } catch {
          // Seed and import scripts have no Next cache, and this call throws there.
        }
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Contact',
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
                      options: SOCIAL_PLATFORMS.map((s) => ({
                        label: s,
                        value: s,
                      })),
                    },
                    { name: 'url', type: 'text' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'People pages',
          fields: [
            {
              name: 'people_pages',
              label: 'People pages',
              type: 'group',
              admin: {
                description:
                  'Turn a page off to take it off the site: its address shows not found, and the header, footer and sitemap leave it out. With one page on, the header shows it in place of People. With none on, People leaves the header.',
              },
              fields: PEOPLE_PAGES.map(({ key, label }): Field => ({
                name: key,
                label,
                type: 'checkbox',
                defaultValue: true,
              })),
            },
          ],
        },
        {
          label: 'Home content',
          fields: [
            {
              name: 'hero',
              label: 'Hero',
              type: 'group',
              fields: [
                {
                  name: 'description',
                  type: 'textarea',
                  localized: true,
                  admin: {
                    description:
                      'Shown below the institute name on the home page. Leave blank to hide the description for this language.',
                  },
                },
              ],
            },
            {
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
        },
        {
          label: 'Spaces rollout',
          fields: [
            {
              // ADR 0009: spaces ship behind this switch; Off is the launch default.
              label: 'Spaces',
              type: 'group',
              fields: [
                {
                  name: 'spaces_mode',
                  type: 'select',
                  required: true,
                  defaultValue: 'off',
                  options: [
                    { label: 'Off', value: 'off' },
                    { label: 'Trial', value: 'trial' },
                    { label: 'On', value: 'on' },
                  ],
                  admin: {
                    description:
                      'Off: space pages return not found and writes are refused; data stays. Trial: only the chosen courses, plus the community and cohort checkboxes. On: every space.',
                  },
                },
                {
                  name: 'spaces_trial_courses',
                  type: 'relationship',
                  relationTo: 'courses',
                  hasMany: true,
                  admin: {
                    condition: (data) =>
                      (data as { spaces_mode?: unknown }).spaces_mode === 'trial',
                    description: 'In Trial, only these courses have a space.',
                  },
                },
                {
                  name: 'spaces_trial_community',
                  label: 'Community space',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    condition: (data) =>
                      (data as { spaces_mode?: unknown }).spaces_mode === 'trial',
                  },
                },
                {
                  name: 'spaces_trial_cohorts',
                  label: 'Cohort spaces',
                  type: 'relationship',
                  relationTo: 'programmes',
                  hasMany: true,
                  admin: {
                    condition: (data) =>
                      (data as { spaces_mode?: unknown }).spaces_mode === 'trial',
                    description: 'In Trial, only these programmes have a cohort space.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
