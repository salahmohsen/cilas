import type { ArrayField } from 'payload'

/** What an activity can be: the field's options, and the session form's. */
export const ACTIVITY_KINDS = [
  'discussion',
  'field_visit',
  'exercise',
  'screening',
  'presentation',
  'other',
] as const

const ACTIVITY_LABELS: Record<(typeof ACTIVITY_KINDS)[number], string> = {
  discussion: 'Discussion',
  field_visit: 'Field visit',
  exercise: 'Exercise',
  screening: 'Screening',
  presentation: 'Presentation',
  other: 'Other',
}

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
      options: ACTIVITY_KINDS.map((value) => ({ label: ACTIVITY_LABELS[value], value })),
    },
    { name: 'description', type: 'textarea', localized: true },
  ],
})
