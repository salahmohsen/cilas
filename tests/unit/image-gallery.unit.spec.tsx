import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { RichTextField } from '@/components/RichTextField'
import en from '../../messages/en.json'

afterEach(cleanup)

const documentOf = (children: unknown[]) => ({
  root: { type: 'root', version: 1, children, direction: null, format: '', indent: 0 },
})

const gallery = {
  type: 'block',
  version: 2,
  fields: {
    blockType: 'gallery',
    columnCount: '3',
    images: [
      {
        id: 'a',
        image: {
          id: 1,
          url: '/one.webp',
          alt: 'Classroom',
          mimeType: 'image/webp',
          width: 800,
          height: 600,
          focalX: 0,
          focalY: 100,
          sizes: { thumbnail: { url: '/one-thumbnail.webp', width: 400, height: 300 } },
        },
        caption: 'First gathering',
      },
      { id: 'missing', image: 999 },
      {
        id: 'b',
        image: {
          id: 2,
          url: '/two.webp',
          alt: 'Rooftop',
          mimeType: 'image/webp',
          width: 600,
          height: 800,
        },
      },
      { id: 'pdf', image: { id: 3, url: '/file.pdf', mimeType: 'application/pdf' } },
    ],
  },
}

function show(children: unknown[] = [gallery], plain = false) {
  return render(
    <NextIntlClientProvider locale="en" timeZone="Africa/Cairo" messages={en}>
      <RichTextField data={documentOf(children)} plain={plain} />
    </NextIntlClientProvider>,
  )
}

describe('image gallery', () => {
  it('renders images in order, captions, and skips missing media and non-images', () => {
    const { container } = show()
    expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual([
      'Classroom',
      'Rooftop',
    ])
    expect(screen.getByText('First gathering')).toBeInTheDocument()
    expect(container.querySelector('[data-gallery-columns="3"]')).toBeInTheDocument()
  })

  it('renders inside a Columns block and omits galleries in plain views', () => {
    const columns = {
      type: 'block',
      version: 2,
      fields: {
        blockType: 'columns',
        columnCount: '2',
        first: documentOf([gallery]),
        second: documentOf([]),
      },
    }
    const view = show([columns])
    expect(screen.getByAltText('Classroom')).toBeInTheDocument()
    view.unmount()
    show([columns], true)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('opens the clicked image, navigates with buttons and keys, and restores focus', async () => {
    show()
    const trigger = screen.getByRole('link', { name: 'Open image: Classroom' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByAltText('Classroom')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next image' }))
    expect(within(dialog).getByAltText('Rooftop')).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
    expect(within(dialog).getByAltText('Classroom')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close gallery' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 3000,
    })
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('opens a later thumbnail and wraps gallery navigation', async () => {
    show()
    fireEvent.click(screen.getByRole('link', { name: 'Open image: Rooftop' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByAltText('Rooftop')).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(within(dialog).getByAltText('Classroom')).toBeInTheDocument()
  })

  it('keeps zoomed arrow keys for panning, resets zoom on navigation, and closes on Escape', async () => {
    show()
    fireEvent.click(screen.getByRole('link', { name: 'Open image: Classroom' }))
    const dialog = await screen.findByRole('dialog')
    const frame = within(dialog).getByRole('group')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zoom in' }))
    await waitFor(() =>
      expect(within(dialog).getByAltText('Classroom').style.transform).toMatch(
        /scale\(1\.[1-9]|scale\(2/,
      ),
    )
    fireEvent.keyDown(frame, { key: 'ArrowRight' })
    expect(within(dialog).getByAltText('Classroom')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next image' }))
    expect(within(dialog).getByAltText('Rooftop')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
    fireEvent.keyDown(frame, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 3000,
    })
  })

  it('offers a retry when an image fails to load', async () => {
    show()
    fireEvent.click(screen.getByRole('link', { name: 'Open image: Classroom' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.error(within(dialog).getByAltText('Classroom'))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('This image could not be loaded')
    const retry = within(dialog).getByRole('button', { name: 'Retry image' })
    fireEvent.pointerDown(retry, { pointerId: 1, pointerType: 'touch' })
    fireEvent.pointerUp(retry, { pointerId: 1, pointerType: 'touch' })
    fireEvent.click(retry)
    fireEvent.load(within(dialog).getByAltText('Classroom'))
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(within(dialog).queryByText('Loading image…')).not.toBeInTheDocument(),
    )
  })

  it('does not render an empty gallery or navigation for a single image', async () => {
    const view = show([{ ...gallery, fields: { ...gallery.fields, images: [] } }])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    view.unmount()
    show([{ ...gallery, fields: { ...gallery.fields, images: gallery.fields.images.slice(0, 1) } }])
    fireEvent.click(screen.getByRole('link', { name: 'Open image: Classroom' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Previous image' })).not.toBeInTheDocument()
  })

  it('server-renders optimized responsive images and links to their originals', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" timeZone="Africa/Cairo" messages={en}>
        <RichTextField data={documentOf([gallery])} />
      </NextIntlClientProvider>,
    )
    const document = new DOMParser().parseFromString(html, 'text/html')
    const image = document.querySelector('img')!
    expect(image.getAttribute('src')).toContain('/_next/image?')
    expect(new URL(image.getAttribute('src')!, 'http://localhost').searchParams.get('url')).toBe(
      '/one.webp',
    )
    expect(image.getAttribute('srcset')).toContain('640w')
    expect(image.getAttribute('sizes')).toBeTruthy()
    expect(image.closest('a')?.getAttribute('href')).toBe('/one.webp')
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(image.style.objectPosition).toBe('0% 100%')
    expect(document.querySelector('figcaption')?.textContent).toBe('First gathering')
  })

  it('preserves modified clicks so visitors can open original images in another tab', () => {
    show()
    let intercepted: boolean | undefined
    document.addEventListener(
      'click',
      (event) => {
        intercepted = event.defaultPrevented
        event.preventDefault()
      },
      { once: true },
    )
    fireEvent.click(screen.getByRole('link', { name: 'Open image: Classroom' }), { ctrlKey: true })
    expect(intercepted).toBe(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('uses Next.js Image in the lightbox and supports legacy images without dimensions', async () => {
    const image = {
      id: 1,
      url: '/legacy.webp',
      alt: 'Legacy archive image',
      mimeType: 'image/webp',
    }
    show([{ ...gallery, fields: { ...gallery.fields, images: [{ image }] } }])
    fireEvent.click(screen.getByRole('link', { name: 'Open image: Legacy archive image' }))
    const dialog = await screen.findByRole('dialog')
    const fullImage = within(dialog).getByAltText('Legacy archive image')
    expect(fullImage.getAttribute('data-nimg')).toBeTruthy()
    expect(fullImage.getAttribute('srcset')).toBeTruthy()
    expect(fullImage.getAttribute('sizes')).toBeTruthy()
  })
})
