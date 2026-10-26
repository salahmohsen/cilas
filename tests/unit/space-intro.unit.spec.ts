import { describe, expect, it } from 'vitest'

import { INTRO_DEFAULTS, introBody, introGated } from '@/lib/space-intro'

describe('introBody', () => {
  it('copies both languages of the template, English first, each under its title', () => {
    const body = introBody(
      { title: 'Hello', body: 'Say who you are.' },
      { title: 'أهلًا', body: 'عرّف بنفسك.' },
    )
    expect(body).toBe('## Hello\n\nSay who you are.\n\n---\n\n## أهلًا\n\nعرّف بنفسك.')
  })

  it('uses the default text for an empty or missing field', () => {
    const body = introBody({ title: '  ', body: null }, undefined)
    expect(body).toContain(`## ${INTRO_DEFAULTS.en.title}\n\n${INTRO_DEFAULTS.en.body}`)
    expect(body).toContain(`## ${INTRO_DEFAULTS.ar.title}\n\n${INTRO_DEFAULTS.ar.body}`)
  })
})

describe('introGated', () => {
  it('holds a member of a course or cohort space who has not commented on its intro post', () => {
    expect(introGated('course', 'member', 7, false)).toBe(true)
    expect(introGated('cohort', 'member', 7, false)).toBe(true)
  })

  it('opens once the member has commented', () => {
    expect(introGated('course', 'member', 7, true)).toBe(false)
  })

  it('never holds moderators: admins, fellows and residential fellows', () => {
    expect(introGated('course', 'moderator', 7, false)).toBe(false)
    expect(introGated('cohort', 'moderator', 7, false)).toBe(false)
  })

  it('leaves community spaces and spaces without an intro post open', () => {
    expect(introGated('community', 'member', 7, false)).toBe(false)
    expect(introGated('course', 'member', null, false)).toBe(false)
  })

  it('has nothing to hold for a non-member', () => {
    expect(introGated('course', 'none', 7, false)).toBe(false)
  })
})
