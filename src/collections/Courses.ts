import {
  canSetTier,
  isAdminOrOwnAndDraft,
  isAdminOrOwnVersions,
  isAdminOrSuperAdminOrFellow,
  ownsViaFellows,
  readTiers,
} from '@/access'
import { bibliographyField } from '@/fields/bibliography'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { pricingField } from '@/fields/pricing'
import { registrationField } from '@/fields/registration'
import { scheduleField, timeRangeFields } from '@/fields/schedule'
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
    // Without this, any signed-in account reads drafts via the versions endpoint.
    readVersions: isAdminOrOwnVersions(ownsViaFellows),
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
      options: [...COURSE_TYPE_OPTIONS],
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
      label: 'Notes',
      type: 'collapsible',
      admin: { initCollapsed: true },
      fields: [
        { name: 'facilitator_note', type: 'textarea', localized: true },
        { name: 'content_warning', type: 'textarea', localized: true },
      ],
    },
    scheduleField(),
    registrationField(),
    pricingField({
      name: 'pricing_override',
      label: 'Price override',
      dbName: 'course_price',
    }),
    {
      // Unnamed: `sessions` must stay top-level, because the schedule's
      // end-date hook reads `data.sessions` (plan 2).
      label: 'Syllabus',
      type: 'collapsible',
      fields: [
        {
          name: 'sessions',
          type: 'array',
          labels: { singular: 'Session', plural: 'Sessions' },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'order', type: 'number', admin: { width: '15%' } },
                {
                  name: 'session_title',
                  type: 'text',
                  localized: true,
                  admin: { width: '55%' },
                },
                {
                  name: 'meetings',
                  type: 'number',
                  min: 0,
                  admin: { width: '15%', description: 'Default: one week of slots.' },
                },
                { name: 'cancelled', type: 'checkbox', admin: { width: '15%' } },
              ],
            },
            { name: 'description', type: 'richText', localized: true },
            {
              name: 'dates',
              type: 'array',
              admin: {
                description:
                  "Only when this session's dates differ from the schedule. These replace them.",
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'date',
                      type: 'date',
                      required: true,
                      admin: { width: '40%', date: { pickerAppearance: 'dayOnly' } },
                    },
                    ...timeRangeFields('30%'),
                  ],
                },
              ],
            },
            bibliographyField(),
            {
              name: 'activities',
              type: 'array',
              fields: [
                {
                  name: 'kind',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Discussion', value: 'discussion' },
                    { label: 'Field visit', value: 'field_visit' },
                    { label: 'Exercise', value: 'exercise' },
                    { label: 'Screening', value: 'screening' },
                    { label: 'Presentation', value: 'presentation' },
                    { label: 'Other', value: 'other' },
                  ],
                },
                { name: 'description', type: 'textarea', localized: true },
              ],
            },
          ],
        },
        bibliographyField('Course bibliography (all sessions)'),
      ],
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
      name: 'teaching_languages',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Arabic', value: 'ar' },
        { label: 'English', value: 'en' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'language_note',
      type: 'text',
      localized: true,
      admin: { position: 'sidebar', placeholder: 'Readings in Arabic, discussion in either' },
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
      name: 'syllabus_tentative',
      type: 'checkbox',
      label: 'Syllabus may change',
      admin: { position: 'sidebar' },
    },
    {
      // The label sessions get: "Week 3" or "Session 3".
      name: 'session_unit',
      type: 'select',
      required: true,
      defaultValue: 'session',
      options: [
        { label: 'Session', value: 'session' },
        { label: 'Week', value: 'week' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'enrollments',
      type: 'join',
      collection: 'enrollments',
      on: 'course',
      admin: { allowCreate: true, defaultColumns: ['person', 'status', 'slot'] },
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
