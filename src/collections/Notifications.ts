import type { Access, CollectionConfig, PayloadHandler } from 'payload'

import { publishChange, publishDelete } from '@/lib/realtime/publish'

/** Each account sees, marks and clears only its own notifications. */
const own: Access = ({ req }) => (req.user ? { recipient: { equals: req.user.id } } : false)

/** "Mark all read": every unread notification of the signed-in account. */
const readAll: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ error: 'Sign in first.' }, { status: 401 })
  await req.payload.update({
    collection: 'notifications',
    where: { and: [{ recipient: { equals: req.user.id } }, { read_at: { exists: false } }] },
    data: { read_at: new Date().toISOString() },
    overrideAccess: true,
  })
  return Response.json({ ok: true })
}

/**
 * What happened that an account should know: a submission waiting for an
 * admin, a decision on an owner's work, a new application. Shown under the
 * bell in the admin's top bar (src/components/admin/notification-bell.tsx),
 * beside the emails. Written by the server only (src/lib/notify.ts). Each
 * change also goes live to the recipient's open tabs
 * (docs/realtime-notifications.md).
 */
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  admin: { hidden: true, useAsTitle: 'title' },
  access: { read: own, update: own, delete: own, create: () => false },
  defaultSort: '-createdAt',
  endpoints: [{ path: '/read-all', method: 'post', handler: readAll }],
  hooks: { afterChange: [publishChange], afterDelete: [publishDelete] },
  fields: [
    {
      name: 'recipient',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      // Deleting the account clears its bell (the cascade the migration
      // 20261023_083500 sets: the adapter's default SET NULL cannot apply to
      // a required recipient).
      access: { update: () => false },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        'submitted',
        'approved',
        'changes_requested',
        'rejected',
        'removed',
        'application',
        'mention',
        'comment',
        'reply',
        'reaction',
        'announcement',
        'moderation',
        'report',
        'question',
        'event_changed',
      ].map((value) => ({
        value,
        label: value.replace('_', ' '),
      })),
      access: { update: () => false },
    },
    { name: 'title', type: 'text', required: true, access: { update: () => false } },
    // The row's detail line, written at event time (the label stays short).
    { name: 'description', type: 'text', access: { update: () => false } },
    // The actor as a snapshot (src/lib/notify.ts actorOf), so reading needs no join.
    { name: 'actor_name', type: 'text', access: { update: () => false } },
    { name: 'actor_photo', type: 'text', access: { update: () => false } },
    { name: 'link', type: 'text', access: { update: () => false } },
    // The one thing a reader changes: when they read it.
    { name: 'read_at', type: 'date', index: true },
  ],
}
