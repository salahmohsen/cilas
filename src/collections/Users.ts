import { adminOnlyField } from '@/access'
import { ROLE_OPTIONS } from '@/access'
import type { CollectionBeforeChangeHook, CollectionConfig, PayloadRequest } from 'payload'

import { randomBytes } from 'node:crypto'

import { isAdmin, isAdminUser, personOf, type Role } from '@/access'
import { getEmailSettings, withDefaults } from '@/emails/settings'
import { resetMail } from '@/emails/transactional'
import { env } from '@/env'
import { teaches, withFellowRole } from '@/lib/fellow-role'
import { slugify } from '@/lib/slugify'

import type { User } from '@/payload-types'

/**
 * Keeps `fellow` true to the linked person when the link itself changes. The
 * course hooks cover the other direction (a course listing a person).
 * beforeChange, so the role lands in the same write as the link.
 */
/**
 * Every account but an admin's owns its work through a person (CONTEXT.md):
 * an account without one gets a hidden person, named from its email, in the
 * same write. Without it a fellow could not reach the course they propose,
 * nor write an article. An admin can rename or show the person later.
 */
export const ensurePerson: CollectionBeforeChangeHook<User> = async ({
  data,
  originalDoc,
  req,
}) => {
  const roles = (data.roles ?? originalDoc?.roles ?? ['member']) as Role[]
  if (isAdminUser({ roles }) || personOf(data) !== null) return data
  if (!('person' in data) && personOf(originalDoc) !== null) return data
  const email = (data.email ?? originalDoc?.email ?? '') as string
  const name =
    email
      .split('@')[0]
      ?.replace(/[._-]+/g, ' ')
      .trim() || 'CILAS member'
  const person = await req.payload.create({
    collection: 'people',
    data: {
      name,
      slug: `${slugify(name) || 'member'}-${randomBytes(3).toString('hex')}`,
      visible: false,
    },
    req,
  })
  return { ...data, person: person.id }
}

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
  // A first link only adds the role: a new fellow, given a person, has not
  // taught yet and keeps the role an admin gave them to propose a course.
  if (before === null && !isTeaching) return data

  return { ...data, roles: withFellowRole(current, isTeaching) }
}

const settingsFor = async (req?: PayloadRequest) =>
  req?.payload ? getEmailSettings(req.payload, req) : withDefaults({})

/**
 * The reset email, in the Email settings' layout and words, with an absolute
 * link. Payload builds the link from `serverURL`, which is not set: setting it
 * would turn on its CSRF check and refuse the first page after a Google
 * sign-in. Without it, the link would be a bare `/admin/reset/…` path, which
 * an email cannot open.
 */
export const resetPasswordEmail = async ({
  req,
  token,
  user,
}: {
  req?: PayloadRequest
  token?: string
  user?: { email?: string | null }
} = {}): Promise<string> =>
  (
    await resetMail(await settingsFor(req), {
      email: user?.email ?? '',
      token: token ?? '',
      site: env.NEXT_PUBLIC_SERVER_URL,
    })
  ).html

const resetPasswordSubject = async ({ req }: { req?: PayloadRequest } = {}): Promise<string> =>
  (await settingsFor(req)).texts.reset.subject

/** Login accounts. Public profiles live in `people` (ADR 0001). */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'person', 'roles'],
  },
  auth: {
    forgotPassword: {
      generateEmailHTML: resetPasswordEmail,
      generateEmailSubject: resetPasswordSubject,
    },
  },
  // Payload's default for a missing rule is "any signed-in account", which
  // would let a student read everyone's email, make a super admin or delete
  // accounts. Admins manage accounts; everyone else reads only their own.
  access: {
    read: ({ req }) =>
      isAdminUser(req.user) ? true : req.user ? { id: { equals: req.user.id } } : false,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [ensurePerson, syncFellowRoleOnLink],
  },
  fields: [
    {
      // Google's id for the account, written by the Google sign-in
      // (src/plugins/google-auth.ts). Declared here so the schema does not
      // depend on whether Google is configured. Nobody sets it by hand.
      name: 'sub',
      type: 'text',
      index: true,
      access: { read: adminOnlyField, create: () => false, update: () => false },
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
      // What the account wants to hear about, per kind and channel: only the
      // refusals are stored (src/lib/notification-preferences.ts). The settings
      // page writes it with a server action; the senders read it.
      name: 'notification_preferences',
      type: 'json',
      access: { create: () => false, update: adminOnlyField },
      admin: { hidden: true },
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
          options: [...ROLE_OPTIONS],
        },
      ],
    },
  ],
}
