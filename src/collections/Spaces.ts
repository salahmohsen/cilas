import type { CollectionConfig } from 'payload'

import { isAdminUser } from '@/access'
import { readSpaces } from '@/lib/spaces'
import { ABOUT_MAX } from '@/lib/space-about'
import type { CommunityAudience, EventPosting, PostingLevel, SpaceKind } from '@/lib/spaces'

/**
 * One row per space (spec §1). Its settings live here; its members never do,
 * they are worked out from the courses, enrollments, memberships and the
 * account's person (src/lib/spaces.ts). Created by hooks when a course or a
 * programme record is first published. Community spaces are made by an admin
 * in the admin panel (a name and an audience) and by the seed.
 */
export const Spaces: CollectionConfig = {
  slug: 'spaces',
  labels: { singular: 'Space', plural: 'Spaces' },
  access: {
    read: readSpaces,
    // Course and cohort rows are made by hooks, community rows by an admin.
    create: ({ req }) => isAdminUser(req.user),
    update: ({ req }) => isAdminUser(req.user),
    delete: ({ req }) => isAdminUser(req.user),
  },
  admin: {
    group: 'Community',
    defaultColumns: ['kind', 'course', 'programme', 'posting', 'reopened', 'updatedAt'],
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Community', value: 'community' },
        { label: 'Cohort', value: 'cohort' },
        { label: 'Course', value: 'course' },
      ] satisfies { label: string; value: SpaceKind }[],
      access: { update: () => false }, // the kind never changes after the row exists
    },
    {
      // Course and cohort spaces are named by their course or programme.
      name: 'name',
      label: 'Space name',
      type: 'text',
      localized: true,
      maxLength: 80,
      admin: {
        description: 'For example “Tech community”. Empty shows “Community”.',
        condition: (data) => (data as { kind?: string }).kind === 'community',
      },
    },
    {
      name: 'audience',
      label: 'Who may join',
      type: 'select',
      required: true,
      defaultValue: 'all',
      options: [
        { label: 'All members', value: 'all' },
        { label: 'Fellows only', value: 'fellows' },
        { label: 'Admins only', value: 'admins' },
      ] satisfies { label: string; value: CommunityAudience }[],
      admin: {
        description: 'A fellow is listed on a course or holds a fellow role in a programme.',
        condition: (data) => (data as { kind?: string }).kind === 'community',
      },
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      index: true,
      admin: { condition: (data) => (data as { kind?: string }).kind === 'course' },
    },
    {
      name: 'programme',
      type: 'relationship',
      relationTo: 'programmes',
      index: true,
      admin: { condition: (data) => (data as { kind?: string }).kind === 'cohort' },
    },
    {
      // spec §7 narrowed modes, without the moderation powers of step 3.
      name: 'posting',
      label: 'Posting level',
      type: 'select',
      defaultValue: 'open',
      options: [
        { label: 'Open — everyone posts and comments', value: 'open' },
        { label: 'Members comment — moderators start posts', value: 'members_comment' },
        { label: 'Moderators only', value: 'fellows_only' },
      ] satisfies { label: string; value: PostingLevel }[],
    },
    {
      name: 'events',
      label: 'Who may create events',
      type: 'select',
      defaultValue: 'members',
      options: [
        { label: 'Every member who may post', value: 'members' },
        { label: 'Moderators only', value: 'moderators' },
      ] satisfies { label: string; value: EventPosting }[],
    },
    {
      // Replaces the default "About this space" text; empty keeps the default.
      name: 'about',
      label: 'About this space',
      type: 'textarea',
      localized: true,
      maxLength: ABOUT_MAX,
    },
    {
      // Moderators and admins reopen a read-only course space (spec §11).
      name: 'reopened',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Reopens a course space archived 2 weeks after its last meeting.' },
    },
    {
      // The intro post, created with the space by hook or seed (moderators may edit
      // only this post — Task 8's `postEdit` covers it).
      name: 'introduction_post',
      type: 'relationship',
      relationTo: 'space-posts',
      admin: {
        description: 'Set by the system when the space opens; moderators edit the post itself.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        // A custom name or audience means nothing outside a community space.
        const kind = data.kind ?? originalDoc?.kind
        if (kind && kind !== 'community') {
          delete data.name
          data.audience = 'all'
        }
        return data
      },
    ],
  },
  indexes: [
    { fields: ['course'], unique: true },
    { fields: ['programme'], unique: true },
  ],
}
