import { copyRegistrationTemplate, templateFormHelp } from '@/forms/templates'
import { tierField } from '@/fields/tier'
import { previewUrl } from '@/lib/preview-url'
import { courseDeleteSummary, deleteCourseDependents } from '@/lib/course-delete'
import { courseDays } from '@/lib/course-days'
import { WEEKDAYS } from '@/lib/cairo-day'
import { blockedUnless, deleteEndpoints } from '@/forms/delete-endpoints'
import { addSelfAs } from '@/lib/review-ownership'
import {
  adminPublishes,
  adminWrites,
  isAdminUser,
  canTeach,
  isAdminOrOwn,
  ownList,
  nobody,
  OWNER_DELETE,
  OWNER_EDITS,
  ownsViaFellows,
  readTiers,
} from '@/access'
import { activitiesField } from '@/fields/activities'
import { bibliographyField } from '@/fields/bibliography'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { LOCATION_OPTIONS, TEACHING_LANGUAGE_OPTIONS } from '@/fields/course-options'
import { contributionField } from '@/fields/pricing'
import { validateCourseDestination, registrationDestinationFields } from '@/fields/registration'
import { isPublishing } from '@/lib/course-registration'
import { courseQuestionBlocks, nameNewQuestions } from '@/forms/form-fields'
import { timeRangeFields } from '@/fields/schedule'
import { reviewFields } from '@/fields/review'
import { slugField } from '@/fields/slug'
import { grantFellow, publishedCourse, revokeIfUnteaching, toPersonIds } from '@/lib/fellow-role'
import { lockRow } from '@/lib/row-lock'
import { reviewHooks } from '@/lib/review-hooks'
import { ensureSpaceFor } from '@/lib/space-hooks'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
  Condition,
  Field,
  PayloadRequest,
  RequestContext,
} from 'payload'
import { ValidationError } from 'payload'
import type { Course } from '@/payload-types'
import { importFields } from '@/fields/import'
import { deleteOwnedSpaces } from '@/lib/space-delete'
import {
  recordRevalidationDraft,
  revalidateAfterChange,
  revalidateAfterDelete,
} from '@/lib/revalidate'
import { lastEditedByField, stampLastEditor } from '@/fields/last-edited-by'

const WORKSHOP_FORM_HELP = templateFormHelp('workshop template')

const publishedFellows = async (req: PayloadRequest, id: number): Promise<number[]> => {
  const published = await req.payload.db.findOne<Course>({
    collection: 'courses',
    req,
    select: { fellows: true },
    where: { and: [{ id: { equals: id } }, publishedCourse] },
  })
  return toPersonIds(published?.fellows)
}

const FELLOWS_BEFORE = 'publishedFellowsBefore'
type FellowsBefore = Map<number, number[]>

/**
 * The baseline rides in the request context as a value. Neither the request
 * (a version restore hands each hook a different proxy) nor the context object
 * (a nested Local API call swaps it for a copy) keeps its identity between
 * beforeChange and afterChange, but a copy keeps the entries.
 */
const baselineIn = (context: RequestContext) =>
  (context[FELLOWS_BEFORE] ??= new Map()) as FellowsBefore

/** Capture the live row before both ordinary edits and version restores. */
const capturePublishedFellows: CollectionBeforeChangeHook<Course> = async ({
  context,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || !originalDoc) return
  const id = originalDoc.id
  // A concurrent write must capture the publication this write leaves behind.
  await lockRow(req, 'courses', id)
  baselineIn(context).set(id, await publishedFellows(req, id))
}

/** Accounts follow the main row, which changes independently of the draft history. */
export const propagateFellowRole: CollectionAfterChangeHook<Course> = async ({
  context,
  doc,
  operation,
  req,
}) => {
  const baseline = baselineIn(context)
  const before = operation === 'update' ? (baseline.get(doc.id) ?? []) : []
  baseline.delete(doc.id)
  const after = await publishedFellows(req, doc.id)

  for (const id of after) {
    if (doc._status === 'published' || !before.includes(id)) await grantFellow(req, id)
  }
  for (const id of before) {
    if (!after.includes(id)) await revokeIfUnteaching(req, id, doc.id)
  }
  return doc
}

