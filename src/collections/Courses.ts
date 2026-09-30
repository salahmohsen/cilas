import {
  canSetStatus,
  isAdmin,
  isAdminOrListedAsFellow,
  isAdminOrSuperAdminOrFellow,
  ownsViaFellows,
  readTiers,
} from '@/access'
import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'
import type { Course } from '@/payload-types'

/** `fellows` arrives as ids, or as populated users when depth > 0. */
const toIds = (fellows: Course['fellows'] | undefined): number[] =>
  (fellows ?? [])
    .map((fellow) => (typeof fellow === 'object' ? fellow.id : fellow))
    .filter((id): id is number => typeof id === 'number')

/**
 * Being listed in `courses.fellows` should make someone a fellow, and being
 * removed should take it away — but only once they are off every course. The
 * relationship stores ids, so nothing propagates the role by itself.
 *
 * This has to touch the `users` documents explicitly; rewriting the course's own
 * `fellows` field would not. `afterChange` rather than `beforeChange` so users
 * are only updated once the course write has actually landed.
 */
export const propagateFellowRole: CollectionAfterChangeHook<Course> = async ({
  doc,
  req,
  previousDoc,
}) => {
  const { payload } = req

  const added = toIds(doc.fellows).filter((id) => !toIds(previousDoc?.fellows).includes(id))
  const removed = toIds(previousDoc?.fellows).filter((id) => !toIds(doc.fellows).includes(id))

  for (const id of added) {
    const user = await payload.findByID({
      collection: 'users',
      id,
      depth: 0,
      overrideAccess: true,
    })

    // Idempotent, and additive: never drops a role the user already holds.
    if (user.roles.includes('fellow')) continue

    await payload.update({
      collection: 'users',
      id,
      data: { roles: [...user.roles, 'fellow'] },
      // `users.update` is admin-only, so this system-side write must override.
      overrideAccess: true,
    })
  }

  for (const id of removed) {
    // They keep the role while they are still listed on any other course,
    // whatever its status — teaching one course is what makes someone a fellow.
    const elsewhere = await payload.find({
      collection: 'courses',
      where: {
        and: [{ fellows: { contains: id } }, { id: { not_equals: doc.id } }],
      },
      limit: 1,
      depth: 0,
      // Courses.read is tiered by status and ownership; this check must not be
      // filtered by whoever happens to be saving the course.
      overrideAccess: true,
    })

    if (elsewhere.totalDocs > 0) continue

    const user = await payload.findByID({
      collection: 'users',
      id,
      depth: 0,
      overrideAccess: true,
    })

    if (!user.roles.includes('fellow')) continue

    const roles = user.roles.filter((role) => role !== 'fellow')

    await payload.update({
      collection: 'users',
      id,
      // `roles` is required, so someone whose only role was fellow falls back to
      // the collection default rather than failing validation on an empty array.
      data: { roles: roles.length > 0 ? roles : ['ciliasian'] },
      overrideAccess: true,
    })
  }

  return doc
}

export const Courses: CollectionConfig = {
  slug: 'courses',
  access: {
    read: readTiers(ownsViaFellows),
    create: isAdminOrSuperAdminOrFellow,
    update: isAdminOrListedAsFellow,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      required: true,
      options: [
        { label: 'Draft', value: 'draft' }, // owner only
        { label: 'Community', value: 'community' }, // signed-in members only
        { label: 'Public', value: 'public' }, // world
      ],
      // Admin-only on create *and* update, so a fellow's course keeps the
      // `draft` default and promoting it stays an admin action.
      access: { create: canSetStatus, update: canSetStatus },
    },
    {
      name: 'course_type',
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
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'subtitle', type: 'text', localized: true },
    { name: 'description', type: 'richText', localized: true },
    { name: 'epigraph', type: 'text', localized: true }, // "food for thought" quote,
    {
      name: 'learning_outcomes',
      type: 'array',
      localized: true,
      fields: [{ name: 'outcome', type: 'richText' }],
    },
    {
      name: 'bibliography',
      type: 'array',
      localized: true,
      fields: [{ name: 'citation', type: 'text' }],
    },
    {
      name: 'why_apply',
      type: 'array',
      localized: true,
      fields: [{ name: 'point', type: 'text' }],
    },
    { name: 'weekly_workload', type: 'richText', localized: true }, // "what to expect"
    {
      name: 'mode_note',
      type: 'text',
      admin: {
        position: 'sidebar',
      },
    }, // "in person or on Zoom",
    {
      name: 'fields_of_study',
      type: 'relationship',
      relationTo: 'fields-of-study',
      hasMany: true,
      admin: {
        condition: (data) => ['CORE', 'THEMATIC'].includes(data.course_type),
        position: 'sidebar',
      },
    },
    {
      name: 'cycle',
      type: 'relationship',
      relationTo: 'cycles',
      admin: {
        position: 'sidebar',
      },
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
      name: 'schedule',
      type: 'group',
      admin: {
        position: 'sidebar',
      },
      fields: [
        { name: 'session_count', type: 'number', required: true },
        { name: 'first_session_date', type: 'date', required: true },
        {
          name: 'Days',
          type: 'array',
          fields: [
            {
              name: 'days_of_week',
              type: 'select',
              required: true,
              options: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => ({
                label: d,
                value: d,
              })),
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'start_time',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm:ss a',
                    },
                  },
                  required: true,
                },
                {
                  name: 'end_time',
                  type: 'date',
                  admin: {
                    width: '50%',
                    date: {
                      pickerAppearance: 'timeOnly',
                      displayFormat: 'h:mm:ss a',
                    },
                  },
                  required: true,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'tuition',
      type: 'group',
      fields: [
        { name: 'amount', type: 'number' },
        { name: 'need_based', type: 'checkbox', label: 'Need-based deductions available' },
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
      name: 'sessions',
      type: 'array',
      label: 'Syllabus (session-by-session)',
      fields: [
        { name: 'order', type: 'number' }, // sort key
        { name: 'week', type: 'text' }, // "Week 1", "2&3", "9–10 (optional)" — text, not integer
        { name: 'theme', type: 'text', localized: true },
        { name: 'description', type: 'richText', localized: true },
        { name: 'activity', type: 'text', localized: true }, // "Field visit", "Guest lecture", "Screening"
        {
          name: 'materials',
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
                { label: 'Sit with', value: 'sit_with' },
                { label: 'Case study', value: 'case_study' },
                { label: 'Prompt', value: 'prompt' },
                { label: 'Lecture', value: 'lecture' },
                { label: 'Link', value: 'link' },
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
  admin: {
    useAsTitle: 'title',
  },
  hooks: {
    afterChange: [propagateFellowRole],
  },
}
