import { describe, expect, it } from 'vitest'

import { ACCOUNT_GROUPS, ACCOUNT_PATH } from './account-path'

describe('account path', () => {
  it('the account path is /spaces/account', () => {
    expect(ACCOUNT_PATH).toBe('/spaces/account')
  })

  it('the groups are profile, sign-in, notifications', () => {
    expect([...ACCOUNT_GROUPS]).toEqual(['profile', 'sign-in', 'notifications'])
  })
})
