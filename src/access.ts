import type { Access, BaseFilter, FieldAccess, Where } from 'payload'
import { appendVersionToQueryKey } from 'payload'
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
 * Which admin panel an account gets, from the strongest role it holds. A
 * fellow also holds `member`, so `fellow` is tested before `student`.
 */
export type AdminView = 'admin' | 'fellow' | 'student'

export const adminViewOf = (user: RoleHolder): AdminView | null => {
  if (isAdminUser(user)) return 'admin'
  if (isFellowUser(user)) return 'fellow'
  if (hasRole(user, 'member', 'non_degree_seeking')) return 'student'
  return null
}

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
export const ownsViaEditors: Ownership = (user) => {
  const person = personOf(user)
  return person === null ? false : { editors: { contains: person } }
}
export const ownsViaPerson: Ownership = (user) => {
  const person = personOf(user)
  return person === null ? false : { person: { equals: person } }
}

/* =========================================================== access rules */

export const anyone: Access = () => true

export const isAuthenticated: Access = ({ req }) => Boolean(req.user)

/**
 * People shown on the site, plus the reader's own person. Admins read
 * everyone, hidden applicants included.
 */
export const readPeople: Access = ({ req }) => {
  if (isAdminUser(req.user)) return true
  const visible: Where = { visible: { equals: true } }
  const own = personOf(req.user)
  return own === null ? visible : { or: [visible, { id: { equals: own } }] }
}

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

/**
 * `isAdminOrOwn` for `readVersions`. Payload applies that rule to the versions
 * table, where every field sits under `version.` (`version.fellows`, not
 * `fellows`), so an unprefixed constraint fails with "Cannot find field".
 * `appendVersionToQueryKey` is Payload's own prefixer; it maps `id` to `parent`.
 */
export const isAdminOrOwnVersions =
  (owned: Ownership): Access =>
  ({ req }) => {
    if (isAdminUser(req.user)) return true
    if (!req.user) return false
    const owns = owned(req.user)
    return owns ? appendVersionToQueryKey(owns) : false
  }

/**
 * Who may write articles: community members, fellows, visiting students and
 * admins. A non-admin also needs a linked person, since an article is owned
 * through its authors and an unlinked account could never reach it again.
 */
export const canAuthor: Access = ({ req }) => {
  if (isAdminUser(req.user)) return true
  return hasRole(req.user, 'member', 'fellow', 'non_degree_seeking') && personOf(req.user) !== null
}

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

/**
 * Wraps an access rule so only admins may publish. Payload asks the update
 * (or create) rule with `_status: 'published'` to decide whether to show the
 * Publish button, so a non-admin gets "Save draft" only, and the API refuses
 * a publish from them as well.
 */
export const adminPublishes =
  (access: Access): Access =>
  (args) => {
    const data = args.data as { _status?: unknown } | undefined
    if (data?._status === 'published' && !isAdminUser(args.req.user)) return false
    return access(args)
  }

/**
 * Who may propose a publication: students (`member`, `non_degree_seeking`)
 * and admins. A student needs a linked person, as with `canAuthor`.
 */
export const canProposePublication: Access = ({ req }) => {
  if (isAdminUser(req.user)) return true
  return adminViewOf(req.user) === 'student' && personOf(req.user) !== null
}

/** Enrollments a user may read: their own, and those in courses they teach. */
export const readEnrollments: Access = ({ req }) => {
  if (isAdminUser(req.user)) return true
  const person = personOf(req.user)
  if (person === null) return false
  const own: Where = { person: { equals: person } }
  return isFellowUser(req.user)
    ? { or: [own, { 'course.fellows': { contains: person } }] }
    : own
}

/**
 * Admin list filter: a non-admin lists only the documents they own, not every
 * public one they may read. The site keeps reading through `access.read`.
 */
export const ownList =
  (owned: Ownership): BaseFilter =>
  ({ req }) => {
    if (!req.user || isAdminUser(req.user)) return null
    // No linked person: own nothing. No row has id 0.
    return owned(req.user) || { id: { equals: 0 } }
  }

/** For drafts-enabled collections with no tier: the public reads what is published. */
export const publishedOrAdmin: Access = ({ req }) =>
  isAdminUser(req.user) || { _status: { equals: 'published' } }

/**
 * For drafts-enabled collections with an owner but no tier: the public reads
 * what is published, an owner also their own drafts.
 */
export const publishedOrOwn =
  (owned: Ownership): Access =>
  ({ req }) => {
    if (isAdminUser(req.user)) return true
    const published: Where = { _status: { equals: 'published' } }
    const owns = req.user ? owned(req.user) : false
    return owns ? { or: [published, owns] } : published
  }

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
