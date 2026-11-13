import type {
  Access,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload'

import {
  adminOnlyField,
  isAdmin,
  isAdminOrOwn,
  isAdminUser,
  isFellowUser,
  ownsViaFellows,
  throughRelation,
} from '@/access'
import { readCourse } from '@/collections/Courses'
import { activitiesField } from '@/fields/activities'
import { bibliographyField } from '@/fields/bibliography'
import { LOCATION_OPTIONS } from '@/fields/course-options'
import { meetingsField } from '@/fields/meetings'
import { storeCourseDays } from '@/lib/course-days'
import { relId } from '@/lib/relation'
import type { Session } from '@/payload-types'

/** Admins, and the fellows of the session's course. */
const editsCourse = isAdminOrOwn(ownsViaFellows, { allow: ['fellow'] })

/**
 * Create has no stored session to query, so the course named in the new
 * session is checked here. With no data, Payload is asking whether to show
 * the create button: a fellow may make sessions for the courses they teach.
 */
const createSession: Access = async (args) => {
  const { req, data } = args
  if (isAdminUser(req.user)) return true
  if (!isFellowUser(req.user)) return false
  const course = relId((data as Partial<Session> | undefined)?.course)
  if (course == null) return true
  const owns = await editsCourse(args)
  if (typeof owns === 'boolean') return owns
  const { totalDocs } = await req.payload.count({
    collection: 'courses',
    where: { and: [{ id: { equals: course } }, owns] },
    overrideAccess: true,
    req,
  })
  return totalDocs > 0
}

const courseIdOf = (session: Partial<Session> | null | undefined): number | null => {
  const id = relId(session?.course)
  return typeof id === 'number' ? id : null
}

/** Keeps `first_day` and `last_day` of the course (and of a course it left) current. */
const syncCourseDays: CollectionAfterChangeHook<Session> = async ({ doc, previousDoc, req }) => {
  const courses = new Set([courseIdOf(doc), courseIdOf(previousDoc)])
  for (const course of courses) if (course !== null) await storeCourseDays(req, course)
  return doc
}

const syncCourseDaysAfterDelete: CollectionAfterDeleteHook<Session> = async ({ doc, req }) => {
  const course = courseIdOf(doc)
  if (course !== null) await storeCourseDays(req, course)
  return doc
}

/**
 * What is taught in a course, and when (ADR 0011). Each session holds its own
 * meetings; order, dates and the summary come from them (`lib/meetings.ts`).
 * A session is shown and edited as its course is.
 */
export const Sessions: CollectionConfig = {
  slug: 'sessions',
  access: {
    // A published course's sessions are public; a draft's only to its fellows and admins.
    read: throughRelation('course', readCourse),
    readVersions: isAdmin,
    create: createSession,
    update: throughRelation('course', editsCourse),
    delete: throughRelation('course', editsCourse),
  },
  // History, so an admin can see who changed what and restore it. No drafts:
  // a session is public when its course is.
  versions: true,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'course', 'cancelled'],
  },
  fields: [
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      required: true,
      index: true,
      // Only an admin moves a session to another course.
      access: { update: adminOnlyField },
      admin: { position: 'sidebar' },
    },
    { name: 'title', type: 'text', localized: true },
    {
      name: 'cancelled',
      type: 'checkbox',
      admin: {
        description:
          'The session will not take place: marked as cancelled on the page and left off the calendar.',
      },
    },
    meetingsField(),
    {
      name: 'delivery',
      type: 'select',
      options: [...LOCATION_OPTIONS],
      admin: {
        description: 'How this session meets. Leave empty to follow the course location.',
      },
    },
    {
      // Markdown. The Arc editor replaces this textarea in a later step.
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    bibliographyField(),
    activitiesField(),
    {
      // Orders the sessions that have no meeting; placed ones sort by time.
      name: 'position',
      type: 'number',
      admin: { hidden: true },
    },
  ],
  hooks: {
    afterChange: [syncCourseDays],
    afterDelete: [syncCourseDaysAfterDelete],
  },
}
