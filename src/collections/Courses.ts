import { copyRegistrationTemplate } from '@/forms/templates'
import { tierField } from '@/fields/tier'
import { previewUrl } from '@/lib/preview-url'
import { addSelfAs } from '@/lib/review-ownership'
import {
  adminPublishes,
  adminOnlyField,
  isAdminUser,
  canTeach,
  isAdminOrOwn,
  ownList,
  OWNER_EDITS,
  ownsViaFellows,
  readTiers,
  WITH_OWNER,
} from '@/access'
import { bibliographyField } from '@/fields/bibliography'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import {
  LOCATION_OPTIONS,
  SESSION_UNIT_OPTIONS,
  TEACHING_LANGUAGE_OPTIONS,
} from '@/fields/course-options'
import { contributionField } from '@/fields/pricing'
import { validateCourseDestination, registrationDestinationFields } from '@/fields/registration'
import { isPublishing } from '@/lib/course-registration'
import { courseQuestionBlocks } from '@/forms/form-fields'
import { scheduleField, timeRangeFields } from '@/fields/schedule'
import { reviewFields } from '@/fields/review'
import { slugField } from '@/fields/slug'
import { grantFellow, revokeIfUnteaching, toPersonIds } from '@/lib/fellow-role'
import { reviewHooks } from '@/lib/review-hooks'
import { announceScheduleChanges } from '@/lib/schedule-notice'
import { ensureSpaceFor } from '@/lib/space-hooks'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  Condition,
} from 'payload'
import { ValidationError } from 'payload'
import type { Course } from '@/payload-types'
import { importFields } from '@/fields/import'
import { deleteOwnedSpaces } from '@/lib/space-delete'
import { revalidateAfterChange, revalidateAfterDelete } from '@/lib/revalidate'
import { lastEditedByField, stampLastEditor } from '@/fields/last-edited-by'

/**
 * `courses.fellows` lists people, but the `fellow` role lives on the account
 * linked to each person, so granting and revoking means writing to `users` —
 * the course's own field cannot do it. afterChange, not beforeChange, so
 * accounts are only touched once the course write has landed. Granting waits
 * for the course to be published, so a draft cannot make anyone a fellow.
 */
export const propagateFellowRole: CollectionAfterChangeHook<Course> = async ({
  doc,
  req,
  previousDoc,
}) => {
  const before = toPersonIds(previousDoc?.fellows)
  const after = toPersonIds(doc.fellows)

  // The role follows publication: a fellow may list a co-fellow on a draft,
  // but only an admin's approval makes that person a fellow. On publishing,
  // everyone listed gets it; on a published course, whoever is added.
  if (doc._status === 'published') {
    const justPublished = previousDoc?._status !== 'published'
    for (const id of justPublished ? after : after.filter((id) => !before.includes(id))) {
      await grantFellow(req.payload, id)
    }
  }

  for (const id of before.filter((id) => !after.includes(id))) {
    await revokeIfUnteaching(req.payload, id, doc.id)
  }

  return doc
}

/** A fellow submits a course; an admin approves (publishes) it, asks for changes or declines. */
const courseNoun = 'course' as const
const courseReview = reviewHooks(courseNoun)

const adminSettings = {
  access: { create: adminOnlyField, update: adminOnlyField },
  admin: {
    condition: ((_, __, { user }) => isAdminUser(user)) satisfies Condition,
  },
}

