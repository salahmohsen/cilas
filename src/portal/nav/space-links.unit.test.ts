import { describe, expect, it } from 'vitest'

import type { SpaceSummary } from '@/lib/spaces-data'
import type { Space } from '@/payload-types'
import { portalNav } from './portal-nav'
import { isCurrentItem, isCurrentSpace, shownUnread, spaceLabel, spaceLinks } from './space-links'

const row = (kind: Space['kind'], id: number, overrides: Partial<SpaceSummary> = {}) =>
  ({
    space: { id, kind, name: `Space ${id}` } as Space,
    title: `Space ${id}`,
    href: kind === 'community' ? `/en/spaces/community/${id}` : `/en/spaces/${kind}/s-${id}`,
    unread: id,
    lastActivity: null,
    archived: false,
    cover: null,
    ...overrides,
  }) satisfies SpaceSummary

describe('spaceLinks', () => {
  it('communities first, then cohorts, then courses with archived ones last', () => {
    const links = spaceLinks(
      {
        communities: [row('community', 1)],
        cohorts: [row('cohort', 2)],
        courses: [row('course', 3, { archived: true }), row('course', 4)],
      },
      'Community',
    )
    expect(links.map((link) => link.id)).toEqual([1, 2, 4, 3])
    expect(links[3]).toEqual({
      id: 3,
      label: 'Space 3',
      href: '/en/spaces/course/s-3',
      unread: 3,
      cover: null,
      archived: true,
    })
  })

  it('an unnamed community takes the fixed label', () => {
    const unnamed = row('community', 1, {
      space: { id: 1, kind: 'community', name: ' ' } as Space,
      title: '',
    })
    expect(spaceLabel(unnamed, 'Community')).toBe('Community')
    expect(spaceLabel(row('community', 5), 'Community')).toBe('Space 5')
    expect(spaceLabel(row('course', 6), 'Community')).toBe('Space 6')
  })

  it('a row whose href matches the pathname shows unread 0', () => {
    const [community] = spaceLinks(
      { communities: [row('community', 1)], cohorts: [], courses: [] },
      'Community',
    )
    expect(isCurrentSpace('/en/spaces/community/1', community!.href)).toBe(true)
    expect(shownUnread(community!, '/en/spaces/community/1')).toBe(0)
    expect(shownUnread(community!, '/en/spaces/community/1/posts/9')).toBe(0)
    expect(isCurrentSpace('/en/spaces/community/12', community!.href)).toBe(false)
    expect(shownUnread(community!, '/en/spaces/community/12')).toBe(1)
    expect(shownUnread(community!, '/en/spaces')).toBe(1)
  })
})

describe('isCurrentItem', () => {
  const [home, dashboard] = portalNav({ roles: ['admin'] })

  it('a nav item is current only on its own page, in the page language', () => {
    expect(isCurrentItem('/en/spaces', 'en', home!)).toBe(true)
    expect(isCurrentItem('/ar/spaces', 'ar', home!)).toBe(true)
    expect(isCurrentItem('/ar/spaces', 'en', home!)).toBe(false)
    expect(isCurrentItem('/en/spaces/community', 'en', home!)).toBe(false)
  })

  it('an item that leaves the portal is never current', () => {
    expect(isCurrentItem('/admin', 'en', dashboard!)).toBe(false)
  })
})
