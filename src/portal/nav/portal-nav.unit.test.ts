import { describe, expect, it } from 'vitest'

import { messagesOf } from '../../../testing/intl.test-utils'
import { portalNav } from './portal-nav'

const lookup = (messages: object, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], {
    Portal: (messages as { Portal: unknown }).Portal,
  })

describe('portalNav', () => {
  it.each([
    [[], ['home', 'inbox']],
    [['member'], ['home', 'inbox', 'articles']],
    [['non_degree_seeking'], ['home', 'inbox', 'articles']],
    [['fellow'], ['home', 'inbox', 'articles', 'courses']],
    [['admin'], ['home', 'inbox', 'articles', 'courses', 'openDashboard']],
    [['super_admin'], ['home', 'inbox', 'articles', 'courses', 'openDashboard']],
  ] as const)('roles %j see %j', (roles, keys) => {
    expect(portalNav({ roles: [...roles] }).map((item) => item.key)).toEqual(keys)
  })

  it.each([[[]], [['member']], [['fellow']], [['admin']]] as const)(
    'Inbox is the second top item for roles %j',
    (roles) => {
      const items = portalNav({ roles: [...roles] })
      expect(items[1]).toEqual({
        key: 'inbox',
        labelKey: 'nav.inbox',
        group: 'top',
        href: '/spaces/inbox',
        icon: 'inbox',
        external: false,
      })
    },
  )

  it('portalNav takes one argument and no item has a count field', () => {
    expect(portalNav.length).toBe(1)
    for (const item of portalNav({ roles: ['super_admin'] }))
      expect(item).not.toHaveProperty('count')
  })

  it('Open dashboard is a full load to /admin in the admin group', () => {
    expect(portalNav({ roles: ['admin'] }).find((item) => item.key === 'openDashboard')).toEqual({
      key: 'openDashboard',
      labelKey: 'nav.openDashboard',
      group: 'admin',
      href: '/admin',
      icon: 'dashboard',
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

  it('the list items are portal pages', () => {
    expect(
      portalNav({ roles: ['fellow'] }).filter(
        (item) => item.key === 'articles' || item.key === 'courses',
      ),
    ).toEqual([
      {
        key: 'articles',
        labelKey: 'nav.articles',
        group: 'myWork',
        href: '/spaces/articles',
        icon: 'articles',
        external: false,
      },
      {
        key: 'courses',
        labelKey: 'nav.courses',
        group: 'myWork',
        href: '/spaces/courses',
        icon: 'courses',
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
