import { cleanup, fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Poster, type PosterData } from '@/components/home/poster'
import { PosterCarousel } from '@/components/home/poster-carousel'
import { openPosters } from '@/components/home/open-now'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  getFormatter: async () => ({ dateTime: () => '' }),
}))
vi.mock('@/components/home/deadline-countdown', () => ({ DeadlineCountdown: () => null }))
vi.mock('@/components/arc/in-view-title/in-view-title', () => ({
  InViewTitle: ({ text }: { text: string }) => <h3>{text}</h3>,
}))
vi.mock('@/components/arc/carousel/carousel', () => ({
  Carousel: ({
    children,
    onIndexChange,
  }: {
    children: ReactNode
    onIndexChange: (index: number) => void
  }) => (
    <section>
      {children}
      <button onClick={() => onIndexChange(2)}>Show third slide</button>
    </section>
  ),
}))

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
  imageDelivery: 'direct',
  meta: { lines: [] },
  details: [],
  action: 'Apply',
}

const image = (container: HTMLElement) =>
  container.querySelector<HTMLImageElement>('.poster-image img')!

describe('poster image delivery', () => {
  it('opts registration cards into direct delivery at their data boundary', async () => {
    const [registration] = await openPosters(
      [{ kind: 'course', title: 'Course', href: '/study/course', image: poster.image }],
      'en',
    )
    const { container } = render(<Poster poster={registration} />)
    expect(image(container)).toHaveAttribute('src', poster.image!.src)
    expect(image(container)).not.toHaveAttribute('srcset')
  })

  it('serves prepared registration images without the optimizer while preserving their focal point', () => {
    const { container } = render(<Poster poster={poster} />)
    expect(image(container).getAttribute('src')).toBe(poster.image!.src)
    expect(image(container)).not.toHaveAttribute('srcset')
    expect(image(container).style.objectPosition).toBe('20% 70%')
    expect(image(container)).toHaveAttribute('alt', 'Course artwork')
  })

  it('retains responsive optimization for other posters', () => {
    const { container } = render(<Poster poster={{ ...poster, imageDelivery: undefined }} />)
    expect(image(container).getAttribute('src')).toContain('/_next/image?')
    expect(image(container)).toHaveAttribute('srcset')
  })

  it('replaces a failed request with the local fallback and recovers for a different cover', () => {
    const { container, rerender } = render(<Poster poster={poster} />)
    fireEvent.error(image(container))
    expect(image(container)).toHaveAttribute('src', '/assets/images/cilas-classroom.jpg')
    expect(image(container)).toHaveAttribute('alt', '')
    expect(image(container).style.objectPosition).toBe('50% 50%')
    fireEvent.error(image(container))
    expect(image(container)).toHaveAttribute('src', '/assets/images/cilas-classroom.jpg')
    rerender(
      <Poster
        poster={{ ...poster, image: { src: '/assets/images/new.webp', alt: 'New cover' } }}
      />,
    )
    expect(image(container)).toHaveAttribute('src', '/assets/images/new.webp')
  })

  it('uses the logo fallback when that poster requests one', () => {
    const { container } = render(<Poster poster={{ ...poster, imageFallback: 'logo' }} />)
    fireEvent.error(image(container))
    expect(container.querySelector('.poster-image img')).toBeNull()
    expect(container.querySelector('.poster-fallback-logo')).not.toBeNull()
  })

  it('loads the active and next slides early and follows carousel changes including wraparound', () => {
    const posters = Array.from({ length: 3 }, (_, index) => ({ ...poster, id: `course-${index}` }))
    const { container, getByRole } = render(
      <PosterCarousel posters={posters} label="Registration" />,
    )
    const images = Array.from(container.querySelectorAll<HTMLImageElement>('.poster-image img'))
    expect(images.map((img) => img.getAttribute('loading'))).toEqual(['eager', 'eager', 'lazy'])
    expect(images.map((img) => img.getAttribute('fetchpriority'))).toEqual(['high', 'auto', 'auto'])
    fireEvent.click(getByRole('button', { name: 'Show third slide' }))
    expect(images.map((img) => img.getAttribute('loading'))).toEqual(['eager', 'lazy', 'eager'])
    expect(images.map((img) => img.getAttribute('fetchpriority'))).toEqual(['auto', 'auto', 'high'])
  })
})
