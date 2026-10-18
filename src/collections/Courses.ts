import {
  adminPublishes,
  canSetTier,
  isAdminOrOwnAndDraft,
  isAdminOrOwnVersions,
  isAdminOrSuperAdminOrFellow,
  ownList,
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
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload'
import type { Course } from '@/payload-types'
import { importFields } from '@/fields/import'
import {
  revalidateCoursesAfterChange,
  revalidateCoursesAfterDelete,
} from '@/lib/revalidate-courses'

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
    // A fellow saves drafts; an admin approves a course by publishing it.
    create: adminPublishes(isAdminOrSuperAdminOrFellow),
    update: adminPublishes(isAdminOrOwnAndDraft(ownsViaFellows, { allow: ['fellow'] })),
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
        description:
          'Who sees it: Public (everyone), Community (signed-in members) or Owner only (its fellows and admins).',
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
        description:
          'Core, Thematic and Lab courses count toward the Bridge; Workshop and Short courses do not.',
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
        {
          name: 'subtitle',
          type: 'text',
          localized: true,
          admin: {
            description:
              'A second line under the title, e.g. “An introduction to translation studies”.',
          },
        },
        {
          name: 'summary',
          type: 'text',
          localized: true,
          admin: {
            description:
              'One line for cards and search results, e.g. “Reading Plato’s Republic in Cairo, book by book.” Leave empty to use the description’s start.',
          },
        },
        {
          name: 'epigraph',
          type: 'text',
          localized: true,
          admin: {
            description:
              'A short quote or question shown before the description, e.g. “What does a city remember?”',
          },
        },
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
        {
          name: 'facilitator_note',
          type: 'textarea',
          localized: true,
          admin: {
            description:
              'The fellow’s practical notes to participants: what to bring, how work is assessed, e.g. “Bring an apron; all chemicals are provided.”',
          },
        },
        {
          name: 'content_warning',
          type: 'textarea',
          localized: true,
          admin: {
            description:
              'Sensitive material participants should know about beforehand, e.g. “Discusses sexual violence.”',
          },
        },
      ],
    },
    scheduleField(),
    registrationField(),
    pricingField({
      name: 'pricing_override',
      label: 'Price override',
      dbName: 'course_price',
      description: 'Only when this course costs something other than its cycle’s price.',
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
                {
                  name: 'order',
                  type: 'number',
                  admin: { description: 'Its number in the flow: 1, 2, 3…', width: '15%' },
                },
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
                {
                  name: 'cancelled',
                  type: 'checkbox',
                  admin: {
                    description:
                      'The session will not take place: marked as cancelled on the page and left off the calendar.',
                    width: '15%',
                  },
                },
              ],
            },
            { name: 'description', type: 'richText', localized: true },
            {
              name: 'dates',
              type: 'array',
              admin: {
                initCollapsed: true,
                description:
                  'Only for a session off the weekly schedule, e.g. a 5-day workshop at changing hours. These dates replace the schedule’s for this session.',
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
        description: 'Offline (in person), Online, or Hybrid (both at once).',
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
      admin: {
        description: 'Languages the course is taught in. Mixed use goes in the language note.',
        position: 'sidebar',
      },
    },
    {
      name: 'language_note',
      type: 'text',
      localized: true,
      admin: {
        description: 'Only when languages mix, e.g. “Readings in Arabic, discussion in either.”',
        position: 'sidebar',
        placeholder: 'Readings in Arabic, discussion in either',
      },
    },
    {
      name: 'fellows',
      type: 'relationship',
      relationTo: 'people',
      hasMany: true,
      admin: {
        description: 'Who teaches it. Each gets the Fellow role on their linked account.',
        position: 'sidebar',
      },
    },
    {
      name: 'syllabus_tentative',
      type: 'checkbox',
      label: 'Syllabus may change',
      admin: {
        description:
          'Tick when the fellow may still change the sessions; the page says the syllabus may change.',
        position: 'sidebar',
      },
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
      admin: {
        description: 'How sessions are numbered on the page: “Week 3” or “Session 3”.',
        position: 'sidebar',
      },
    },
    {
      name: 'enrollments',
      type: 'join',
      collection: 'enrollments',
      on: 'course',
      admin: { allowCreate: true, defaultColumns: ['person', 'status', 'slot'] },
    },
    ...importFields(),
  ],

  admin: {
    useAsTitle: 'title',
    // A fellow lists the courses they teach, not every public one.
    baseFilter: ownList(ownsViaFellows),
    // The admin iframe loads this URL directly, so it must go through
    // /api/preview rather than the page itself: that route authenticates the
    // editor, enables draft mode, and only then redirects to the course, which
    // is what lets the page render an unpublished draft.
    livePreview: {
      url: ({ data }) => `/api/preview?collection=courses&slug=${data?.slug ?? ''}`,
    },
  },
  hooks: {
    afterChange: [propagateFellowRole, revalidateCoursesAfterChange],
    afterDelete: [revokeDeletedCourseFellows, revalidateCoursesAfterDelete],
  },
}
