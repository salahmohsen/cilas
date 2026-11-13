import { copyRegistrationTemplate, templateFormHelp } from '@/forms/templates'
import { tierField } from '@/fields/tier'
import { previewUrl } from '@/lib/preview-url'
import { courseDeleteSummary, deleteCourseDependents } from '@/lib/course-delete'
import { courseDays } from '@/lib/course-days'
import { cairoDay } from '@/lib/cairo-day'
import { blockedUnless, deleteEndpoints } from '@/forms/delete-endpoints'
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
import { activitiesField } from '@/fields/activities'
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
import { courseQuestionBlocks, nameNewQuestions } from '@/forms/form-fields'
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
  Field,
} from 'payload'
import { ValidationError } from 'payload'
import type { Course } from '@/payload-types'
import { importFields } from '@/fields/import'
import { deleteOwnedSpaces } from '@/lib/space-delete'
import { revalidateAfterChange, revalidateAfterDelete } from '@/lib/revalidate'
import { lastEditedByField, stampLastEditor } from '@/fields/last-edited-by'

const WORKSHOP_FORM_HELP = templateFormHelp('workshop template')

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

/** Who reads a course; its sessions follow it (collections/Sessions.ts). */
export const readCourse = readTiers(ownsViaFellows, { drafts: true })

/** Who may delete a course: an admin, or a fellow their own draft. */
const deleteCourse = isAdminOrOwn(ownsViaFellows, {
  allow: ['fellow'],
  draft: true,
  while: WITH_OWNER,
})

export const Courses: CollectionConfig = {
  slug: 'courses',
  access: {
    read: readCourse,
    // Without this, any signed-in account reads drafts via the versions endpoint.
    readVersions: isAdminOrOwn(ownsViaFellows, { versions: true }),
    // A fellow saves drafts; an admin approves a course by publishing it.
    create: adminPublishes(canTeach),
    // A fellow edits while the course is with them; submitted, it waits for the
    // admin. Published, their edits are a draft for review beside it.
    update: adminPublishes(isAdminOrOwn(ownsViaFellows, { allow: ['fellow'], while: OWNER_EDITS })),
    // Closed so the panel's stock delete never shows: a course is deleted
    // through the delete dialog, which lists what goes with it first
    // (src/forms/delete-endpoints.ts).
    delete: () => false,
  },
  endpoints: deleteEndpoints('courses', {
    summarize: courseDeleteSummary,
    blocked: blockedUnless('courses', deleteCourse, 'You can delete only your own draft courses.'),
  }),
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
        condition: (_, __, { user }) => isAdminUser(user),
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
          // ADR 0011: one tab for what is taught and when.
          label: 'Sessions',
          fields: [
            {
              // Not `sessions`: the old array still holds that name until it is removed.
              name: 'syllabus',
              type: 'join',
              collection: 'sessions',
              on: 'course',
              defaultLimit: 0,
              label: 'Sessions',
              admin: {
                allowCreate: true,
                defaultColumns: ['title', 'cancelled', 'updatedAt'],
                description:
                  'What is taught, and when. Open a session to edit its title, meetings and materials; Create new adds one to this course. Sessions save on their own: a change is public at once on a published course.',
              },
            },
            {
              name: 'timing_note',
              type: 'textarea',
              localized: true,
              admin: {
                description:
                  'What the dates cannot say, e.g. "hybrid for the first 6 weeks, then online".',
              },
            },
            {
              name: 'announced',
              type: 'group',
              label: 'Announced timing',
              admin: {
                description:
                  'When the course was announced to start and how long it runs. Used only while no session has a meeting: then the calendar marks its start and lists show its start and weeks. Once a session has a meeting, the meetings say this.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'start_day',
                      type: 'text',
                      validate: (value: string | null | undefined) =>
                        !value || cairoDay(value) === value
                          ? true
                          : 'Use a real day as YYYY-MM-DD, e.g. 2026-03-03.',
                      admin: { width: '50%', placeholder: '2026-03-03' },
                    },
                    {
                      name: 'weeks',
                      type: 'number',
                      min: 1,
                      admin: { width: '50%', step: 1 },
                    },
                  ],
                },
              ],
            },
            bibliographyField('Course bibliography (all sessions)'),
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
            ...(['first_day', 'last_day'] as const).map((name): Field => ({
              name,
              type: 'text',
              index: true,
              // Kept from the sessions' meetings (lib/course-days.ts).
              admin: { readOnly: true, hidden: true },
            })),
            {
              // The old sessions array (ADR 0011). Readers and writers use the
              // sessions collection; the column stays until the last migration.
              name: 'sessions',
              type: 'array',
              labels: { singular: 'Session', plural: 'Sessions' },
              admin: { hidden: true, readOnly: true },
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
                activitiesField(),
              ],
            },
            // The old pattern (ADR 0011). Hidden like the old array above.
            { ...scheduleField(), admin: { hidden: true, readOnly: true } },
          ],
        },
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
              hooks: { beforeChange: [validateCourseDestination(WORKSHOP_FORM_HELP)] },
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
                ...registrationDestinationFields(WORKSHOP_FORM_HELP, true),
              ],
            },
            {
              name: 'applicant_questions',
              label: 'Questions for applicants',
              type: 'blocks',
              blocks: courseQuestionBlocks(),
              hooks: { beforeValidate: [nameNewQuestions] },
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
    components: {
      edit: {
        editMenuItems: [
          {
            path: '/components/admin/delete-dialog#DeleteMenuItem',
            clientProps: { collection: 'courses' },
          },
        ],
      },
    },
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
    beforeValidate: [
      addSelfAs('fellows'),
      copyRegistrationTemplate(
        'workshop_template',
        (course) => course.registration?.mode === 'own',
      ),
    ],
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
      async ({ data, originalDoc, req }) => ({
        ...data,
        ...(await courseDays(
          req,
          originalDoc?.id ?? null,
          data.announced ?? originalDoc?.announced,
        )),
      }),
    ],
    afterChange: [
      ...courseReview.afterChange,
      propagateFellowRole,
      revalidateAfterChange('courses'),
      ensureSpaceFor('course'),
      announceScheduleChanges,
    ],
    beforeDelete: [deleteOwnedSpaces('course'), deleteCourseDependents],
    afterDelete: [revokeDeletedCourseFellows, revalidateAfterDelete('courses')],
  },
}
