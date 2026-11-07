import type { Payload } from 'payload'

import type { Locale } from '@/i18n/routing'
import { relId } from '@/lib/relation'
import type { SpaceKind } from '@/lib/spaces'

type Rel = number | { id: number } | null | undefined

/** What a space is named by: its kind and the course, programme or name it hangs from. */
export type SpaceRef = {
  id: number
  kind: SpaceKind
  name?: string | null
  course?: Rel
  programme?: Rel
}

/** The course or programme row a space hangs from, as far as a title, a path or a lifecycle needs it. */
export type SpaceParent = {
  id?: number
  title?: string | null
  slug?: string | null
  schedule?: unknown
  sessions?: { id?: string | null }[] | null
  fellows?: Rel[] | null
}

export const COMMUNITY_TITLE: Record<Locale, string> = { en: 'Community', ar: 'المجتمع' }

/** Which row a course or cohort space hangs from; null for a community, and for a course space whose course was deleted. */
export const parentRef = (
  space: SpaceRef,
): { collection: 'courses' | 'programmes'; id: number } | null => {
  if (space.kind === 'community') return null
  const id = relId(space.kind === 'course' ? space.course : space.programme)
  return id == null ? null : { collection: space.kind === 'course' ? 'courses' : 'programmes', id }
}

/**
 * A course row deleted since its space was made leaves `course: null`
 * (relations null out on delete). Nobody reads that ghost.
 */
export const isGhostCourse = (space: SpaceRef): boolean =>
  space.kind === 'course' && parentRef(space) === null

/** The course or programme row behind a space; null for a community, a ghost, or a row that is gone. */
export const parentOf = async (
  payload: Payload,
  space: SpaceRef,
  options: { select?: Record<string, true>; draft?: boolean } = {},
): Promise<SpaceParent | null> => {
  const ref = parentRef(space)
  if (!ref) return null
  return (await payload
    .findByID({ ...ref, depth: 0, overrideAccess: true, ...options } as never)
    .catch(() => null)) as SpaceParent | null
}

/**
 * The space's path: `/spaces/{kind}/{slug}` (a community has its id in place
 * of a slug), then `/posts/{id}` for one post. Without `locale` the path has
 * no language prefix: users and people store no language, so the bare path
 * redirects to the reader's saved language (next-intl, localePrefix "always").
 */
export const spaceHref = (
  space: SpaceRef,
  parent: Pick<SpaceParent, 'slug'> | null | undefined,
  { locale, postId }: { locale?: Locale; postId?: number } = {},
): string => {
  const key =
    space.kind === 'community'
      ? space.id
      : encodeURIComponent(parent?.slug ?? parentRef(space)?.id ?? '')
  return `${locale ? `/${locale}` : ''}/spaces/${space.kind}/${key}${postId == null ? '' : `/posts/${postId}`}`
}

/** A post's page by the space's real path (course or programme slug). */
export const spaceLink = async (
  payload: Payload,
  space: SpaceRef,
  postId: number,
): Promise<string> =>
  spaceHref(space, await parentOf(payload, space, { select: { slug: true } }), { postId })

/** What a space is called: its course or programme title, else its own name, else the community's. */
export const spaceTitle = (
  space: SpaceRef,
  parent: Pick<SpaceParent, 'title'> | null | undefined,
  locale: Locale,
): string => parent?.title || space.name?.trim() || COMMUNITY_TITLE[locale]
