import type { Field, GlobalConfig } from 'payload'

import { NAV_ITEMS } from '@/lib/navigation'
import { isAdmin } from '@/access'

// Site-wide config with no collection home: contact, social links, the home page's questions.
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: { read: isAdmin, update: isAdmin },
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
          ],
        },
        {
          label: 'Navigation',
          fields: [
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
          ],
        },
        {
          label: 'Home content',
          fields: [
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
