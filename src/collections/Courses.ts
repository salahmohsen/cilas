import {
  canSetStatus,
  isAdmin,
  isAdminOrListedAsFellow,
  isAdminOrSuperAdminOrFellow,
  ownsViaFellows,
  readTiers,
} from '@/access'
import type { CollectionConfig } from 'payload'

export const Courses: CollectionConfig = {
  slug: 'courses',
  access: {
    read: readTiers(ownsViaFellows),
    create: isAdminOrSuperAdminOrFellow,
    update: isAdminOrListedAsFellow,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      required: true,
      options: [
        { label: 'Draft', value: 'draft' }, // owner only
        { label: 'Community', value: 'community' }, // signed-in members only
        { label: 'Public', value: 'public' }, // world
      ],
      // Admin-only on create *and* update, so a fellow's course keeps the
      // `draft` default and promoting it stays an admin action.
      access: { create: canSetStatus, update: canSetStatus },
    },
    {
      name: 'course_type',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Core Course',
          value: 'CORE',
        },
        { label: 'Thematic Course', value: 'THEMATIC' },
        { label: 'Lab', value: 'LAB' },
        { label: 'Workshop', value: 'WORKSHOP' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'subtitle', type: 'text', localized: true },
    { name: 'description', type: 'richText', localized: true },
    { name: 'epigraph', type: 'text', localized: true }, // "food for thought" quote,
    {
      name: 'learning_outcomes',
      type: 'array',
      localized: true,
      fields: [{ name: 'outcome', type: 'richText' }],
    },
    {
      name: 'bibliography',
      type: 'array',
      localized: true,
      fields: [{ name: 'citation', type: 'text' }],
    },
    {
      name: 'why_apply',
      type: 'array',
      localized: true,
      fields: [{ name: 'point', type: 'text' }],
    },
    { name: 'weekly_workload', type: 'richText', localized: true }, // "what to expect"
    {
      name: 'mode_note',
      type: 'text',
      admin: {
        position: 'sidebar',
      },
    }, // "in person or on Zoom",
    {
      name: 'fields_of_study',
      type: 'relationship',
      relationTo: 'fields-of-study',
      hasMany: true,
      admin: {
        condition: (data) => ['CORE', 'THEMATIC'].includes(data.course_type),
        position: 'sidebar',
      },
    },
    {
      name: 'cycle',
      type: 'relationship',
      relationTo: 'cycles',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'location',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Offline', value: 'OFFLINE' },
        { label: 'Online', value: 'ONLINE' },
        { label: 'Hybrid', value: 'HYBRID' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'schedule',
      type: 'group',
      admin: {
        position: 'sidebar',
      },
      fields: [
        { name: 'session_count', type: 'number', required: true },
        { name: 'first_session_date', type: 'date', required: true },
        {
          name: 'Days',
          type: 'array',
          fields: [
            {
              name: 'days_of_week',
              type: 'select',
              required: true,
              options: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => ({
                label: d,
                value: d,
              })),
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'start_time',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm:ss a',
                    },
                  },
                  required: true,
                },
                {
                  name: 'end_time',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm:ss a',
                    },
                  },
                  required: true,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'tuition',
      type: 'group',
      fields: [
        { name: 'amount', type: 'number' },
        { name: 'need_based', type: 'checkbox', label: 'Need-based deductions available' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'fellows',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'registration_form',
      type: 'relationship',
      relationTo: 'forms',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'sessions',
      type: 'array',
      label: 'Syllabus (session-by-session)',
      fields: [
        { name: 'order', type: 'number' }, // sort key
        { name: 'week', type: 'text' }, // "Week 1", "2&3", "9–10 (optional)" — text, not integer
        { name: 'theme', type: 'text', localized: true },
        { name: 'description', type: 'richText', localized: true },
        { name: 'activity', type: 'text', localized: true }, // "Field visit", "Guest lecture", "Screening"
        {
          name: 'materials',
          type: 'array',
          fields: [
            {
              name: 'type',
              type: 'select',
              required: true,
              options: [
                { label: 'Reading', value: 'reading' },
                { label: 'Watch', value: 'watch' },
                { label: 'Listen', value: 'listen' },
                { label: 'Sit with', value: 'sit_with' },
                { label: 'Case study', value: 'case_study' },
                { label: 'Prompt', value: 'prompt' },
                { label: 'Lecture', value: 'lecture' },
                { label: 'Link', value: 'link' },
              ],
            },
            { name: 'title', type: 'text', localized: true, index: true },
            { name: 'href', type: 'text' }, // youtube / vimeo / article url
            { name: 'note', type: 'text', localized: true }, // author, year, pages; primary vs secondary reading
          ],
        },
      ],
    },
  ],
  admin: {
    useAsTitle: 'title',
  },
}
