import { adminOnlyField } from '@/access'
import { relId } from '@/lib/relation'
import type { Access, CollectionConfig, FieldAccess } from 'payload'

import { isAdmin, isAdminUser, isFellowUser, personOf, readEnrollments } from '@/access'

/** Admins; and a fellow, for the enrollments of the courses they teach. */
const adminOrTeachingFellow: Access = ({ req }) => {
  if (isAdminUser(req.user)) return true
  const person = personOf(req.user)
  return isFellowUser(req.user) && person !== null
    ? { 'course.fellows': { contains: person } }
    : false
}

/** Every field but the assessment is the admin's to change. */

/**
 * The assessment: written and read by admins and the course's fellows (the
 * collection rule limits a fellow to the courses they teach), never by the
 * student it is about.
 */
const assessor: FieldAccess = ({ req, doc }) => {
  if (isAdminUser(req.user)) return true
  if (!isFellowUser(req.user)) return false
  const own = personOf(req.user)
  const about = relId(doc?.person) ?? undefined
  return own !== null && own !== about
}

/**
 * A person's place in one course (CONTEXT.md). Joining a programme's
 * community is a membership instead. The archive has no per-course lists, so
 * enrollments start from now.
 */
export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  admin: {
    defaultColumns: ['person', 'course', 'status', 'slot'],
  },
  access: {
    // A fellow also reads the enrollments in the courses they teach.
    read: readEnrollments,
    create: isAdmin,
    // A fellow writes the assessment; every other field stays the admin's.
    update: adminOrTeachingFellow,
    delete: isAdmin,
  },
  indexes: [{ fields: ['person', 'course'], unique: true }],
  fields: [
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      required: true,
      index: true,
      access: { update: adminOnlyField },
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      required: true,
      index: true,
      access: { update: adminOnlyField },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      access: { update: adminOnlyField },
      defaultValue: 'applied',
      options: [
        { label: 'Applied', value: 'applied' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Confirmed (paid)', value: 'confirmed' },
        { label: 'Completed', value: 'completed' },
        { label: 'Withdrawn', value: 'withdrawn' },
      ],
    },
    {
      name: 'slot',
      type: 'text',
      access: { update: adminOnlyField },
      admin: { description: 'Which group they attend, e.g. "evening".' },
    },
    {
      // Narratives in lieu of grades, written by the course's fellows.
      name: 'assessment',
      type: 'richText',
      localized: true,
      access: { read: assessor, update: assessor },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      access: { update: adminOnlyField },
      defaultValue: 'admin',
      options: [
        { label: 'Registration form', value: 'registration_form' },
        { label: 'Added by an admin', value: 'admin' },
        { label: 'Archive backfill', value: 'backfill' },
      ],
    },
  ],
}
