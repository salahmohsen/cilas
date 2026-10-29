import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Pagination } from '@/components/arc/pagination/pagination'
import { BlogGrid } from '@/components/arc/blocks/blog-grid/blog-grid'
import { RichTextField } from '@/components/RichTextField'

vi.mock('motion/react', async (original) => ({
  ...(await original<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('crawlable pagination', () => {
  it('exposes real URLs, preserves normal clicks and leaves modified clicks to the browser', () => {
    const change = vi.fn()
    render(
      <Pagination
        page={1}
        pageCount={3}
        onPageChange={change}
        getPageHref={(page) => `/ar/study?page=${page}`}
      />,
    )
    const next = screen.getByRole('link', { name: 'Next page' })
    expect(next).toHaveAttribute('href', '/ar/study?page=2')
    expect(screen.getByLabelText('Previous page')).not.toHaveAttribute('href')
    expect(screen.getByLabelText('Previous page')).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(next)
    expect(change).toHaveBeenCalledExactlyOnceWith(2)
    change.mockClear()
    fireEvent.click(next, { ctrlKey: true })
    expect(change).not.toHaveBeenCalled()
  })

  it('keeps existing button pagination for in-place content', () => {
    const change = vi.fn()
    render(<Pagination page={1} pageCount={2} onPageChange={change} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(change).toHaveBeenCalledWith(2)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  })

  it('gives archive pagination a URL for its selected category', () => {
    const posts = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      title: `Event ${i}`,
      category: 'Talk',
      date: '2026-01-01',
      excerpt: '',
      readTime: 0,
      author: { name: '' },
    }))
    render(
      <BlogGrid
        posts={posts}
        category="Talk"
        showFeatured={false}
        pageSize={3}
        getPageHref={(page, category) => `/en/events?type=${category}&page=${page}`}
      />,
    )
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute(
      'href',
      '/en/events?type=Talk&page=2',
    )
  })
})

const text = {
  type: 'text',
  version: 1,
  text: 'Read this',
  format: 0,
  mode: 'normal',
  style: '',
  detail: 0,
}
const content = (fields: object) => ({
  root: {
    type: 'root',
    version: 1,
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [{ type: 'link', version: 3, fields, children: [text] }],
      },
    ],
  },
})

describe('rich-text internal links', () => {
  const body = (fields: object, plain = false) =>
    render(
      <NextIntlClientProvider locale="ar" messages={{}}>
        <RichTextField data={content(fields)} plain={plain} />
      </NextIntlClientProvider>,
    )

  it.each([false, true])(
    'resolves populated document routes in the reader locale, plain=%s',
    (plain) => {
      body(
        {
          linkType: 'internal',
          newTab: true,
          doc: {
            relationTo: 'courses',
            value: { id: 1, slug: 'plato', tier: 'public', _status: 'published' },
          },
        },
        plain,
      )
      const link = screen.getByRole('link', { name: 'Read this' })
      expect(link).toHaveAttribute('href', '/ar/study/plato')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    },
  )

  it.each([
    null,
    { relationTo: 'courses', value: 99 },
    { relationTo: 'users', value: { slug: 'someone' } },
    { relationTo: 'people', value: { slug: 'hidden', visible: false } },
    { relationTo: 'courses', value: { slug: 'private', tier: 'owner' } },
  ])('keeps unavailable target text without inventing a link, %j', (doc) => {
    const { container } = body({ linkType: 'internal', doc })
    expect(container.textContent).toContain('Read this')
    expect(container.querySelector('a')).toBeNull()
  })

  it('keeps external link behavior', () => {
    body({ linkType: 'custom', url: 'https://example.com', newTab: true })
    expect(screen.getByRole('link', { name: 'Read this' })).toHaveAttribute(
      'href',
      'https://example.com',
    )
  })
})
