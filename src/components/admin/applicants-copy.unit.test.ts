import { describe, expect, it } from 'vitest'
import { applicantsCopy } from '@/components/admin/applicants-copy'

describe('Arabic applicants copy', () => {
  const t = applicantsCopy(true)
  it('isolates names, titles and addresses so they keep their own direction', () => {
    expect(t.acceptBody('Omar Three', 'Media Lab')).toBe('قبول طلب ⁨Omar Three⁩ في ⁨Media Lab⁩.')
    expect(t.acceptEffects('a@b.co', 'Media Lab', false).join(' ')).toContain('⁨a@b.co⁩')
    expect(t.reopenEffects('Media Lab', 'accepted', false).join(' ')).toContain('⁨Media Lab⁩')
  })
  it('has every key the English copy has', () => {
    expect(Object.keys(t).sort()).toEqual(Object.keys(applicantsCopy(false)).sort())
  })
})
