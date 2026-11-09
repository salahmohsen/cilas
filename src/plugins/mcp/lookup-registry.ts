import type { CollectionSlug } from 'payload'

/**
 * One entry per kind the lookup tool can search. Each names the collection,
 * the field the text query matches, and which of slug and draft status exist.
 * Only those fields are ever read back, so no email, enrollment, submission
 * or form email setting can reach an AI client.
 */
type LookupSource = {
  collection: CollectionSlug
  /** The field shown as the row's title and matched by the text query. */
  titleField: 'title' | 'name'
  /** Localized titles are matched in both languages so a duplicate in either shows. */
  localized: boolean
  /** Courses and articles keep drafts, and an admin must see them to avoid duplicates. */
  drafts: boolean
  hasSlug: boolean
}

export const LOOKUP_REGISTRY = {
  cycles: {
    collection: 'cycles',
    titleField: 'title',
    localized: false,
    drafts: false,
    hasSlug: true,
  },
  programmes: {
    collection: 'programmes',
    titleField: 'title',
    localized: true,
    drafts: true,
    hasSlug: true,
  },
  courses: {
    collection: 'courses',
    titleField: 'title',
    localized: true,
    drafts: true,
    hasSlug: true,
  },
  articles: {
    collection: 'articles',
    titleField: 'title',
    localized: true,
    drafts: true,
    hasSlug: true,
  },
  forms: {
    collection: 'forms',
    titleField: 'title',
    localized: true,
    drafts: false,
    hasSlug: false,
  },
  people: {
    collection: 'people',
    titleField: 'name',
    localized: true,
    drafts: false,
    hasSlug: true,
  },
} as const satisfies Record<string, LookupSource>

export type LookupKind = keyof typeof LOOKUP_REGISTRY

export const LOOKUP_KINDS = Object.keys(LOOKUP_REGISTRY) as [LookupKind, ...LookupKind[]]

/** What a row of the answer may hold. */
export type LookupRow = {
  id: number
  title: string
  slug?: string
  /** What is live: `published`, or `draft` when it was never published. */
  status?: 'draft' | 'published'
  /** Said only of a published record that has a newer draft waiting. */
  state?: string
  admin_url: string
}
