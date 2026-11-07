import { relId } from '@/lib/relation'
import type { Payload, Where } from 'payload'

import type { Contact } from '@/lib/resend-contacts'

/** Who a synced mailing list holds: every account that matches any line. */
export type MembersRule = {
  everyone?: boolean | null
  roles?: string[] | null
  courses?: Array<number | { id: number }> | null
  course_people?: Array<'students' | 'fellows'> | null
  programmes?: Array<number | { id: number }> | null
  users?: Array<number | { id: number }> | null
}

/** Enrollments that made it into the course; an application or a withdrawal does not. */
export const ENROLLED = ['accepted', 'confirmed', 'completed'] as const

const ids = (values: Array<number | { id: number }> | null | undefined) =>
  (values ?? []).map((v) => relId(v))

const personId = (p: unknown) => relId(p) as number | null

/** The people a rule reaches through courses and programmes. */
const peopleOf = async (payload: Payload, rule: MembersRule): Promise<number[]> => {
  const people = new Set<number>()
  const courses = ids(rule.courses)
  const who = rule.course_people?.length ? rule.course_people : ['students', 'fellows']
  if (courses.length && who.includes('fellows')) {
    const { docs } = await payload.find({
      collection: 'courses',
      where: { id: { in: courses } },
      select: { fellows: true },
      depth: 0,
      pagination: false,
      draft: true,
      overrideAccess: true,
    })
    for (const c of docs) for (const f of c.fellows ?? []) people.add(personId(f)!)
  }
  if (courses.length && who.includes('students')) {
    const { docs } = await payload.find({
      collection: 'enrollments',
      where: { and: [{ course: { in: courses } }, { status: { in: [...ENROLLED] } }] },
      select: { person: true },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    for (const e of docs) people.add(personId(e.person)!)
  }
  const programmes = ids(rule.programmes)
  if (programmes.length) {
    const { docs } = await payload.find({
      collection: 'memberships',
      where: { programme: { in: programmes } },
      select: { person: true },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    for (const m of docs) people.add(personId(m.person)!)
  }
  people.delete(null as unknown as number)
  return [...people]
}

/**
 * The addresses a synced list should hold: the accounts of everyone the rule
 * reaches, lower-cased, each once. People without an account are left out:
 * their address is not CILAS's to mail.
 */
export const memberEmails = async (payload: Payload, rule: MembersRule): Promise<string[]> => {
  const any: Where[] = []
  if (rule.everyone) any.push({ id: { exists: true } })
  if (rule.roles?.length) any.push({ roles: { in: rule.roles } })
  const users = ids(rule.users)
  if (users.length) any.push({ id: { in: users } })
  const people = await peopleOf(payload, rule)
  if (people.length) any.push({ person: { in: people } })
  if (!any.length) return []
  const { docs } = await payload.find({
    collection: 'users',
    where: { or: any },
    select: { email: true },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return [
    ...new Set(
      docs.map((u) => u.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e)),
    ),
  ].sort()
}

/** What a sync changes: who joins the segment and who leaves it. */
export const segmentDiff = (wanted: string[], current: Pick<Contact, 'email'>[]) => {
  const want = new Set(wanted.map((e) => e.toLowerCase()))
  const have = new Set(current.map((c) => c.email.toLowerCase()))
  return {
    add: [...want].filter((e) => !have.has(e)),
    remove: [...have].filter((e) => !want.has(e)),
  }
}
