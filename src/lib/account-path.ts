/** Where the account page lives, and its groups in tab order. Callers add the locale. */
export const ACCOUNT_PATH = '/spaces/account'

export const ACCOUNT_GROUPS = ['profile', 'sign-in', 'notifications'] as const

export type AccountGroup = (typeof ACCOUNT_GROUPS)[number]
