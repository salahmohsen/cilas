import type { SpaceSummary } from '@/lib/spaces-data'

/** One space row of the portal nav; `href` carries the locale. */
export type SpaceLink = {
  id: number
  label: string
  href: string
  unread: number
  cover: string | null
  archived: boolean
}

/** The name the nav and `/spaces` give a space: an unnamed community takes the fixed label. */
export const spaceLabel = (row: SpaceSummary, communityLabel: string): string =>
  row.space.kind === 'community' && !row.space.name?.trim() ? communityLabel : row.title

/** Communities, then cohorts, then courses with archived ones last (spec §2). */
export const spaceLinks = (
  spaces: { communities: SpaceSummary[]; cohorts: SpaceSummary[]; courses: SpaceSummary[] },
  communityLabel: string,
): SpaceLink[] =>
  [
    ...spaces.communities,
    ...spaces.cohorts,
    ...spaces.courses.toSorted((a, b) => Number(a.archived) - Number(b.archived)),
  ].map((row) => ({
    id: row.space.id,
    label: spaceLabel(row, communityLabel),
    href: row.href,
    unread: row.unread,
    cover: row.cover,
    archived: row.archived,
  }))

/** The space is open: its page or a page below it. */
export const isCurrentSpace = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`)

/**
 * The count a row shows. The layout reads counts on a full load only, so the
 * open space shows 0 (Deviation 15); a soft navigation away brings its old
 * count back until the next full load.
 */
export const shownUnread = (row: SpaceLink, pathname: string): number =>
  isCurrentSpace(pathname, row.href) ? 0 : row.unread
