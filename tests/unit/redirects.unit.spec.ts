import { describe, expect, it } from 'vitest'

import { legacyCandidates, redirectTarget } from '@/lib/redirects'

describe('legacyCandidates', () => {
  it('tries the path with and without .html and a trailing slash', () => {
    expect(legacyCandidates('/fall-cycle-2025.html')).toEqual([
      '/fall-cycle-2025.html',
      '/fall-cycle-2025',
      '/fall-cycle-2025/',
    ])
    expect(legacyCandidates('/fall-cycle-2025/')).toEqual([
      '/fall-cycle-2025/',
      '/fall-cycle-2025',
      '/fall-cycle-2025.html',
    ])
  })

  it('decodes percent-encoded Arabic paths', () => {
    expect(legacyCandidates('/%D8%B3%D9%8A%D9%84%D8%A7%D8%B3.html')[0]).toBe('/سيلاس.html')
  })
})

describe('redirectTarget', () => {
  it('follows a custom URL', () => {
    expect(
      redirectTarget({ to: { type: 'custom', url: 'https://example.org' }, type: '302' }),
    ).toEqual({ url: 'https://example.org', permanent: false })
  })

  it('follows a reference to a document with a page, permanently by default', () => {
    expect(
      redirectTarget({
        to: {
          type: 'reference',
          reference: { relationTo: 'courses', value: { slug: 'writing-the-self' } },
        },
      }),
    ).toEqual({ url: '/study/writing-the-self', permanent: true })
  })

  it('is null for an unpopulated reference or a page that does not exist yet', () => {
    expect(
      redirectTarget({ to: { type: 'reference', reference: { relationTo: 'courses', value: 3 } } }),
    ).toBeNull()
    expect(
      redirectTarget({
        to: { type: 'reference', reference: { relationTo: 'programmes', value: { slug: 'b' } } },
      }),
    ).toBeNull()
  })
})
