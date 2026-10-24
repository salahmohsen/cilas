// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
  htmlToMarkdown,
  insertMentionLink,
  markdownToHtml,
} from '@/components/arc/rich-text-editor/rich-text-editor'

describe('the @ member trigger (spec §5)', () => {
  it('a chosen member replaces "@query" with a link that shows only the name', () => {
    const p = document.createElement('p')
    p.textContent = 'Salam @nad hello'
    const after = insertMentionLink(p.firstChild as Text, 10, { id: 42, name: 'Nadim Id' })
    expect(p.innerHTML).toBe('Salam <a href="/people/42">Nadim Id</a> hello')
    expect(after?.data).toBe(' hello')
  })

  it('no "@" before the caret leaves the text alone', () => {
    const p = document.createElement('p')
    p.textContent = 'no trigger here'
    expect(insertMentionLink(p.firstChild as Text, 6, { id: 42, name: 'Nadim' })).toBeNull()
    expect(p.textContent).toBe('no trigger here')
  })

  it('the stored form survives a round trip through the editor', () => {
    const md = 'Salam [@Nadim Id](/people/42) and [a site](https://cilas.org)'
    const html = markdownToHtml(md)
    expect(html).toContain('<a href="/people/42">Nadim Id</a>')
    expect(htmlToMarkdown(html)).toBe(md)
  })
})
