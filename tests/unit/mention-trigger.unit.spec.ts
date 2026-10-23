// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { insertMentionMarkdown } from '@/components/arc/rich-text-editor/rich-text-editor'

describe('the @ member trigger (spec §5)', () => {
  it('a chosen member inserts [@Name](/people/{id}) at the caret', () => {
    const md = 'Salam [@Nadim Id](/people/42) hello'
    expect(insertMentionMarkdown('Salam @nad hello', 10, { id: 42, name: 'Nadim Id' })).toBe(md)
  })

  it('a caret before any @ leaves the text alone', () => {
    expect(insertMentionMarkdown('no trigger here', 6, { id: 42, name: 'Nadim Id' })).toBe(
      'no trigger here',
    )
  })

  it('the chosen member lands where the query started, tail preserved', () => {
    expect(insertMentionMarkdown('Salam @n hello', 8, { id: 7, name: 'Hala Salam' })).toBe(
      'Salam [@Hala Salam](/people/7) hello',
    )
  })
})
