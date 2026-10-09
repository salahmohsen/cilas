import {
  canSetTier,
  isAdminOrOwnAndDraft,
  isAdminOrSuperAdminOrFellow,
  ownsViaFellows,
  readTiers,
} from '@/access'
import { slugField } from '@/fields/slug'
import { grantFellow, revokeIfUnteaching, toPersonIds } from '@/lib/fellow-role'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig } from 'payload'
import type { Course } from '@/payload-types'

/**
 * `courses.fellows` lists people, but the `fellow` role lives on the account
 * linked to each person, so granting and revoking means writing to `users` —
 * the course's own field cannot do it. afterChange, not beforeChange, so
 * accounts are only touched once the course write has landed.
 */
export const propagateFellowRole: CollectionAfterChangeHook<Course> = async ({
  doc,
  req,
  previousDoc,
}) => {
  const before = toPersonIds(previousDoc?.fellows)
  const after = toPersonIds(doc.fellows)

  for (const id of after.filter((id) => !before.includes(id))) {
    await grantFellow(req.payload, id)
  }

  for (const id of before.filter((id) => !after.includes(id))) {
    await revokeIfUnteaching(req.payload, id, doc.id)
  }

  return doc
}

/** afterChange never fires for a delete, so revocation needs its own hook. */
export const revokeDeletedCourseFellows: CollectionAfterDeleteHook<Course> = async ({
  doc,
  req,
}) => {
  for (const id of toPersonIds(doc.fellows)) {
    await revokeIfUnteaching(req.payload, id, doc.id)
  }

  return doc
}

export const Courses: CollectionConfig = {
  slug: 'courses',
  access: {
    read: readTiers(ownsViaFellows, { drafts: true }),
    create: isAdminOrSuperAdminOrFellow,
    update: isAdminOrOwnAndDraft(ownsViaFellows, { allow: ['fellow'] }),
    delete: isAdminOrOwnAndDraft(ownsViaFellows, { allow: ['fellow'] }),
  },
  versions: {
    drafts: {
      autosave: {
        interval: 300,
      },
    },
  },
  fields: [
    {
      // `tier` is who may see this, not whether it is published — that is
      // Payload's `_status`. Named distinctly so the two never read alike.
      name: 'tier',
      type: 'select',
      defaultValue: 'owner',
      required: true,
      options: [
        { label: 'Owner only', value: 'owner' }, // whoever can edit it
        { label: 'Community', value: 'community' }, // signed-in members only
        { label: 'Public', value: 'public' }, // world
      ],
      // Admin-only on create *and* update, so a fellow's course keeps the
      // `owner` default and promoting it stays an admin action.
      access: { create: canSetTier, update: canSetTier },
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'course_type',
      label: 'Course Type',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Core Course',
          value: 'CORE',
        },
        { label: 'Thematic Course', value: 'THEMATIC' },
        { label: 'Lab', value: 'LAB' },
        { label: 'Workshop', value: 'WORKSHOP' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'cycle',
      label: 'Cycle',
      type: 'relationship',
      relationTo: 'cycles',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'cover_image',
      type: 'upload',
      relationTo: 'media',
      label: 'Cover Image',
      admin: {
        position: 'sidebar',
      },
    },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    {
      // Presentational — groups identity fields without nesting them.
      label: 'Overview',
      type: 'group',
      fields: [
        { name: 'subtitle', type: 'text', localized: true },
        { name: 'summary', type: 'text', localized: true },
        { name: 'epigraph', type: 'text', localized: true },
      ],
    },
    {
      label: 'Description',
      type: 'group',
      fields: [{ name: 'description', type: 'richText', localized: true }],
    },
    {
      name: 'location',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Offline', value: 'OFFLINE' },
        { label: 'Online', value: 'ONLINE' },
        { label: 'Hybrid', value: 'HYBRID' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      label: 'Tuition',
      type: 'group',
      fields: [
        { name: 'amount', type: 'number' },
        {
          name: 'based_deductions_available',
          type: 'checkbox',
          label: 'Need-based deductions available',
        },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'fellows',
      type: 'relationship',
      relationTo: 'people',
      hasMany: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'registration_form',
      type: 'relationship',
      relationTo: 'forms',
      admin: {
        position: 'sidebar',
      },
    },
    {
      label: 'Syllabus',
      type: 'group',
      fields: [
        {
          name: 'sessions',
          type: 'array',
          label: 'Session-by-session',
          fields: [
            { name: 'order', type: 'number' }, // sort key
            { name: 'session_title', type: 'text', label: 'Session Title' },
            {
              name: 'Date and Time',
              type: 'group',
              admin: { position: 'sidebar' },
              fields: [
                { name: 'date', type: 'date' },
                {
                  name: 'start_time',
                  label: 'Start Time',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: { pickerAppearance: 'timeOnly', displayFormat: 'h:mm a' },
                  },
                },
                {
                  name: 'end_time',
                  label: 'End Time',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: { pickerAppearance: 'timeOnly', displayFormat: 'h:mm a' },
                  },
                },
              ],
            },
            { name: 'description', type: 'richText', localized: true },
            {
              name: 'bibliography',
              type: 'array',
              fields: [
                {
                  name: 'type',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Reading', value: 'reading' },
                    { label: 'Watch', value: 'watch' },
                    { label: 'Listen', value: 'listen' },
                    { label: 'Prompt', value: 'prompt' },
                    { label: 'Other', value: 'other' },
                  ],
                },
                { name: 'title', type: 'text', localized: true, index: true },
                { name: 'href', type: 'text' }, // youtube / vimeo / article url
                { name: 'note', type: 'text', localized: true }, // author, year, pages; primary vs secondary reading
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'bibliography',
      type: 'array',
      label: 'Course Bibliography (all sessions)',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          options: [
            { label: 'Reading', value: 'reading' },
            { label: 'Watch', value: 'watch' },
            { label: 'Listen', value: 'listen' },
            { label: 'Prompt', value: 'prompt' },
            { label: 'Other', value: 'other' },
          ],
        },
        { name: 'title', type: 'text', localized: true, index: true },
        { name: 'href', type: 'text' }, // youtube / vimeo / article url
        { name: 'note', type: 'text', localized: true }, // author, year, pages; primary vs secondary reading
      ],
    },
  ],

  admin: {
    useAsTitle: 'title',
    // The admin iframe loads this URL directly, so it must go through
    // /api/preview rather than the page itself: that route authenticates the
    // editor, enables draft mode, and only then redirects to the course, which
    // is what lets the page render an unpublished draft.
    livePreview: {
      url: ({ data }) => `/api/preview?collection=courses&slug=${data?.slug ?? ''}`,
    },
  },
  hooks: {
    afterChange: [propagateFellowRole],
    afterDelete: [revokeDeletedCourseFellows],
  },
}
