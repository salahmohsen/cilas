import { describe, expect, it } from 'vitest'

import { messagesOf } from '../../../testing/intl.test-utils'
import { portalNav } from './portal-nav'

const lookup = (messages: object, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], {
    Portal: (messages as { Portal: unknown }).Portal,
  })

describe('portalNav', () => {
  it.each([
    [[], ['home']],
    [['member'], ['home', 'articles']],
    [['non_degree_seeking'], ['home', 'articles']],
    [['fellow'], ['home', 'articles', 'courses']],
    [['admin'], ['home', 'articles', 'courses', 'openDashboard']],
    [['super_admin'], ['home', 'articles', 'courses', 'openDashboard']],
  ] as const)('roles %j see %j', (roles, keys) => {
    expect(portalNav({ roles: [...roles] }).map((item) => item.key)).toEqual(keys)
  })

  it('Open dashboard is a full load to /admin in the admin group', () => {
    expect(portalNav({ roles: ['admin'] }).find((item) => item.key === 'openDashboard')).toEqual({
      key: 'openDashboard',
      labelKey: 'nav.openDashboard',
      group: 'admin',
      href: '/admin',
      icon: 'dashboard',
      count: null,
      external: true,
    })
  })

  it.each([
    [['member'], { articles: 'myWork' }],
    [['fellow'], { articles: 'myWork', courses: 'myWork' }],
    [['admin'], { articles: 'admin', courses: 'admin' }],
  ] as const)('the list items of %j sit in %j', (roles, groups) => {
    const items = portalNav({ roles: [...roles] }).filter(
      (item) => item.key === 'articles' || item.key === 'courses',
    )
    expect(Object.fromEntries(items.map((item) => [item.key, item.group]))).toEqual(groups)
  })

  it('the list items are portal pages with no count', () => {
    expect(portalNav({ roles: ['fellow'] }).filter((item) => item.key !== 'home')).toEqual([
      {
        key: 'articles',
        labelKey: 'nav.articles',
        group: 'myWork',
        href: '/spaces/articles',
        icon: 'articles',
        count: null,
        external: false,
      },
      {
        key: 'courses',
        labelKey: 'nav.courses',
        group: 'myWork',
        href: '/spaces/courses',
        icon: 'courses',
        count: null,
        external: false,
      },
    ])
  })

  it('every label key exists in both languages', () => {
    const keys = portalNav({ roles: ['super_admin'] }).map((item) => `Portal.${item.labelKey}`)
    for (const messages of Object.values(messagesOf))
      for (const key of keys) expect(typeof lookup(messages, key), key).toBe('string')
  })
})
