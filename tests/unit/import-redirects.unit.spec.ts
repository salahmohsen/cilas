import { describe, expect, it } from 'vitest'

import { redirectTargets } from '../../migration/lib/import-redirects'

const docs = [
  { collection: 'courses', id: 1, legacy_url: '/a-course.html' },
  { collection: 'cycles', id: 2, legacy_url: '/fall-cycle.html' },
  { collection: 'courses', id: 3, legacy_url: '/fall-cycle.html#one' },
  { collection: 'courses', id: 4, legacy_url: '/fall-cycle.html#two' },
  { collection: 'programmes', id: 5, legacy_url: '/cohort.html' },
  { collection: 'people', id: 6, legacy_url: '/cohort.html#ann' },
  { collection: 'cycles', id: 7, legacy_url: '/trimester.html#spring' },
  { collection: 'courses', id: 8, legacy_url: '/trimester.html#c1' },
  { collection: 'courses', id: 9, legacy_url: '/pair.html#x' },
  { collection: 'courses', id: 10, legacy_url: '/pair.html#y' },
  { collection: 'press', id: 11, legacy_url: '/solo.html#only' },
]
const page = (legacy_url: string, kind = 'course') => ({ legacy_url, kind, title: legacy_url })
const one = (url: string, kind?: string) => redirectTargets([page(url, kind)], docs)[0]

describe('redirectTargets', () => {
  it('sends a course page to its course', () => {
    expect(one('/a-course.html')).toMatchObject({ from: '/a-course.html', target: { collection: 'courses', id: 1 }, reason: 'exact' })
  })

  it('sends a cycle page to the cycle, not to a course fragment', () => {
    expect(one('/fall-cycle.html', 'cycle').target).toEqual({ collection: 'cycles', id: 2 })
  })

  it('sends a cohort page to its programme, not to a person fragment', () => {
    expect(one('/cohort.html', 'people').target).toEqual({ collection: 'programmes', id: 5 })
  })

  it('falls back to the one cycle or programme among fragments', () => {
    expect(one('/trimester.html', 'cycle')).toMatchObject({ target: { collection: 'cycles', id: 7 }, reason: 'page-doc' })
  })

  it('falls back to a single fragment document', () => {
    expect(one('/solo.html', 'press')).toMatchObject({ target: { collection: 'press', id: 11 }, reason: 'single-fragment' })
  })

  it('has no target for an info page', () => {
    expect(one('/about.html', 'info')).toMatchObject({ target: null, reason: 'no-document' })
  })

  it('marks several fragment documents without a page document as ambiguous', () => {
    const r = one('/pair.html')
    expect(r.target).toBeNull()
    expect(r.reason).toBe('ambiguous')
    expect(r.candidates).toHaveLength(2)
  })

  it('gives space pages no redirect', () => {
    expect(one('/a-course.html', 'space')).toMatchObject({ target: null, reason: 'space' })
  })
})
