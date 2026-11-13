import type { ArrayField } from 'payload'

/** What participants do in a session rather than engage with beforehand (CONTEXT.md). */
// A function, so each collection gets its own copy: Payload sanitizes field configs in place.
export const activitiesField = (): ArrayField => ({
  name: 'activities',
  type: 'array',
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Discussion', value: 'discussion' },
        { label: 'Field visit', value: 'field_visit' },
        { label: 'Exercise', value: 'exercise' },
        { label: 'Screening', value: 'screening' },
        { label: 'Presentation', value: 'presentation' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'description', type: 'textarea', localized: true },
  ],
})
