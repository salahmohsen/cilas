import {
  canSetTier,
  isAdminOrOwnAndDraft,
  isAdminOrSuperAdminOrFellow,
  ownsViaFellows,
  readTiers,
} from '@/access'
import { slugField } from '@/fields/slug'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  Payload,
} from 'payload'
import type { Course } from '@/payload-types'

/** `fellows` arrives as ids, or as populated users when depth > 0. */
const toIds = (fellows: Course['fellows'] | undefined): number[] =>
  (fellows ?? [])
    .map((fellow) => (typeof fellow === 'object' ? fellow.id : fellow))
    .filter((id): id is number => typeof id === 'number')

const grantFellow = async (payload: Payload, id: number): Promise<void> => {
  const user = await payload.findByID({
    collection: 'users',
    id,
    depth: 0,
    overrideAccess: true,
  })

  if (user.roles.includes('fellow')) return

  await payload.update({
    collection: 'users',
    id,
    data: { roles: [...user.roles, 'fellow'] },
    // users.update is admin-only.
    overrideAccess: true,
  })
}

/**
 * Revokes `fellow` once the user is on no other course, at any tier. The
 * course being saved or deleted is excluded so it cannot vouch for itself.
 */
const revokeIfUnteaching = async (
  payload: Payload,
  id: number,
  exceptCourseId: number,
): Promise<void> => {
  const elsewhere = await payload.find({
    collection: 'courses',
    where: {
      and: [{ fellows: { contains: id } }, { id: { not_equals: exceptCourseId } }],
    },
    limit: 1,
    depth: 0,
    // courses.read is tiered by `tier` and ownership.
    overrideAccess: true,
  })

  if (elsewhere.totalDocs > 0) return

  const user = await payload.findByID({
    collection: 'users',
    id,
    depth: 0,
    overrideAccess: true,
  })

  if (!user.roles.includes('fellow')) return

  const roles = user.roles.filter((role) => role !== 'fellow')

  await payload.update({
    collection: 'users',
    id,
    // roles is required, so fall back rather than write an empty array.
    data: { roles: roles.length > 0 ? roles : ['member'] },
    overrideAccess: true,
  })
}

/**
 * `courses.fellows` stores ids, so granting and revoking the role means writing
 * to the user documents — the course's own field cannot do it. afterChange, not
 * beforeChange, so users are only touched once the course write has landed.
 */
export const propagateFellowRole: CollectionAfterChangeHook<Course> = async ({
  doc,
  req,
  previousDoc,
}) => {
  const before = toIds(previousDoc?.fellows)
  const after = toIds(doc.fellows)

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
  for (const id of toIds(doc.fellows)) {
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
      relationTo: 'users',
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
