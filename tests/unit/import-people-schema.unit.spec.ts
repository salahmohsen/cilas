// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { PEOPLE_PROMPT_VERSION, PeoplePage, peoplePrompt } from '../../migration/lib/people-schema'

const sample = {
  year: '2015-2016',
  place: 'cairo',
  people: [
    {
      name: 'Eman Maarek',
      name_ar: null,
      group: 'student',
      title: null,
      bio: 'My name is Eman Maarek…',
      email: null,
      photo: 'uploads/1/9/1/0/19102967/4190580_1_orig.jpg',
      board_role: null,
      advises_on: null,
    },
    {
      name: 'Michael Brint',
      name_ar: null,
      group: 'advisor',
      title: 'Professor of Political Science, California Lutheran University',
      bio: '…',
      email: null,
      photo: null,
      board_role: null,
      advises_on: 'curriculum design and university partnerships in the US and the UK',
    },
  ],
}

describe('people page schema', () => {
  it('accepts a page of people', () => {
    expect(PeoplePage.parse(sample)).toEqual(sample)
  })

  it('rejects a group outside the enum', () => {
    const bad = { ...sample, people: [{ ...sample.people[0], group: 'janitor' }] }
    expect(() => PeoplePage.parse(bad)).toThrow()
  })

  it('builds a prompt holding the file name and the page text', () => {
    const prompt = peoplePrompt({ file: 'cilasians-2015-2016.html', title: 'CILASians', text: 'Eman Maarek' })
    expect(prompt).toContain('cilasians-2015-2016.html')
    expect(prompt).toContain('Eman Maarek')
    expect(PEOPLE_PROMPT_VERSION).toMatch(/^\d+$/)
  })
})
