import type { CollectionConfig } from 'payload'

import { isAdminUser } from '@/access'
import { readSpaces } from '@/lib/spaces'
import type { PostingLevel, SpaceKind } from '@/lib/spaces'

/**
 * One row per space (spec §1). Its settings live here; its members never do,
 * they are worked out from the courses, enrollments, memberships and the
 * account's person (src/lib/spaces.ts). Created by hooks when a course or a
 * programme record is first published, and by the seed for the community
 * space — never by hand in the admin.
 */
export const Spaces: CollectionConfig = {
  slug: 'spaces',
  labels: { singular: 'Space', plural: 'Spaces' },
  access: {
    read: readSpaces,
    // Rows are made by hooks and the seed. An admin may fix a row by hand.
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
  indexes: [
    { fields: ['course'], unique: true },
    { fields: ['programme'], unique: true },
  ],
}
