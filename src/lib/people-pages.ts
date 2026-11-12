/**
 * The people pages an admin can turn off (Site settings → People pages). A
 * page that is off is gone from the site: its address is not found and the
 * header, footer and sitemap leave it out.
 */
export const PEOPLE_PAGES = [
  { key: 'fellows', label: 'Fellows', path: '/people/fellows' },
  { key: 'cilasians', label: 'CILASians', path: '/people/cilasians' },
  { key: 'governance', label: 'Governance', path: '/governance' },
] as const

export type PeoplePage = (typeof PEOPLE_PAGES)[number]
export type PeoplePageKey = PeoplePage['key']
export type PeoplePages = Record<PeoplePageKey, boolean>

export const ALL_ON = Object.fromEntries(PEOPLE_PAGES.map(({ key }) => [key, true])) as PeoplePages

/** A missing value is on, so a page shows until an admin turns it off. */
export const peoplePagesOf = (
  stored: Partial<Record<PeoplePageKey, boolean | null>> | null | undefined,
): PeoplePages =>
  Object.fromEntries(PEOPLE_PAGES.map(({ key }) => [key, stored?.[key] !== false])) as PeoplePages

/** The pages that are on, in menu order. */
export const livePeoplePages = (on: PeoplePages): PeoplePage[] =>
  PEOPLE_PAGES.filter(({ key }) => on[key])
