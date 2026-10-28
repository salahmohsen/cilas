/**
 * The menu items an admin can hide (Site settings → Navigation). Study,
 * People and the Apply button always show; hiding an item takes it out of
 * the header and the footer, not off the site.
 */
export const NAV_ITEMS = [
  { key: 'thematic', label: 'Study → Thematic Courses' },
  { key: 'labs', label: 'Study → Labs' },
  { key: 'workshops', label: 'Study → Workshops' },
  { key: 'short', label: 'Study → Short Courses' },
  { key: 'bridge', label: 'Study → The Bridge card' },
  { key: 'fellows', label: 'People → Fellows' },
  { key: 'cilasians', label: 'People → CILASians' },
  { key: 'governance', label: 'People → Governance' },
  { key: 'articles', label: 'Articles' },
  { key: 'events', label: 'What’s on → Events' },
  { key: 'calendar', label: 'What’s on → Calendar' },
] as const

export type NavKey = (typeof NAV_ITEMS)[number]['key']
export type Navigation = Record<NavKey, boolean>

/** Every item shown: what the menus use before an admin has chosen. */
export const ALL_SHOWN = Object.fromEntries(NAV_ITEMS.map(({ key }) => [key, true])) as Navigation

/** The stored choices, unset ones shown. */
export const navigationOf = (
  stored: Partial<Record<NavKey, boolean | null>> | null | undefined,
): Navigation =>
  Object.fromEntries(NAV_ITEMS.map(({ key }) => [key, stored?.[key] !== false])) as Navigation
