import { ACCOUNT_PATH } from '@/lib/account-path'

/** The account's own page: the account menu and the More sheet open it. Client code imports it, so it stays apart from `portalNav`, which reads the access rules. */
export const PROFILE = { href: ACCOUNT_PATH, labelKey: 'account.profile', icon: 'profile' } as const
