import { renderToStaticMarkup } from 'react-dom/server'
import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { getPublicEvents } from '@/api/events.api'
import { RichTextField } from '@/components/RichTextField'

describe('public event editor uploads', () => {
  it.each([
    { mimeType: 'image/webp', url: '/screening.webp', filename: 'screening.webp' },
    { mimeType: 'application/pdf', url: '/programme.pdf', filename: 'programme.pdf' },
  ])('provides enough populated media to render $mimeType uploads', async (file) => {
    const media = { ...file, id: 1, alt: 'Screening programme', width: 800, height: 600, sizes: {} }
    const find = vi.fn(async ({ populate }) => {
      const value = Object.fromEntries(
        Object.keys(populate.media)
          .filter((key) => key in media)
          .map((key) => [key, media[key as keyof typeof media]]),
      )
      return {
        docs: [
          {
            description: {
              root: {
                type: 'root',
                version: 1,
                children: [{ type: 'upload', version: 3, relationTo: 'media', value }],
              },
            },
          },
        ],
      }
    })
    const events = await getPublicEvents({ find } as unknown as Payload, 'en', 'screening')
    const html = renderToStaticMarkup(<RichTextField data={events[0].description} />)
    if (file.mimeType.startsWith('image/')) {
      expect(html).toContain('src="/screening.webp"')
      expect(html).toContain('width="800"')
      expect(html).toContain('alt="Screening programme"')
    } else {
      expect(html).toContain('href="/programme.pdf"')
      expect(html).toContain('programme.pdf')
    }
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        overrideAccess: false,
        where: { and: [{ tier: { equals: 'public' } }, { slug: { equals: 'screening' } }] },
      }),
    )
  })
})
