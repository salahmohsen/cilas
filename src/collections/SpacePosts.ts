import type { CollectionConfig } from 'payload'

import { isAdminUser } from '@/access'
import { contentWhere } from '@/lib/spaces'

/**
 * Discussion, announcement, event and vote posts (spec §3). `question` sits
 * in the enum for step 2; no question UI ships yet. An event adds where and
 * when; a vote adds its options, fixed once the post exists. Bodies are Markdown, written once,
 * not translated.
 *
 * REST refusal (plan decision): members write through the server actions
 * only, so posting levels, consent, the mention safelist and the edit stamp
 * cannot be bypassed from the API surface. Admins may fix rows directly.
 */
export const SpacePosts: CollectionConfig = {
  slug: 'space-posts',
  labels: { singular: 'Post', plural: 'Posts' },
  access: {
    read: async ({ req }) => contentWhere(req.payload, req.user, ['id']),
    create: ({ req }) => isAdminUser(req.user),
    update: ({ req }) => isAdminUser(req.user),
    // Deletes (authors included) go through the actions' postRemove, which
    // leaves the placeholder when replies exist (spec §3) and removes the
    // row's files. A REST hard-delete would orphan replies, reactions and
    // files — the rules above already refuse create/update from REST.
    delete: ({ req }) => isAdminUser(req.user),
  },
  versions: { drafts: false },
  admin: {
    group: 'Community',
    defaultColumns: ['space', 'kind', 'author', 'last_activity_at', 'updatedAt'],
  },
  fields: [
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'people',
      index: true,
      access: { update: () => false },
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'discussion',
      options: ['discussion', 'question', 'announcement', 'event', 'vote'],
      access: { update: () => false },
    },
    { name: 'body', type: 'textarea', required: true },
    {
      // The event's name on its card; the body is its description. Older
      // events have none and show the body's first line.
      name: 'event_title',
      label: 'Event name',
      type: 'text',
      admin: { condition: (data) => (data as { kind?: string }).kind === 'event' },
    },
    {
      name: 'event_location',
      type: 'text',
      admin: { condition: (data) => (data as { kind?: string }).kind === 'event' },
    },
    {
      name: 'event_starts_at',
      type: 'date',
      admin: {
        condition: (data) => (data as { kind?: string }).kind === 'event',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      // Cairo wall-clock like the start; eventEdit and shapeData keep it after the start.
      name: 'event_ends_at',
      type: 'date',
      admin: {
        condition: (data) => (data as { kind?: string }).kind === 'event',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      // The place a web address names (a Maps place or a page title), read on
      // save so the card needs no fetch; null shows the host.
      name: 'event_place',
      label: 'Place name',
      type: 'text',
      admin: {
        condition: (data) => (data as { kind?: string }).kind === 'event',
        readOnly: true,
      },
    },
    {
      // A space file with no post or comment of its own, so it is neither one
      // of the post's attachments nor counted against them; postRemove and
      // eventEdit delete it with the post or when it is replaced.
      name: 'event_cover',
      label: 'Cover',
      type: 'relationship',
      relationTo: 'space-files',
      admin: { condition: (data) => (data as { kind?: string }).kind === 'event' },
    },
    {
      // The cover's dominant colour (#rrggbb), for the field under the photo.
      name: 'event_cover_tone',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'vote_options',
      type: 'array',
      access: { update: () => false },
      admin: { condition: (data) => (data as { kind?: string }).kind === 'vote' },
      fields: [{ name: 'label', type: 'text', required: true }],
    },
    {
      name: 'vote_multiple',
      label: 'Members may choose more than one option',
      type: 'checkbox',
      defaultValue: false,
      access: { update: () => false },
      admin: { condition: (data) => (data as { kind?: string }).kind === 'vote' },
    },
    {
      name: 'vote_anonymous',
      label: 'Nobody sees who chose what',
      type: 'checkbox',
      defaultValue: false,
      access: { update: () => false },
      admin: { condition: (data) => (data as { kind?: string }).kind === 'vote' },
    },
    {
      // The id of one row of the course's `sessions` array, not a copy: the
      // post shows the session as the course has it now. postCreate checks
      // who may attach one, to which kind, and that it is this course's.
      name: 'course_session',
      label: 'Course session',
      type: 'text',
      access: { update: () => false },
      admin: {
        condition: (data) => Boolean((data as { course_session?: unknown }).course_session),
      },
    },
    { name: 'pinned', type: 'checkbox', defaultValue: false, index: true },
    { name: 'locked', type: 'checkbox', defaultValue: false },
    {
      // Set by the action that mailed the announcement (mailing lands in step 3).
      name: 'announcement_email_sent',
      label: 'Announcement emailed',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
    },
    { name: 'edited_at', type: 'date' },
    { name: 'last_activity_at', type: 'date', index: true },
    { name: 'deleted_at', type: 'date', index: true },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // An announcement pins itself (spec §3), and every post stamps its
        // activity for the feed sort. beforeChange, so the values land with
        // the row (afterChange's `data` is no longer writable).
        if (operation !== 'create' || !data) return data
        if ((data as { kind?: string }).kind === 'announcement') data.pinned = true
        if (!(data as { last_activity_at?: unknown }).last_activity_at) {
          ;(data as { last_activity_at?: unknown }).last_activity_at = new Date().toISOString()
        }
        return data
      },
    ],
  },
}
