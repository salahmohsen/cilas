// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PostBody } from '@/components/space/post-body'

describe('post body rendering (spec §5)', () => {
  it("renders the editor's blocks and nothing else", () => {
    const { container } = render(
      <PostBody
        body={'# Title\n\n**bold** ~~gone~~ [site](https://cilas.org)\n\n<script>alert(1)</script>'}
      />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('bold')
    expect(container.querySelector('a[href="https://cilas.org"]')).toBeTruthy()
    expect(container.querySelector('h1')?.textContent).toBe('Title')
  })

  it("a /people/{id} link becomes a mention chip with the person's current name", () => {
    const { container } = render(
      <PostBody
        body={'Salam [@Nadim](/people/42)!'}
        people={{ 42: 'Nadim Id' }}
        peopleLinks={{ 42: '/en/people/nadim' }}
      />,
    )
    const chip = container.querySelector('a[href="/en/people/nadim"]')
    expect(chip?.textContent).toContain('@Nadim Id')
  })

  it('a person without a public page renders a plain chip, never a 404 link', () => {
    const { container } = render(
      <PostBody
        body={'Salam [@Yara](/people/43)'}
        people={{ 43: 'Yara' }}
        peopleLinks={{ 43: null }}
      />,
    )
    expect(container.querySelector('span.mention-chip')?.textContent).toContain('@Yara')
    expect(container.querySelector('a.mention-chip')).toBeNull()
  })

  it('a mention chip keeps dir="auto" like every post and name (spec §5)', () => {
    const { container } = render(
      <PostBody body={'عيد مبارك [@نديم](/people/42)'} people={{ 42: 'نديم' }} />,
    )
    expect([...container.querySelectorAll('[dir="auto"]')].length).toBeGreaterThan(0)
  })
})
