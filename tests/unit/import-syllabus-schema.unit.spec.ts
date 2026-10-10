import { describe, expect, it } from 'vitest'

import { FLOW_PROMPT_VERSION, flowPrompt, Syllabus } from '../../migration/lib/syllabus-schema'

const sample = {
  session_unit: 'session',
  sessions: [
    {
      order: 1,
      title: 'Introduction and overview. Openings and closings',
      description: 'Overview of course and the importance of imagination…',
      meetings: null,
      materials: [
        { type: 'prompt', title: "Why do stories start with 'kan yama kan'?", note: null, href: null },
        {
          type: 'reading',
          title: "'The Birth of Story' in Story and Structure: A complete guide",
          note: 'Conrad, 2022, pp.25–31',
          href: null,
        },
      ],
      activities: [{ kind: 'discussion', description: 'Bring a story opening to class…' }],
    },
  ],
  bibliography: [],
  notes: null,
}

describe('Syllabus', () => {
  it('accepts a session with materials and activities', () => {
    expect(Syllabus.parse(sample)).toEqual(sample)
  })

  it('rejects an unknown material type', () => {
    const bad = structuredClone(sample)
    bad.sessions[0].materials[0].type = 'podcast'
    expect(() => Syllabus.parse(bad)).toThrow()
  })
})

describe('flowPrompt', () => {
  const base = { id: 'f', courses: ['Course A', 'Course B'], text: 'WEEK ONE TEXT', images: [] as string[] }

  it('carries the course titles and the text', () => {
    const p = flowPrompt({ ...base, method: 'text' })
    expect(p).toContain('Course A; Course B')
    expect(p).toContain('WEEK ONE TEXT')
    expect(p).not.toContain('Read tool')
  })

  it('tells a vision agent to read each image and treat OCR as a helper', () => {
    const p = flowPrompt({ ...base, method: 'vision', images: ['/x/page-1.png', '/x/page-2.png'] })
    expect(p).toContain('- /x/page-1.png')
    expect(p).toContain('- /x/page-2.png')
    expect(p).toContain('only a helper')
    expect(p).toContain('OCR text')
  })

  it('has a numeric prompt version', () => {
    expect(FLOW_PROMPT_VERSION).toMatch(/^\d+$/)
  })
})