const showApplicantQuestions = (data: Partial<Course>) =>
  !(data.registration?.mode === 'own' && data.registration?.method === 'external')

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
    readVersions: isAdminOrOwn(ownsViaFellows, { versions: true }),
    // A fellow saves drafts; an admin approves a course by publishing it.
    create: adminPublishes(canTeach),
    // A fellow edits while the course is with them; submitted, it waits for the
    // admin. Published, their edits are a draft for review beside it.
    update: adminPublishes(isAdminOrOwn(ownsViaFellows, { allow: ['fellow'], while: OWNER_EDITS })),
    delete: isAdminOrOwn(ownsViaFellows, { allow: ['fellow'], draft: true, while: WITH_OWNER }),
  },
  versions: {
    drafts: {
      autosave: {
        interval: 2000,
        // A fellow cannot publish, so without it they would see no button at all.
        showSaveDraftButton: true,
      },
    },
  },
  fields: [
    {
      name: 'applicants',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '/components/admin/applicants#CourseApplicants' },
      },
    },
    {
      name: 'fullFormPreview',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '/components/admin/full-form-preview#FullFormPreview' },
      },
    },
    lastEditedByField,
    {
      label: 'Review',
      type: 'collapsible',
      admin: { position: 'sidebar' },
      fields: reviewFields(courseNoun),
    },
    tierField({
      sidebar: true,
      description:
        'Who sees it: Public (everyone), Community (signed-in members) or Owner only (its fellows and admins). A published course also needs a tier above Owner, else its public page disappears.',
    }),
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
    ...importFields(),
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Overview',
          fields: [
            {
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
              name: 'fellows',
              type: 'relationship',
              relationTo: 'people',
              hasMany: true,
              admin: {
                description: 'Who teaches it. Each gets the Fellow role on their linked account.',
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
              },
            },
            {
              name: 'cycle',
              label: 'Cycle',
              type: 'relationship',
              relationTo: 'cycles',
              access: { create: adminOnlyField, update: adminOnlyField },
              admin: { components: { Field: '/components/admin/course-cycle#CourseCycle' } },
            },
            {
              name: 'location',
              type: 'select',
              hasMany: true,
              options: [...LOCATION_OPTIONS],
              admin: {
                description: 'Offline (in person), Online, or Hybrid (both at once).',
              },
            },
            {
              name: 'teaching_languages',
              type: 'select',
              hasMany: true,
              options: [...TEACHING_LANGUAGE_OPTIONS],
              admin: {
                description:
                  'Languages the course is taught in. Mixed use goes in the language note.',
              },
            },
            {
              name: 'language_note',
              type: 'text',
              localized: true,
              admin: {
                description:
                  'Only when languages mix, e.g. “Readings in Arabic, discussion in either.”',
                placeholder: 'Readings in Arabic, discussion in either',
              },
            },
          ],
        },
        {
          label: 'Course flow',
          fields: [
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
                          label: 'Session title',
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
                    {
                      name: 'delivery',
                      type: 'select',
                      options: [...LOCATION_OPTIONS],
                      admin: {
                        description:
                          'How this session meets. Leave empty to follow the course location.',
                      },
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
            {
              name: 'syllabus_tentative',
              type: 'checkbox',
              label: 'Syllabus may change',
              admin: {
                description:
                  'Tick when the fellow may still change the sessions; the page says the syllabus may change.',
              },
            },
            {
              name: 'session_unit',
              type: 'select',
              required: true,
              defaultValue: 'session',
              options: [...SESSION_UNIT_OPTIONS],
              admin: {
                description: 'How sessions are numbered on the page: “Week 3” or “Session 3”.',
              },
            },
          ],
        },
        { label: 'Schedule', fields: [scheduleField()] },
        {
          label: 'Applications and contribution',
          admin: {
            condition: (data, _, { user }) => isAdminUser(user) || showApplicantQuestions(data),
          },
          fields: [
            {
              name: 'effective_settings',
              type: 'ui',
              admin: {
                ...adminSettings.admin,
                components: { Field: '/components/admin/course-settings#CourseSettings' },
              },
            },
            {
              name: 'registration',
              type: 'group',
              ...adminSettings,
              hooks: { beforeChange: [validateCourseDestination] },
              fields: [
                {
                  name: 'mode',
                  type: 'select',
                  required: true,
                  defaultValue: 'follow_cycle',
                  options: [
                    { label: 'Follow cycle form', value: 'follow_cycle' },
                    { label: 'Own registration', value: 'own' },
                    { label: 'Closed', value: 'closed' },
                  ],
                },
                {
                  name: 'close_early',
                  type: 'date',
                  admin: {
                    condition: (_, sibling) => sibling?.mode === 'follow_cycle',
                    date: { pickerAppearance: 'dayOnly' },
                    description: 'The last day to register, in Cairo.',
                  },
                },
                ...registrationDestinationFields(true),
              ],
            },
            {
              name: 'applicant_questions',
              label: 'Questions for applicants',
              type: 'blocks',
              blocks: courseQuestionBlocks(),
              labels: { singular: 'Question', plural: 'Questions' },
              admin: {
                condition: showApplicantQuestions,
                description:
                  'Extra questions for this course, asked after the website form’s own. They go live when an admin publishes the course. Not used when applications go to an external link, such as a Google Form.',
              },
            },
            {
              ...contributionField({
                name: 'pricing_override',
                label: 'Contribution override',
                dbName: 'course_price',
              }),
              ...adminSettings,
              admin: {
                ...adminSettings.admin,
                description:
                  'Leave options empty to use the contribution for this course type from its cycle.',
              },
            },
          ],
        },
        {
          label: 'Participants',
          fields: [
            {
              name: 'enrollments',
              type: 'join',
              collection: 'enrollments',
              on: 'course',
              admin: { allowCreate: true, defaultColumns: ['person', 'status', 'slot'] },
            },
          ],
        },
      ],
    },
  ],

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'cycle', 'course_type', 'review.status', 'tier'],
    // A fellow lists the courses they teach, not every public one.
    baseFilter: ownList(ownsViaFellows),
    // The admin iframe loads this URL directly, so it must go through
    // /api/preview rather than the page itself: that route authenticates the
    // editor, enables draft mode, and only then redirects to the course, which
    // is what lets the page render an unpublished draft.
    livePreview: {
      url: previewUrl('courses'),
    },
  },
  hooks: {
    beforeOperation: courseReview.beforeOperation,
    beforeValidate: [addSelfAs('fellows'), copyRegistrationTemplate],
    beforeChange: [
      ...(courseReview.beforeChange ?? []),
      ({ data, originalDoc }) => {
        const cycle = data.cycle === undefined ? originalDoc?.cycle : data.cycle
        if (!cycle && isPublishing(data)) {
          throw new ValidationError({
            errors: [{ path: 'cycle', message: 'Choose a cycle before approving or publishing.' }],
          })
        }
        return data
      },
      stampLastEditor,
    ],
    afterChange: [
      ...courseReview.afterChange,
      propagateFellowRole,
      revalidateAfterChange('courses'),
      ensureSpaceFor('course'),
      announceScheduleChanges,
    ],
    beforeDelete: [deleteOwnedSpaces('course')],
    afterDelete: [revokeDeletedCourseFellows, revalidateAfterDelete('courses')],
  },
}
