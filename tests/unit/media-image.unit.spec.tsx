import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BlogCardBody } from '@/components/arc/blocks/blog-grid/blog-grid'
import { focalPointStyle, mediaImage } from '@/lib/media-image'

describe('media image framing', () => {
  it('uses the main image and keeps edge focal points, including zero', () => {
    const image = mediaImage({ url: '/original.webp', alt: 'A subject', focalX: 0, focalY: 100 })
    expect(image).toEqual({ src: '/original.webp', alt: 'A subject', focalX: 0, focalY: 100 })
    expect(focalPointStyle(image)).toEqual({ objectPosition: '0% 100%' })
  })

  it('centers missing coordinates independently and bounds invalid values', () => {
    expect(focalPointStyle()).toEqual({ objectPosition: '50% 50%' })
    expect(focalPointStyle({ focalX: 0, focalY: null })).toEqual({ objectPosition: '0% 50%' })
    expect(focalPointStyle({ focalX: -10, focalY: 120 })).toEqual({ objectPosition: '0% 100%' })
    expect(focalPointStyle({ focalX: NaN, focalY: Infinity })).toEqual({
      objectPosition: '50% 50%',
    })
    expect(mediaImage(null)).toBeUndefined()
  })

  it('keeps the selected focal point when rendering an Arc blog card', () => {
    const image = mediaImage({ url: '/original.webp', alt: 'A subject', focalX: 0, focalY: 90 })
    const html = renderToStaticMarkup(
      <BlogCardBody
        post={{
          id: '1',
          title: 'An article',
          excerpt: '',
          category: 'Notes',
          date: '2026-10-28',
          readTime: 1,
          author: { name: 'A writer' },
          image,
        }}
      />,
    )
    const document = new DOMParser().parseFromString(html, 'text/html')
    expect(document.querySelector('img')?.style.objectPosition).toBe('0% 90%')
    // The card loads through next/image, so the source sits in the optimizer URL.
    const src = new URL(document.querySelector('img')?.getAttribute('src') ?? '', 'http://x')
    expect(src.searchParams.get('url')).toBe('/original.webp')
  })
})
