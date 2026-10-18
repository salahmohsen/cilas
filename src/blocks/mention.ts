import type { Block, Field } from 'payload'

/** What a mention can point to; each type gets its own field, so its list is short. */
export const MENTION_TYPES = [
  { value: 'person', label: 'Person (fellow, author, CILASian)', relationTo: 'people' },
  { value: 'article', label: 'Article', relationTo: 'articles' },
  { value: 'course', label: 'Course', relationTo: 'courses' },
  { value: 'event', label: 'Event', relationTo: 'events' },
  { value: 'publication', label: 'Article collection', relationTo: 'publications' },
  { value: 'programme', label: 'Programme', relationTo: 'programmes' },
] as const

export type MentionType = (typeof MENTION_TYPES)[number]['value']

/**
 * A mention, written in the text: type "/" and choose Mention, write the
 * words to show, then pick what they point to. On the site the words link to
 * it, with a preview on hover. The words count as text everywhere: excerpts,
 * search, reading time (src/lib/plaintext.ts).
 */
export const Mention: Block = {
  slug: 'mention',
  interfaceName: 'MentionBlock',
  labels: { singular: 'Mention', plural: 'Mentions' },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: { description: 'The words shown in the text, e.g. “Ghosoun Ismail”.' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'person',
      options: MENTION_TYPES.map(({ value, label }) => ({ value, label })),
    },
    ...MENTION_TYPES.map(
      ({ value, label, relationTo }): Field => ({
        name: value,
        label,
        type: 'relationship',
        relationTo,
        admin: { condition: (_, sibling) => sibling?.type === value },
      }),
    ),
  ],
}
