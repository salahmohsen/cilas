import { canProposeCourse, mayAuthor } from '@/access'
import { adminCreateHref } from '@/lib/document-href'
import type { User } from '@/payload-types'

import type { EmptyState } from './empty-states'
import type { ListCollection } from './groups'

/**
 * The create action of a list, or null when the reader may not create
 * there. The header shows its label and href; an owner's empty state takes
 * its href (`emptyStateOf`), so the two never disagree on who may create.
 */
export const createActionOf = (
  collection: ListCollection,
  user: User,
): { labelKey: 'lists.newArticle' | 'lists.proposeCourse'; href: string } | null => {
  if (collection === 'articles')
    return mayAuthor(user)
      ? { labelKey: 'lists.newArticle', href: adminCreateHref('articles') }
      : null
  return canProposeCourse(user)
    ? { labelKey: 'lists.proposeCourse', href: adminCreateHref('courses') }
    : null
}

/**
 * The create action the header shows. A list with no row at all shows the
 * same action in its empty state, which is then the page's one primary
 * button, so the header drops it. `total` is the reader's rows with no
 * search and no filter, so a search never empties the header. `total` is
 * null when the load failed: then no empty state shows.
 */
export const headerCreateOf = (
  create: ReturnType<typeof createActionOf>,
  empty: EmptyState,
  total: number | null,
): ReturnType<typeof createActionOf> =>
  create && total === 0 && empty.action?.href === create.href ? null : create
