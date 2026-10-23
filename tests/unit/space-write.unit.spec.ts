// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { postingAllows, validateMentions } from '@/lib/spaces-write'

describe('pure decision layer of the write module', () => {
  it('postingAllows: announcements for moderators only; members_comment still lets moderators post', () => {
    expect(postingAllows('members_post', 'member', 'discussion')).toBe(true)
    expect(postingAllows('members_post', 'member', 'announcement')).toBe(false)
    expect(postingAllows('members_post', 'moderator', 'announcement')).toBe(true)
    expect(postingAllows('members_comment', 'member', 'discussion')).toBe(false)
    expect(postingAllows('members_comment', 'moderator', 'discussion')).toBe(true)
    expect(postingAllows('fellows_only', 'member', 'discussion')).toBe(false)
    expect(postingAllows('fellows_only', 'moderator', 'discussion')).toBe(true)
  })

  it('validateMentions: only real member ids and the given link shape validate', () => {
    const ok = validateMentions('Salam [@A](/people/7) [@B](/people/bogus)', new Set([7]))
    expect(ok).toEqual({ mentioned: [7], invalid: ['/people/bogus'] })
  })
})
