import type { Access } from 'payload'
import { describe, expect, it } from 'vitest'

import { readPeople } from '@/access'
import { applicantOf, rolesAfterAccept } from '@/forms/applicant'

const answers = (pairs: Record<string, string>) =>
  Object.entries(pairs).map(([field, value]) => ({ field, value }))

describe('rolesAfterAccept', () => {
  it('makes a programme applicant a member', () => {
    expect(rolesAfterAccept([], 'programmes')).toEqual(['member'])
    expect(rolesAfterAccept(['non_degree_seeking'], 'programmes')).toEqual([
      'non_degree_seeking',
      'member',
    ])
    expect(rolesAfterAccept(['member', 'fellow'], 'programmes')).toEqual(['member', 'fellow'])
  })

  it('adds non-degree-seeking only to an account with no student role', () => {
    expect(rolesAfterAccept([], 'courses')).toEqual(['non_degree_seeking'])
    expect(rolesAfterAccept(['member'], 'courses')).toEqual(['member'])
    expect(rolesAfterAccept(['admin'], 'courses')).toEqual(['admin', 'non_degree_seeking'])
  })
})

describe('applicantOf', () => {
  it('reads and tidies the name and email answers', () => {
    expect(applicantOf(answers({ name: ' Mona Adel ', email: ' Mona@Example.COM ' }))).toEqual({
      name: 'Mona Adel',
      email: 'mona@example.com',
    })
  })

  it('refuses a missing name or a bad email', () => {
    expect(applicantOf(answers({ email: 'a@b.co' }))).toHaveProperty('error')
    expect(applicantOf(answers({ name: 'A', email: 'not-an-email' }))).toHaveProperty('error')
    expect(applicantOf(null)).toHaveProperty('error')
  })
})

describe('readPeople', () => {
  const run = (user: unknown) => (readPeople as Access)({ req: { user } } as never)

  it('shows visitors only visible people', () => {
    expect(run(null)).toEqual({ visible: { equals: true } })
  })

  it('lets a signed-in person read their own hidden profile', () => {
    expect(run({ roles: ['member'], person: 9 })).toEqual({
      or: [{ visible: { equals: true } }, { id: { equals: 9 } }],
    })
  })

  it('shows admins everyone', () => {
    expect(run({ roles: ['admin'] })).toBe(true)
  })
})
