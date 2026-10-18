import type {
  CollectionBeforeChangeHook,
  CollectionConfig,
  FieldAccess,
  PayloadRequest,
} from 'payload'

import { isAdmin, isAdminUser, personOf, type Role } from '@/access'
import { env } from '@/env'
import { teaches, withFellowRole } from '@/lib/fellow-role'
import type { User } from '@/payload-types'

/**
 * Keeps `fellow` true to the linked person when the link itself changes. The
 * course hooks cover the other direction (a course listing a person).
 * beforeChange, so the role lands in the same write as the link.
 */
export const syncFellowRoleOnLink: CollectionBeforeChangeHook<User> = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!('person' in data)) return data

  const before = personOf(originalDoc)
  const after = personOf(data)
  if (before === after) return data

  const isTeaching = after !== null && (await teaches(req.payload, after))
  const current = (data.roles ?? originalDoc?.roles ?? ['member']) as Role[]
  if (current.includes('fellow') === isTeaching) return data

  return { ...data, roles: withFellowRole(current, isTeaching) }
}

/**
 * The reset email, with Payload's own wording but an absolute link. Payload
 * builds the link from `serverURL`, which is not set: setting it would turn on
 * its CSRF check and refuse the first page after a Google sign-in. Without it,
 * the link would be a bare `/admin/reset/…` path, which an email cannot open.
 */
export const resetPasswordEmail = ({
  req,
  token,
}: { req?: PayloadRequest; token?: string } = {}): string => {
  const url = `${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')}/admin/reset/${token}`
  const t = (key: Parameters<PayloadRequest['t']>[0], fallback: string) =>
    req?.t ? req.t(key) : fallback
  return `${t('authentication:youAreReceivingResetPassword', 'You are receiving this because you (or someone else) have requested the reset of the password for your account. Please click on the following link, or paste this into your browser to complete the process:')}
    <a href="${url}">${url}</a>
    ${t('authentication:youDidNotRequestPassword', 'If you did not request this, please ignore this email and your password will remain unchanged.')}`
}

const isAdminField: FieldAccess = ({ req }) => isAdminUser(req.user)

/** Login accounts. Public profiles live in `people` (ADR 0001). */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'person', 'roles'],
  },
  auth: { forgotPassword: { generateEmailHTML: resetPasswordEmail } },
  access: {
    update: isAdmin,
  },
  hooks: {
    beforeChange: [syncFellowRoleOnLink],
  },
  fields: [
    {
      // Google's id for the account, written by the Google sign-in
      // (src/plugins/google-auth.ts). Declared here so the schema does not
      // depend on whether Google is configured. Nobody sets it by hand.
      name: 'sub',
      type: 'text',
      index: true,
      access: { read: isAdminField, create: () => false, update: () => false },
      admin: { readOnly: true, position: 'sidebar', description: 'Set by Google sign-in.' },
    },
    {
      // At most one account per person.
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      unique: true,
      admin: { position: 'sidebar' },
    },
    {
      // Role plumbing lives in the sidebar: identity first, permissions to
      // the side.
      label: 'Roles',
      type: 'group',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'roles',
          type: 'select',
          required: true,
          defaultValue: 'member',
          hasMany: true,
          options: [
            { label: 'Super Admin', value: 'super_admin' },
            { label: 'Admin', value: 'admin' },
            { label: 'Fellow', value: 'fellow' },
            { label: 'Member', value: 'member' },
            { label: 'Non-Degree-Seeking Student', value: 'non_degree_seeking' },
          ],
        },
      ],
    },
  ],
}
