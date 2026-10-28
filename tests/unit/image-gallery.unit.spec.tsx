import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
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
    const trigger = screen.getByRole('button', { name: 'Open image: Classroom' })
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
    fireEvent.click(screen.getByRole('button', { name: 'Open image: Rooftop' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByAltText('Rooftop')).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(within(dialog).getByAltText('Classroom')).toBeInTheDocument()
  })

  it('keeps zoomed arrow keys for panning, resets zoom on navigation, and closes on Escape', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Open image: Classroom' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Open image: Classroom' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.error(within(dialog).getByAltText('Classroom'))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('This image could not be loaded')
    const retry = within(dialog).getByRole('button', { name: 'Retry image' })
    fireEvent.pointerDown(retry, { pointerId: 1, pointerType: 'touch' })
    fireEvent.pointerUp(retry, { pointerId: 1, pointerType: 'touch' })
    fireEvent.click(retry)
    fireEvent.load(within(dialog).getByAltText('Classroom'))
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Loading image…')).not.toBeInTheDocument()
  })

  it('does not render an empty gallery or navigation for a single image', async () => {
    const view = show([{ ...gallery, fields: { ...gallery.fields, images: [] } }])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    view.unmount()
    show([{ ...gallery, fields: { ...gallery.fields, images: gallery.fields.images.slice(0, 1) } }])
    fireEvent.click(screen.getByRole('button', { name: 'Open image: Classroom' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Previous image' })).not.toBeInTheDocument()
  })
})
