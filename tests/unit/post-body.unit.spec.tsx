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

  it("a /people/{id} link becomes a link with the person's current name", () => {
    const { container } = render(
      <PostBody body={'Salam [@Nadim](/people/42)!'} people={people({ 42: '/en/people/nadim' })} />,
    )
    const link = container.querySelector('a[href="/en/people/nadim"]')
    expect(link?.textContent).toBe('Nadim Id')
  })

  it('a person without a public page gets no link, never a 404', () => {
    const { container } = render(
      <PostBody body={'Salam [@Yara](/people/43)'} people={people({ 43: null })} />,
    )
    expect(container.textContent).toContain('Yara')
    expect(container.querySelector('a[href^="/people"]')).toBeNull()
    expect(container.querySelector('a[href*="people"]')).toBeNull()
  })

  it('every block keeps dir="auto" (spec §5)', () => {
    const { container } = render(<PostBody body={'عيد مبارك [@نديم](/people/42)'} />)
    expect([...container.querySelectorAll('[dir="auto"]')].length).toBeGreaterThan(0)
  })
})

const NAMES: Record<number, string> = { 42: 'Nadim Id', 43: 'Yara' }
const people = (hrefs: Record<number, string | null>) =>
  new Map(
    Object.entries(hrefs).map(([id, href]) => [
      Number(id),
      {
        id: Number(id),
        name: NAMES[Number(id)]!,
        photo: null,
        role: 'Member',
        bio: null,
        links: [],
        href,
      },
    ]),
  )
