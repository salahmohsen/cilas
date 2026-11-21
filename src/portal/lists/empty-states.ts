import type { ListCollection, ListKind } from './groups'

/** The four lists a reader can open: a collection seen as its owner or as an admin. */
type ListView = 'ownerArticles' | 'adminArticles' | 'fellowCourses' | 'adminCourses'

const viewOf = (collection: ListCollection, kind: ListKind): ListView =>
  kind !== 'admin' ? kind : collection === 'articles' ? 'adminArticles' : 'adminCourses'

const TITLE_KEYS = {
  ownerArticles: 'lists.myArticles',
  adminArticles: 'lists.allArticles',
  fellowCourses: 'lists.myCourses',
  adminCourses: 'lists.allCourses',
} as const satisfies Record<ListView, `lists.${string}`>

/** The H1 key of a list. The page's H1 and its document title both read it. */
export const titleKeyOf = (
  collection: ListCollection,
  kind: ListKind,
): (typeof TITLE_KEYS)[ListView] => TITLE_KEYS[viewOf(collection, kind)]

export type EmptyState = {
  titleKey: `lists.empty.${ListView}.title`
  bodyKey: `lists.empty.${ListView}.body`
  nextKey?: `lists.empty.${ListView}.next`
  action?: { labelKey: `lists.${string}`; href: string; external: true }
}

/** The create action an owner's empty state offers: its label, and the href only when the reader may create. */
const OWNER_ACTIONS: Partial<Record<ListView, `lists.${string}`>> = {
  ownerArticles: 'lists.writeArticle',
  fellowCourses: 'lists.proposeCourse',
}

const NEXT: Partial<Record<ListView, EmptyState['nextKey']>> = {
  ownerArticles: 'lists.empty.ownerArticles.next',
}

/** Every empty-state action is an admin page, so it is a full load with no locale prefix. */
const actionOf = (view: ListView, createHref: string | null): EmptyState['action'] => {
  if (view === 'adminCourses')
    return { labelKey: 'lists.openDashboard', href: '/admin', external: true }
  const labelKey = OWNER_ACTIONS[view]
  return labelKey && createHref ? { labelKey, href: createHref, external: true } : undefined
}

/**
 * The empty state of a list (spec, Onboarding). An owner list offers its
 * create page only when `createHref` is set (`createActionOf`), so the
 * header and the empty state never disagree on who may create.
 */
export const emptyStateOf = (
  collection: ListCollection,
  kind: ListKind,
  createHref: string | null,
): EmptyState => {
  const view = viewOf(collection, kind)
  const next = NEXT[view]
  const action = actionOf(view, createHref)
  return {
    titleKey: `lists.empty.${view}.title`,
    bodyKey: `lists.empty.${view}.body`,
    ...(next && { nextKey: next }),
    ...(action && { action }),
  }
}
