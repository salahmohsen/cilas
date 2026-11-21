import { describe, expect, it } from 'vitest'

import { messagesOf } from '../../../testing/intl.test-utils'
import { portalNav } from './portal-nav'

const lookup = (messages: object, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], {
    Portal: (messages as { Portal: unknown }).Portal,
  })

describe('portalNav', () => {
  it.each([
    [['member'], ['home']],
    [['non_degree_seeking'], ['home']],
    [['fellow'], ['home']],
    [['admin'], ['home', 'openDashboard']],
    [['super_admin'], ['home', 'openDashboard']],
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

  it('every label key exists in both languages', () => {
    const keys = portalNav({ roles: ['super_admin'] }).map((item) => `Portal.${item.labelKey}`)
    for (const messages of Object.values(messagesOf))
      for (const key of keys) expect(typeof lookup(messages, key), key).toBe('string')
  })
})
