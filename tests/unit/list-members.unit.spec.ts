import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { memberEmails, segmentDiff } from '@/lib/list-members'

type Where = Record<string, unknown>

const users = [
  { id: 1, email: 'Fellow@cilas.org', roles: ['fellow'], person: 11 },
  { id: 2, email: 'student@cilas.org', roles: ['member'], person: 12 },
  { id: 3, email: 'bridge@cilas.org', roles: ['member'], person: 13 },
  { id: 4, email: 'chosen@cilas.org', roles: ['member'], person: null },
  { id: 5, email: 'other@cilas.org', roles: ['member'], person: 15 },
]

/** Just enough of Payload's find for the rule's queries. */
const payload = {
  find: vi.fn(async ({ collection, where }: { collection: string; where: Where }) => {
    if (collection === 'courses') return { docs: [{ id: 7, fellows: [11] }] }
    if (collection === 'enrollments') {
      const statuses = ((where.and as Where[])[1]!.status as { in: string[] }).in
      expect(statuses).not.toContain('applied')
      return { docs: [{ person: 12 }] }
    }
    if (collection === 'memberships') return { docs: [{ person: { id: 13 } }] }
    // users: { or: [...] }, each a roles, id or person test.
    const any = where.or as Where[]
    const match = (u: (typeof users)[number]) =>
      any.some((w) => {
        if ('roles' in w) return u.roles.some((r) => (w.roles as { in: string[] }).in.includes(r))
        if ('person' in w) return (w.person as { in: number[] }).in.includes(u.person as number)
        const id = w.id as { in?: number[]; exists?: boolean }
        return id.exists || id.in!.includes(u.id)
      })
    return { docs: users.filter(match) }
  }),
} as unknown as Payload

describe('memberEmails', () => {
  it('unions roles, programmes and chosen accounts, each address once', async () => {
    const emails = await memberEmails(payload, { roles: ['fellow'], programmes: [9], users: [{ id: 4 }, 1] })
    expect(emails).toEqual(['bridge@cilas.org', 'chosen@cilas.org', 'fellow@cilas.org'])
  })

  it('takes a course’s enrolled students and its fellows', async () => {
    expect(await memberEmails(payload, { courses: [7] })).toEqual(['fellow@cilas.org', 'student@cilas.org'])
    expect(await memberEmails(payload, { courses: [7], course_people: ['students'] })).toEqual(['student@cilas.org'])
  })

  it('holds nobody without a rule, and every account with “everyone”', async () => {
    expect(await memberEmails(payload, {})).toEqual([])
    expect(await memberEmails(payload, { everyone: true })).toHaveLength(users.length)
  })
})

describe('segmentDiff', () => {
  it('adds the missing and removes who left, ignoring case', () => {
    expect(
      segmentDiff(['a@x.org', 'b@x.org'], [{ email: 'B@x.org' }, { email: 'c@x.org' }]),
    ).toEqual({ add: ['a@x.org'], remove: ['c@x.org'] })
  })
})
