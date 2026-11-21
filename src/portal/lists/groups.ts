import type { ReviewedCollection } from '@/lib/reviewed-fields'
import { STATUS_KEYS, type StatusKey } from '@/lib/review-status'

export type ListCollection = Extract<ReviewedCollection, 'articles' | 'courses'>

export type ListKind = 'ownerArticles' | 'fellowCourses' | 'admin'

export type GroupId =
  | 'needsYou'
  | 'waitingOnAuthor'
  | 'inProgress'
  | 'withEditors'
  | 'proposals'
  | 'teachingNow'
  | 'published'
  | 'closed'

export type PagedGroup = 'published' | 'teachingNow' | 'closed'

export const PAGE_SIZE = 50
export const MAX_PAGES = 20

/** The groups of each list, in the order the page shows them. */
export const GROUPS: Record<ListKind, readonly GroupId[]> = {
  ownerArticles: ['needsYou', 'inProgress', 'withEditors', 'published', 'closed'],
  fellowCourses: ['needsYou', 'teachingNow', 'proposals', 'closed'],
  admin: ['needsYou', 'waitingOnAuthor', 'inProgress', 'published', 'closed'],
}

/** The groups that load 50 rows at a time. The others hold work and load in full. */
export const PAGED: ReadonlySet<GroupId> = new Set<PagedGroup>([
  'published',
  'teachingNow',
  'closed',
])

const OWNER_ARTICLE_GROUPS: Record<StatusKey, GroupId> = {
  draft: 'inProgress',
  submitted: 'withEditors',
  changes_requested: 'needsYou',
  rejected: 'closed',
  published: 'published',
  published_unsent: 'inProgress',
  published_edits: 'withEditors',
  published_removal: 'withEditors',
  published_edits_returned: 'needsYou',
  published_edits_declined: 'inProgress',
  published_removal_kept: 'published',
}

const ADMIN_GROUPS: Record<StatusKey, GroupId> = {
  draft: 'inProgress',
  submitted: 'needsYou',
  changes_requested: 'waitingOnAuthor',
  rejected: 'closed',
  published: 'published',
  published_unsent: 'published',
  published_edits: 'needsYou',
  published_removal: 'needsYou',
  published_edits_returned: 'waitingOnAuthor',
  published_edits_declined: 'published',
  published_removal_kept: 'published',
}

const FELLOW_COURSE_GROUPS: Record<StatusKey, GroupId> = {
  draft: 'proposals',
  submitted: 'proposals',
  changes_requested: 'needsYou',
  rejected: 'closed',
  published: 'teachingNow',
  published_unsent: 'teachingNow',
  published_edits: 'teachingNow',
  published_removal: 'teachingNow',
  published_edits_returned: 'needsYou',
  published_edits_declined: 'teachingNow',
  published_removal_kept: 'teachingNow',
}

const BY_KIND: Record<ListKind, Record<StatusKey, GroupId>> = {
  ownerArticles: OWNER_ARTICLE_GROUPS,
  fellowCourses: FELLOW_COURSE_GROUPS,
  admin: ADMIN_GROUPS,
}

/**
 * The one group of a row. A course that has a space is teaching now, whatever
 * its key says, unless it waits on the teacher: Needs you comes first.
 */
export const groupOf = (key: StatusKey, kind: ListKind, row: { hasSpace: boolean }): GroupId => {
  const group = BY_KIND[kind][key]
  if (kind === 'fellowCourses' && row.hasSpace && group !== 'needsYou') return 'teachingNow'
  return group
}

/** The keys whose group loads in full: not paged, even when the course has no space. */
export const workKeys = (kind: ListKind): readonly StatusKey[] =>
  STATUS_KEYS.filter((key) => !PAGED.has(groupOf(key, kind, { hasSpace: false })))

export type Chip = 'needsYou' | 'drafts' | 'published'

/** The group each filter chip shows (Deviation 6). */
export const chipGroup: Record<ListKind, Record<Chip, GroupId>> = {
  ownerArticles: { needsYou: 'needsYou', drafts: 'inProgress', published: 'published' },
  fellowCourses: { needsYou: 'needsYou', drafts: 'proposals', published: 'teachingNow' },
  admin: { needsYou: 'needsYou', drafts: 'inProgress', published: 'published' },
}
