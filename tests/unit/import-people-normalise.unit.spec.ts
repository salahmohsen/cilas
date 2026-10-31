import { describe, expect, it } from 'vitest'

import {
  UNVERIFIED_YEARS,
  completeBio,
  membershipRole,
  programmeTitle,
} from '../../migration/lib/normalise-people'

describe('programmeTitle', () => {
  it('names Cairo and Alexandria programmes', () => {
    expect(programmeTitle('2015-2016', 'cairo')).toBe('Bridge Programme 2015–2016')
    expect(programmeTitle('2018-2019', 'alexandria')).toBe(
      'Bridge Programme 2018–2019 (Alexandria)',
    )
  })
})

describe('membershipRole', () => {
  it('maps a plain fellow to residential fellow, flagged', () => {
    expect(membershipRole('fellow')).toEqual({ role: 'residential_fellow', flagged: true })
  })
  it('maps clear roles unflagged', () => {
    expect(membershipRole('visiting_fellow')).toEqual({ role: 'visiting_fellow', flagged: false })
    expect(membershipRole('residential_fellow')).toEqual({
      role: 'residential_fellow',
      flagged: false,
    })
    expect(membershipRole('student')).toEqual({ role: 'student', flagged: false })
  })
  it('gives team, advisors and trustees no membership', () => {
    expect(membershipRole('team')).toBeNull()
    expect(membershipRole('advisor')).toBeNull()
    expect(membershipRole('trustee')).toBeNull()
  })
})

describe('UNVERIFIED_YEARS', () => {
  it('lists the years with no cohort page', () => {
    expect(UNVERIFIED_YEARS).toEqual(['2020-2021', '2023-2024', '2024-2025'])
  })
})

describe('completeBio', () => {
  it('restores the name before a bio that starts in lowercase', () => {
    expect(completeBio('Jane Doe', 'is the Uyeno-Tseng Professor')).toBe(
      'Jane Doe is the Uyeno-Tseng Professor',
    )
    expect(completeBio('Jane Doe', 'holds a Bachelor’s')).toBe('Jane Doe holds a Bachelor’s')
  })
  it('leaves a bio that starts with a capital unchanged', () => {
    expect(completeBio('Jane Doe', 'Jane studied law.')).toBe('Jane studied law.')
  })
  it('leaves an Arabic bio unchanged', () => {
    const ar = 'درست الفلسفة في القاهرة'
    expect(completeBio('Jane Doe', ar)).toBe(ar)
  })
})
