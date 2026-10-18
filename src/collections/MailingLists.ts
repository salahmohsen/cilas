import { APIError } from 'payload'
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
  PayloadHandler,
} from 'payload'

import { isAdmin, isAdminUser } from '@/access'
import { env } from '@/env'
import { SYNC_WRITE, syncLater, syncList } from '@/lib/list-sync'
import { createSegment } from '@/lib/resend-contacts'

import { ROLE_OPTIONS } from './Users'

/** One list takes the public signups; a second would split them. */
const oneSignupList: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (data.source !== 'signup') return data
  const { docs } = await req.payload.find({
    collection: 'mailing-lists',
    where: {
      and: [
        { source: { equals: 'signup' } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    limit: 1,
    depth: 0,
    req,
  })
  if (docs[0])
    throw new APIError(`“${docs[0].name}” takes the signups already. Keep one signup list.`, 400)
  return data
}

/** A list without a segment gets its own in Resend, named as the list. */
const ensureSegment: CollectionBeforeChangeHook = async ({ data }) => {
  if (data.segment_id?.trim()) return { ...data, segment_id: data.segment_id.trim() }
  if (!env.RESEND_API_KEY)
    throw new APIError('RESEND_API_KEY is not set on the server, so no segment can be made.', 503)
  return { ...data, segment_id: await createSegment(env.RESEND_API_KEY, data.name) }
}

/** After an admin saves a synced list, its segment follows, in the background. */
const syncAfterSave: CollectionAfterChangeHook = ({ doc, req }) => {
  if (!req.context?.[SYNC_WRITE] && doc.source === 'members') syncLater(req.payload, doc)
  return doc
}

/** "Sync now": waits for the sync, so the admin sees what changed. */
const syncNow: PayloadHandler = async (req) => {
  if (!isAdminUser(req.user)) return Response.json({ error: 'Admins only.' }, { status: 403 })
  const list = await req.payload
    .findByID({
      collection: 'mailing-lists',
      id: Number(req.routeParams?.id),
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  if (!list) return Response.json({ error: 'Save the list first.' }, { status: 404 })
  if (list.source !== 'members')
    return Response.json({ error: 'A signup list fills itself.' }, { status: 400 })
  try {
    return Response.json({ ok: true, ...(await syncList(req.payload, list)) })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 })
  }
}

/**
 * Who a newsletter goes to. Each list is a Resend segment (ADR 0005): the
 * signup list fills from the site's signup forms; a synced list holds the
 * accounts its rules pick (roles, courses, programmes, chosen people) and is
 * brought up to date when saved, on "Sync now", and before every send.
 */
export const MailingLists: CollectionConfig = {
  slug: 'mailing-lists',
  labels: { singular: 'Mailing list', plural: 'Mailing lists' },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'source', 'member_count', 'last_synced'],
    description:
      'Who newsletters go to. Each list is a segment in Resend; a person on several lists counts once toward the plan’s contacts.',
  },
  endpoints: [{ path: '/:id/sync', method: 'post', handler: syncNow }],
  hooks: { beforeChange: [oneSignupList, ensureSegment], afterChange: [syncAfterSave] },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { placeholder: 'e.g. Community, Fellows, Bridge 2026' },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'members',
      options: [
        { label: 'Signup form (the public list)', value: 'signup' },
        { label: 'Synced from members', value: 'members' },
      ],
      admin: {
        description:
          'Signup form: visitors join from the site. Synced from members: CILAS accounts, picked below; people without an account are left out.',
      },
    },
    {
      name: 'members',
      type: 'group',
      label: 'Who is on the list',
      admin: {
        condition: (data) => data?.source === 'members',
        description: 'An account joins when it matches any of these.',
      },
      fields: [
        { name: 'everyone', type: 'checkbox', label: 'Every account' },
        {
          name: 'roles',
          type: 'select',
          hasMany: true,
          options: [...ROLE_OPTIONS],
          admin: { description: 'Every account with one of these roles, e.g. all fellows.' },
        },
        { name: 'courses', type: 'relationship', relationTo: 'courses', hasMany: true },
        {
          name: 'course_people',
          label: 'From those courses',
          type: 'select',
          hasMany: true,
          defaultValue: ['students', 'fellows'],
          options: [
            { label: 'Students (accepted, confirmed or completed)', value: 'students' },
            { label: 'Fellows who teach them', value: 'fellows' },
          ],
          admin: { condition: (_, sibling) => Boolean(sibling?.courses?.length) },
        },
        {
          name: 'programmes',
          type: 'relationship',
          relationTo: 'programmes',
          hasMany: true,
          admin: {
            description:
              'Everyone with a place in the programme: students and resident fellows of a Bridge cohort.',
          },
        },
        {
          name: 'users',
          label: 'Chosen accounts',
          type: 'relationship',
          relationTo: 'users',
          hasMany: true,
        },
      ],
    },
    {
      name: 'segment_id',
      label: 'Resend segment ID',
      type: 'text',
      admin: {
        position: 'sidebar',
        description:
          'Empty: a segment is made in Resend on save. Paste one to use a segment you have.',
      },
    },
    {
      name: 'topic_id',
      label: 'Resend topic ID',
      type: 'text',
      admin: {
        position: 'sidebar',
        description:
          'Optional: the kind of email this list gets (Resend → Contacts → Topics). People who opt out of the topic are skipped, and keep their other lists.',
      },
    },
    {
      name: 'sync',
      type: 'ui',
      admin: {
        position: 'sidebar',
        condition: (data) => data?.source === 'members' && Boolean(data?.id),
        components: { Field: '/components/admin/sync-list-button#SyncListButton' },
      },
    },
    {
      name: 'member_count',
      label: 'Members at last sync',
      type: 'number',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'last_synced',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'sync_note', type: 'text', admin: { position: 'sidebar', readOnly: true } },
  ],
}
