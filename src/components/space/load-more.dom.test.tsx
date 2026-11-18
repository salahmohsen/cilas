import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LoadMore } from '@/components/space/load-more'
import { renderWithNavigation } from '../../../testing/navigation.test-utils'

afterEach(cleanup)

describe('load more', () => {
  it('shows the count and replaces the address with the next page, keeping the scroll', () => {
    const { memory } = renderWithNavigation(
      <LoadMore href="/en/spaces/community?page=2" label="Load more" status="20 of 45" />,
      { url: '/en/spaces/community' },
    )
    expect(screen.getByText('20 of 45')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(memory.visits).toEqual([
      { method: 'replace', href: '/en/spaces/community?page=2', options: { scroll: false } },
    ])
    expect(memory.url.pathname).toBe('/en/spaces/community')
    expect(memory.url.searchParams.get('page')).toBe('2')
  })
})
