import { describe, expect, it } from 'vitest'

import { CoursePage, PROMPT_VERSION, coursePrompt } from '../../migration/lib/extraction-schema'

const sample = {
  cycles: [
    {
      label: 'Fall cycle 2024',
      season: 'fall',
      start_year: 2024,
      start_date: '2024-09-21',
      deadline: '2024-09-06',
      space_hint: 'darb el-labbana',
      courses: [
        {
          title: 'Story as participative enquiry',
          title_ar: null,
          subtitle: null,
          course_type: 'SHORT',
          fellows: [{ name: 'Leon Conrad', email: 'leon@leonconrad.com', bio: 'Founder of…' }],
          schedule_text: 'Sundays, 5:30-8 pm, start date is September the 21st.',
          weekdays: ['sun'],
          start_time: '17:30',
          end_time: '20:00',
          weeks: 8,
          start_date: '2024-09-21',
          location: ['HYBRID'],
          description: 'Why does story as a phenomenon exist?',
          flow_links: ['uploads/1/9/1/0/19102967/story.pdf'],
          register_url: 'https://forms.gle/AV541BDfrrTwxxJBA',
          own_page: null,
        },
      ],
    },
  ],
  course: null,
}

describe('CoursePage', () => {
  it('accepts a cycle page extraction', () => {
    expect(CoursePage.parse(sample).cycles[0].courses[0].title).toBe('Story as participative enquiry')
  })

  it('rejects times that are not 24-hour HH:MM', () => {
    const bad = structuredClone(sample)
    bad.cycles[0].courses[0].start_time = '5:30pm'
    expect(() => CoursePage.parse(bad)).toThrow()
  })
})

describe('coursePrompt', () => {
  it('names the page and carries its text', () => {
    const prompt = coursePrompt({ file: 'fall-cycle-2024.html', kind: 'cycle', title: 'Fall cycle 2024', text: 'BODY' })
    expect(prompt).toContain('fall-cycle-2024.html')
    expect(prompt).toContain('BODY')
    expect(PROMPT_VERSION).toMatch(/^\d+$/)
  })
})
