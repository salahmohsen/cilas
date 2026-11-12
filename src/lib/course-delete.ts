import type { PayloadRequest } from 'payload'

import { type DeleteGroup, group, nonEmpty } from '@/lib/delete-summary'
import { countSpaceContent, spaceContentGroups } from '@/lib/space-delete'
import { relId } from '@/lib/relation'
import type { FormSubmission } from '@/payload-types'

type Submission = Pick<FormSubmission, 'id' | 'target' | 'choices' | 'submissionData'>

const applicantOf = (s: Submission): string => {
  const answer = (field: string) => s.submissionData?.find((a) => a.field === field)?.value
  return answer('name') || answer('email') || `Application ${s.id}`
}

const choosesCourse = (id: number) => (c: { course: unknown }) => Number(relId(c.course)) === id

/**
 * The applications that name a course, split by what deleting it does to
 * them. An application only for this course (its target, or every choice it
 * makes) is deleted; an application that also chose other courses keeps
 * them and loses this one.
 */
const applicationsFor = async (req: PayloadRequest, id: number) => {
  const { docs } = (await req.payload.find({
    collection: 'form-submissions',
    where: {
      or: [
        {
          and: [{ 'target.relationTo': { equals: 'courses' } }, { 'target.value': { equals: id } }],
        },
        { 'choices.course': { equals: id } },
      ],
    },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
    select: { target: true, choices: true, submissionData: true },
  })) as { docs: Submission[] }
  const only = (s: Submission) =>
    (s.target?.relationTo === 'courses' && Number(relId(s.target.value)) === id) ||
    (s.choices ?? []).every(choosesCourse(id))
  return { deleted: docs.filter(only), trimmed: docs.filter((s) => !only(s)) }
}

const enrollmentsOf = async (req: PayloadRequest, id: number) =>
  (
    await req.payload.find({
      collection: 'enrollments',
      where: { course: { equals: id } },
      depth: 1,
      pagination: false,
      overrideAccess: true,
      req,
      select: { person: true },
      populate: { people: { name: true } },
    })
  ).docs

const titles = async (
  req: PayloadRequest,
  collection: 'events' | 'publications' | 'mailing-lists',
  where: object,
  title: 'title' | 'name',
): Promise<DeleteGroup> => {
  const { docs, totalDocs } = await req.payload.find({
    collection,
    where: where as never,
    depth: 0,
    limit: 8,
    overrideAccess: true,
    req,
    select: { [title]: true },
  })
  const label = collection === 'mailing-lists' ? 'mailing lists' : collection
  return group(
    label,
    totalDocs,
    docs.map((d) => String((d as unknown as Record<string, unknown>)[title] ?? `#${d.id}`)),
  )
}

/** What deleting a course takes with it, for the admin delete dialog. */
export const courseDeleteSummary = async (req: PayloadRequest, id: number) => {
  const course = await req.payload.findByID({
    collection: 'courses',
    id,
    depth: 0,
    draft: true,
    overrideAccess: true,
    req,
    select: { title: true },
  })
  const [enrollments, applications, spaces] = await Promise.all([
    enrollmentsOf(req, id),
    applicationsFor(req, id),
    req.payload.find({
      collection: 'spaces',
      where: { course: { equals: id } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      req,
      select: { display_name: true },
    }),
  ])

  // The course's space goes with it (deleteOwnedSpaces), and all it holds.
  const spaceContent = await Promise.all(
    spaces.docs.map((s) => countSpaceContent(req.payload, s.id, req)),
  )
  const inSpace = spaceContentGroups(
    spaceContent.reduce(
      (sum, c) => ({
        posts: sum.posts + c.posts,
        comments: sum.comments + c.comments,
        files: sum.files + c.files,
        reactions: sum.reactions + c.reactions,
        votes: sum.votes + c.votes,
        rsvps: sum.rsvps + c.rsvps,
      }),
      { posts: 0, comments: 0, files: 0, reactions: 0, votes: 0, rsvps: 0 },
    ),
  ).map((g) => ({ ...g, label: `${g.label} in the course space` }))

  const personName = (e: (typeof enrollments)[number]) =>
    typeof e.person === 'object' && e.person ? String(e.person.name) : `Person ${e.person}`

  return {
    name: (typeof course.title === 'string' && course.title.trim()) || `Course ${id}`,
    noun: 'course',
    deletes: nonEmpty([
      group('enrollments', enrollments.length, enrollments.map(personName)),
      group(
        'applications for this course only',
        applications.deleted.length,
        applications.deleted.map(applicantOf),
      ),
      group(
        'course spaces',
        spaces.docs.length,
        spaces.docs.map((s) => String(s.display_name ?? `Space ${s.id}`)),
      ),
      ...inSpace,
    ]),
    unlinks: nonEmpty([
      group(
        'applications that also chose other courses',
        applications.trimmed.length,
        applications.trimmed.map(applicantOf),
      ),
      await titles(req, 'events', { course: { equals: id } }, 'title'),
      await titles(req, 'publications', { produced_by: { contains: id } }, 'title'),
      await titles(req, 'mailing-lists', { 'members.courses': { contains: id } }, 'name'),
    ]),
  }
}

/**
 * The courses collection's beforeDelete: removes the rows that hold the
 * course with `course_id NOT NULL` and `ON DELETE set null`, which the
 * database would otherwise refuse ("An unknown error has occurred"). Runs in
 * the delete's transaction (`req`). Enrollments and applications only for
 * this course go; other applications lose this course's choice. Rows that
 * may hold no course (events, publications, mailing lists) clear their link
 * in the database.
 */
export const deleteCourseDependents = async ({
  id,
  req,
}: {
  id: number | string
  req: PayloadRequest
}): Promise<void> => {
  const course = Number(id)
  await req.payload.delete({
    collection: 'enrollments',
    where: { course: { equals: course } },
    overrideAccess: true,
    req,
  })
  const { deleted, trimmed } = await applicationsFor(req, course)
  for (const s of deleted)
    await req.payload.delete({
      collection: 'form-submissions',
      id: s.id,
      overrideAccess: true,
      req,
    })
  for (const s of trimmed)
    await req.payload.update({
      collection: 'form-submissions',
      id: s.id,
      data: { choices: (s.choices ?? []).filter((c) => !choosesCourse(course)(c)) },
      overrideAccess: true,
      req,
    })
}
