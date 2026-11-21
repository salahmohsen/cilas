import type { SpaceLink } from './space-links'

let next = 1

export const spaceRow = (overrides: Partial<SpaceLink> = {}) => {
  const id = overrides.id ?? next++
  return {
    id,
    label: `Space ${id}`,
    href: `/en/spaces/community/${id}`,
    unread: 0,
    cover: null,
    archived: false,
    ...overrides,
  } satisfies SpaceLink
}
