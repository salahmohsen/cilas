import type { Access, SanitizedConfig, Where } from 'payload'

import { isAdminUser } from '@/access'
import { relId } from '@/lib/relation'

/**
 * Payload adds `payload-locked-documents` while it sanitizes the config, with
 * "any signed-in account" for every operation, and offers no option to change
 * it. Any member could then delete an admin's lock or write a lock in another
 * account's name. These rules keep what the admin UI needs:
 *
 * - read stays open to signed-in accounts: the edit view shows who holds a lock;
 * - create and update (Payload's "take over") only name the caller as the holder;
 * - delete removes only the caller's own lock, as the UI does on leaving a page.
 *
 * Admins keep full access. Payload clears expired locks through its database
 * adapter, which no access rule covers.
 */
type LockHolder = { relationTo?: unknown; value?: unknown } | null | undefined

const namesCaller = (holder: LockHolder, user: { id: number; collection: string } | null) =>
  user !== null &&
  holder?.relationTo === user.collection &&
  relId(holder.value as number | { id: number }) === user.id

const lockInCallersName: Access = ({ req, data }) =>
  isAdminUser(req.user) || namesCaller(data?.user as LockHolder, req.user)

const callersOwnLocks: Access = ({ req }) => {
  if (isAdminUser(req.user)) return true
  if (!req.user) return false
  const own: Where = {
    and: [
      { 'user.relationTo': { equals: req.user.collection } },
      { 'user.value': { equals: req.user.id } },
    ],
  }
  return own
}

/** Sets the lock rules on the sanitized config; a no-op if Payload made no lock collection. */
export const withLockRules = (config: SanitizedConfig): SanitizedConfig => {
  const locks = config.collections.find(({ slug }) => slug === 'payload-locked-documents')
  if (locks) {
    locks.access.create = lockInCallersName
    locks.access.update = lockInCallersName
    locks.access.delete = callersOwnLocks
  }
  return config
}
