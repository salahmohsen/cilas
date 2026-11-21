import { canProposeCourse, mayAuthor } from '@/access'
import { adminCreateHref } from '@/lib/document-href'
import type { User } from '@/payload-types'

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
