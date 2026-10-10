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

/**
 * The person a signed-in account acts as, or null when the account is not
 * linked. `person` arrives as an id, or populated when depth > 0.
 */
export const personOf = (user: unknown): number | null => {
  const person = (user as { person?: unknown } | null | undefined)?.person
  if (typeof person === 'number') return person
  if (person && typeof person === 'object' && typeof (person as { id?: unknown }).id === 'number') {
    return (person as { id: number }).id
  }
  return null
}

/* ============================================================= constraints */

/**
 * How a user owns a document. The relationship field differs per collection,
 * so ownership is supplied as a constraint builder rather than hardcoded.
 * `false` means this user cannot own anything here (e.g. an account with no
 * linked person), and callers must treat it as "no ownership path".
 */
export type Ownership = (user: User) => Where | false

export const ownsViaFellows: Ownership = (user) => {
  const person = personOf(user)
  return person === null ? false : { fellows: { contains: person } }
}
export const ownsViaAuthors: Ownership = (user) => {
  const person = personOf(user)
  return person === null ? false : { authors: { contains: person } }
}
export const ownsViaPerson: Ownership = (user) => {
  const person = personOf(user)
  return person === null ? false : { person: { equals: person } }
}

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
export const isAdminOrOwnAndDraft =
  (owned: Ownership, { allow }: { allow?: Role[] } = {}): Access =>
  ({ req }) => {
    if (isAdminUser(req.user)) return true
    if (!req.user) return false
    if (allow && !hasRole(req.user, ...allow)) return false

    const owns = owned(req.user)
    if (!owns) return false

    // Both constraints must hold. `owns && { _status }` would evaluate to the
    // second object alone and drop ownership entirely.
    return { and: [owns, { _status: { equals: 'draft' } }] }
  }

/** Admins see every row; a signed-in account only the rows it owns. */
export const isAdminOrOwn =
  (owned: Ownership): Access =>
  ({ req }) => {
    if (isAdminUser(req.user)) return true
    if (!req.user) return false
    return owned(req.user)
  }

/** Who may write articles: community members, fellows, visiting students and admins. */
export const canAuthor: Access = ({ req }) =>
  hasRole(req.user, 'member', 'fellow', 'non_degree_seeking', 'admin', 'super_admin')

/**
 * Admins edit anything; an owner only while the document also matches
 * `while` (e.g. an article still with its author, not yet submitted).
 */
export const isAdminOrOwnWhile =
  (owned: Ownership, where: Where): Access =>
  ({ req }) => {
    if (isAdminUser(req.user)) return true
    if (!req.user) return false
    const owns = owned(req.user)
    return owns ? { and: [owns, where] } : false
  }

/** For drafts-enabled collections with no tier: the public reads what is published. */
export const publishedOrAdmin: Access = ({ req }) =>
  isAdminUser(req.user) || { _status: { equals: 'published' } }

/**
 * Read rule for a tiered document, keyed on the `tier` field:
 *   `public`   — world, including anonymous
 *   `community` — any signed-in user
 *   `owner`     — only whoever may edit it, via the ownership constraint
 *
 * `tier` says who may see a document. It is not publication state: that is
 * Payload's injected `_status` (`draft` / `published` / `changed`). The two are
 * deliberately named differently so a query or log line naming one can never be
 * mistaken for the other.
 *
 * `owned` is omitted for collections with no owner relationship.
 *
 * One vocabulary across every tiered collection — `public`, not `published`.
 * These are Postgres enums, so a collection whose enum spells the top tier
 * differently makes every read throw rather than return nothing. Articles
 * carries its own inline read rule but uses the same `public`.
 *
 * Collections with drafts enabled (Courses) additionally carry Payload's
 * injected `_status`. It is a publication gate on top of the tier: a document
 * is only served to the audience its `tier` names once `_status` has reached
 * `published`. Until then only someone who may edit it sees it, which is what
 * lets the admin live preview render the draft being edited.
 *
 * That gate only exists on collections with `versions.drafts`, so it is opt-in
 * — Events shares this rule but has no drafts and must not be filtered on a
 * `_status` column it does not have.
 */
export const readTiers =
  (owned?: Ownership, { drafts = false }: { drafts?: boolean } = {}): Access =>
  ({ req }): Where | boolean => {
    // Whoever may edit the document must be able to read it back, or the admin
    // cannot render the draft it is currently editing.
    const published: Where = drafts ? { _status: { equals: 'published' } } : {}

    if (req.user && isAdminUser(req.user) && published) return true

    if (!req.user) {
      return drafts
        ? { and: [{ tier: { equals: 'public' } }, published] }
        : { tier: { equals: 'public' } }
    }

    const visible: Where[] = [
      drafts
        ? { and: [{ tier: { in: ['community', 'public'] } }, published] }
        : { tier: { in: ['community', 'public'] } },
    ]
    const owns = owned?.(req.user)
    if (owns) visible.push(owns)
    return { or: visible }
  }

/* =========================================================== field rules */

/**
 * Only admins may set `tier`, on create *and* on update.
 *
 * Because the field is inaccessible to fellows, Payload keeps its
 * `defaultValue` — so a fellow-authored course starts as `owner` and can
 * never be published by them. Publishing stays an admin action.
 */
export const canSetTier: FieldAccess = ({ req }) => isAdminUser(req.user)

/** Convenience aliases so call sites read as intent, not as role plumbing. */
export const canPublish: FieldAccess = canSetTier
