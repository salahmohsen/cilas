import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Poster, type PosterData } from '@/components/home/poster'
import { PosterCarousel } from '@/components/home/poster-carousel'
import { renderWithIntl } from '../../../testing/intl.test-utils'

afterEach(cleanup)

const poster: PosterData = {
  id: 'course',
  href: '/en/study/course',
  layout: 0,
  title: 'Course',
  image: {
    src: 'https://media.example.com/course.webp',
    alt: 'Course artwork',
    focalX: 20,
    focalY: 70,
  },
  meta: { lines: [] },
  details: [],
  action: 'Apply',
}

const image = (container: HTMLElement) => within(container).getByRole<HTMLImageElement>('img')

describe('poster image delivery', () => {
  it('optimizes registration images while preserving their focal point', () => {
    const { container } = render(<Poster poster={poster} />)
    expect(new URL(image(container).src).searchParams.get('url')).toBe(poster.image!.src)
    expect(image(container)).toHaveAttribute('srcset')
    expect(image(container).style.objectPosition).toBe('20% 70%')
    expect(image(container)).toHaveAttribute('alt', 'Course artwork')
  })

  it('retains responsive optimization for other posters', () => {
    const { container } = render(<Poster poster={poster} />)
    expect(image(container).getAttribute('src')).toContain('/_next/image?')
    expect(image(container)).toHaveAttribute('srcset')
  })

  it('removes a failed cover and recovers for a different cover', () => {
    const { container, rerender } = render(<Poster poster={poster} />)
    fireEvent.error(image(container))
    expect(within(container).queryByRole('img')).toBeNull()
    rerender(
      <Poster
        poster={{ ...poster, image: { src: '/assets/images/new.webp', alt: 'New cover' } }}
      />,
    )
    expect(new URL(image(container).src).searchParams.get('url')).toBe('/assets/images/new.webp')
  })

  it('renders a poster without a cover when no image is available', () => {
    const { container } = render(<Poster poster={{ ...poster, image: undefined }} />)
    expect(within(container).queryByRole('img')).toBeNull()
  })

  it('loads the active and next slides early and follows carousel changes including wraparound', async () => {
    const posters = Array.from({ length: 3 }, (_, index) => ({ ...poster, id: `course-${index}` }))
    const { container, getAllByRole } = renderWithIntl(
      <PosterCarousel posters={posters} label="Registration" />,
    )
    const images = within(container).getAllByRole<HTMLImageElement>('img')
    expect(images.map((img) => img.getAttribute('loading'))).toEqual(['eager', 'eager', 'lazy'])
    expect(images.map((img) => img.getAttribute('fetchpriority'))).toEqual(['high', 'auto', 'auto'])
    fireEvent.click(getAllByRole('tab')[2]!)
    await waitFor(() =>
      expect(images.map((img) => img.getAttribute('loading'))).toEqual(['eager', 'lazy', 'eager']),
    )
    expect(images.map((img) => img.getAttribute('fetchpriority'))).toEqual(['auto', 'auto', 'high'])
  })
})
