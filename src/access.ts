import type { Access, FieldAccess, Where } from 'payload'
import type { User } from '@/payload-types'

/* ============================================================== primitives */

export type Role = User['roles'][number]

/**
 * The minimum needed to read roles. `admin.hidden` / `admin.condition` receive
 * Payload's `ClientUser`, typed as `{ [key: string]: any } & BaseUser` — it
 * carries the same fields at runtime but is not assignable to full `User` and
 * has no `roles` property of its own, so the role primitives accept this
 * loose shape and read `roles` defensively.
 */
type RoleHolder = { roles?: readonly Role[] | null } | Record<string, unknown> | null | undefined

const rolesOf = (user: RoleHolder): Role[] => {
    const roles = (user as { roles?: unknown } | null | undefined)?.roles
    return Array.isArray(roles) ? (roles as Role[]) : []
}

export const getRoles = (user: RoleHolder): Role[] => rolesOf(user)

/** The one place a role is compared. `users.roles` is a hasMany select. */
export const hasRole = (user: RoleHolder, ...roles: Role[]): boolean =>
    rolesOf(user).some((role) => roles.includes(role))

export const isAdminUser = (user: RoleHolder): boolean => hasRole(user, 'admin', 'super_admin')

export const isFellowUser = (user: RoleHolder): boolean => hasRole(user, 'fellow')

/* ============================================================= constraints */

/**
 * How a user owns a document. The relationship field differs per collection,
 * so ownership is supplied as a constraint builder rather than hardcoded.
 */
export const ownsViaFellows = (user: User): Where => ({ fellows: { contains: user.id } })
export const ownsViaAuthor = (user: User): Where => ({ author: { equals: user.id } })

/* =========================================================== access rules */

export const anyone: Access = () => true

export const isAuthenticated: Access = ({ req }) => Boolean(req.user)

/** admin + super_admin. Gates write on the editorial collections. */
export const isAdmin: Access = ({ req }) => isAdminUser(req.user)

export const isAdminOrSuperAdminOrFellow: Access = ({ req }) =>
    hasRole(req.user, 'admin', 'super_admin', 'fellow')

export const isFellow: Access = ({ req }) => isFellowUser(req.user)

/**
 * Admins edit any document; everyone else only documents they own.
 * `allow` narrows who may take the ownership path — a course is editable by
 * the fellows listed on it, not by any logged-in user who happens to be linked.
 */
export const isAdminOrOwn = (
    owned: (user: User) => Where,
    { allow }: { allow?: Role[] } = {},
): Access => ({ req }) => {
    if (isAdminUser(req.user)) return true
    if (!req.user) return false
    if (allow && !hasRole(req.user, ...allow)) return false
    return owned(req.user)
}

export const isAdminOrListedAsFellow: Access = isAdminOrOwn(ownsViaFellows, { allow: ['fellow'] })
export const isAdminOrOwnArticle: Access = isAdminOrOwn(ownsViaAuthor)

/**
 * Read rule for a status-tiered document:
 *   `public`   — world, including anonymous
 *   `community` — any signed-in user
 *   `draft`     — the owner only, via the supplied ownership constraint
 *
 * `owned` is omitted for collections with no owner relationship.
 *
 * One vocabulary across every status-tiered collection — `public`, not
 * `published`. These are Postgres enums, so a collection whose enum spells the
 * top tier differently makes every read throw rather than return nothing.
 * Articles carries its own inline read rule but uses the same `public`.
 */
export const readTiers = (owned?: (user: User) => Where): Access => ({ req }): Where => {
    if (!req.user) return { status: { equals: 'public' } }
    const visible: Where[] = [{ status: { in: ['community', 'public'] } }]
    if (owned) visible.push(owned(req.user))
    return { or: visible }
}

/* =========================================================== field rules */

/**
 * Only admins may set `status`, on create *and* on update.
 *
 * Because the field is inaccessible to fellows, Payload keeps its
 * `defaultValue` — so a fellow-authored course starts as `draft` and can
 * never be published by them. Publishing stays an admin action.
 */
export const canSetStatus: FieldAccess = ({ req }) => isAdminUser(req.user)

/** Convenience aliases so call sites read as intent, not as role plumbing. */
export const canPublish: FieldAccess = canSetStatus
