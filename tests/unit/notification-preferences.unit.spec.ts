import { describe, expect, it } from 'vitest'

import {
  mergePreferences,
  preferenceChangesSchema,
  readPreferences,
  switchesOf,
  wantsChannel,
} from '@/lib/notification-preferences'
import { reactionNote } from '@/lib/notify'

describe('wantsChannel', () => {
  it('is on for everything until it is turned off', () => {
    expect(wantsChannel(undefined, 'push', 'reaction')).toBe(true)
    expect(wantsChannel(null, 'email', 'approved')).toBe(true)
    expect(wantsChannel({}, 'push', 'comment')).toBe(true)
  })

  it('is off only for the kind and channel that were refused', () => {
    const prefs = { push: { reaction: false as const }, email: { approved: false as const } }
    expect(wantsChannel(prefs, 'push', 'reaction')).toBe(false)
    expect(wantsChannel(prefs, 'push', 'comment')).toBe(true)
    expect(wantsChannel(prefs, 'email', 'approved')).toBe(false)
    expect(wantsChannel(prefs, 'email', 'rejected')).toBe(true)
  })

  it('treats an unknown kind as on', () => {
    expect(wantsChannel({ push: { reaction: false } }, 'push', 'something_new')).toBe(true)
  })
})

describe('readPreferences', () => {
  it('keeps a valid value and drops garbage', () => {
    expect(readPreferences({ push: { reaction: false } })).toEqual({ push: { reaction: false } })
    expect(readPreferences('nope')).toEqual({})
    expect(readPreferences({ push: { not_a_kind: false } })).toEqual({})
    expect(readPreferences(null)).toEqual({})
  })
})

describe('preferenceChangesSchema', () => {
  it('refuses an email switch for a kind that sends no email', () => {
    expect(preferenceChangesSchema.safeParse({ email: { reaction: false } }).success).toBe(false)
    expect(preferenceChangesSchema.safeParse({ email: { approved: false } }).success).toBe(true)
  })

  it('refuses unknown channels and non-boolean values', () => {
    expect(preferenceChangesSchema.safeParse({ sms: { reaction: false } }).success).toBe(false)
    expect(preferenceChangesSchema.safeParse({ push: { reaction: 'no' } }).success).toBe(false)
  })
})

describe('mergePreferences', () => {
  it('stores only refusals and drops a kind turned back on', () => {
    const stored = { push: { reaction: false as const, comment: false as const } }
    const next = mergePreferences(stored, { push: { reaction: true }, email: { approved: false } })
    expect(next).toEqual({ push: { comment: false }, email: { approved: false } })
  })

  it('keeps what a save does not mention', () => {
    expect(mergePreferences({ push: { reply: false } }, { push: { mention: false } })).toEqual({
      push: { reply: false, mention: false },
    })
  })
})

describe('switchesOf', () => {
  it('hides the admin kinds from a member and the email group from kinds without email', () => {
    const member = switchesOf({ push: { reaction: false } }, false)
    expect(member.push.reaction).toBe(false)
    expect(member.push.comment).toBe(true)
    expect('submitted' in member.push).toBe(false)
    expect(Object.keys(member.email)).toEqual(['approved', 'changes_requested', 'rejected'])
    const admin = switchesOf(undefined, true)
    expect(admin.push.application).toBe(true)
    expect(admin.email.submitted).toBe(true)
  })
})

describe('reactionNote', () => {
  it('reads as a sentence for a like and for another reaction', () => {
    expect(
      reactionNote({ actor: 'Sam', reaction: 'agree', target: 'post', context: '“Seminar”' }),
    ).toBe('Sam liked your post in “Seminar”')
    expect(reactionNote({ reaction: 'thank_you', target: 'comment', context: '“Seminar”' })).toBe(
      'Someone thanked you for your comment in “Seminar”',
    )
  })
})