/** A fellow submits a course; an admin approves (publishes) it, asks for changes or declines. */
const courseNoun = 'course' as const
const courseReview = reviewHooks(courseNoun)

const shownToAdmins = ((_, __, { user }) => isAdminUser(user)) satisfies Condition

const showApplicantQuestions = (data: Partial<Course>) =>
  !(data.registration?.mode === 'own' && data.registration?.method === 'external')

/** afterChange never fires for a delete, so revocation needs its own hook. */
export const revokeDeletedCourseFellows: CollectionAfterDeleteHook<Course> = async ({
  doc,
  req,
}) => {
  if (doc._status === 'published') {
    for (const id of toPersonIds(doc.fellows)) await revokeIfUnteaching(req, id, doc.id)
  }

  return doc
}

/** Who reads a course; its sessions follow it (collections/Sessions.ts). */
export const readCourse = readTiers(ownsViaFellows, { drafts: true })

/**
 * Who may delete a course: an admin, or a fellow their own never-published
 * course, while it is a draft, sent back for changes, or declined.
 */
const deleteCourse = isAdminOrOwn(ownsViaFellows, {
  allow: ['fellow'],
  draft: true,
  while: OWNER_DELETE,
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
    delete: nobody,
  },
  endpoints: deleteEndpoints('courses', {
    summarize: courseDeleteSummary,
    blocked: blockedUnless(
      'courses',
      deleteCourse,
      'You can delete only your own draft or declined courses.',
    ),
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
            adminWrites({
              name: 'cycle',
              label: 'Cycle',
              type: 'relationship',
              relationTo: 'cycles',
            }),
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
              name: 'calendar',
              type: 'ui',
              admin: {
                components: {
                  Field: '/components/admin/course-calendar-field#CourseCalendarField',
                },
              },
            },
            {
              // Not `sessions`: the old array still holds that name until it is removed.
              name: 'syllabus',
              type: 'join',
              collection: 'sessions',
              on: 'course',
              defaultLimit: 0,
              // The order they were planned in; the page orders them by their meetings.
              defaultSort: 'position',
              label: 'Sessions',
              admin: {
                allowCreate: true,
                defaultColumns: ['title', 'cancelled', 'updatedAt'],
              },
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
            {
              // The old pattern (ADR 0011). Hidden like the old array above, and
              // frozen: no hook works out its end date any more.
              name: 'schedule',
              type: 'group',
              admin: { hidden: true, readOnly: true },
              fields: [
                { name: 'start_date', type: 'date' },
                {
                  name: 'start_precision',
                  type: 'select',
                  defaultValue: 'day',
                  options: ['day', 'week'],
                },
                { name: 'weeks', type: 'number' },
                {
                  name: 'slots',
                  type: 'array',
                  fields: [
                    { name: 'weekday', type: 'select', required: true, options: [...WEEKDAYS] },
                    ...timeRangeFields(),
                  ],
                },
                { name: 'end_date', type: 'date' },
                { name: 'note', type: 'textarea', localized: true },
              ],
            },
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
                condition: shownToAdmins,
                components: { Field: '/components/admin/course-settings#CourseSettings' },
              },
            },
            adminWrites({
              name: 'registration',
              type: 'group',
              admin: { condition: shownToAdmins },
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
            }),
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
            adminWrites({
              ...contributionField({
                name: 'pricing_override',
                label: 'Contribution override',
                dbName: 'course_price',
              }),
              admin: {
                condition: shownToAdmins,
                description:
                  'Leave options empty to use the contribution for this course type from its cycle.',
              },
            }),
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
    beforeOperation: [...courseReview.beforeOperation, recordRevalidationDraft],
    beforeValidate: [
      addSelfAs('fellows'),
      copyRegistrationTemplate(
        'workshop_template',
        (course) => course.registration?.mode === 'own',
      ),
    ],
    beforeChange: [
      capturePublishedFellows,
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
        ...(await courseDays(req, originalDoc?.id ?? null)),
      }),
    ],
    afterChange: [
      ...courseReview.afterChange,
      propagateFellowRole,
      revalidateAfterChange('courses'),
      ensureSpaceFor('course'),
    ],
    beforeDelete: [deleteOwnedSpaces('course'), deleteCourseDependents],
    afterDelete: [revokeDeletedCourseFellows, revalidateAfterDelete('courses')],
  },
}
