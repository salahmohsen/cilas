import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BlogGrid, type BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid'

vi.mock('motion/react', async (original) => ({
  ...(await original<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

const posts: BlogPost[] = Array.from({ length: 13 }, (_, index) => ({
  id: String(index + 1),
  title: `Event ${index + 1}`,
  category: index < 8 ? 'Talk' : 'Screening',
  date: '2025-01-01',
  excerpt: '',
  readTime: 0,
  author: { name: '' },
}))
const cards = Object.fromEntries(
  posts.map((post) => [
    post.id,
    <a key={post.id} href={`/events/${post.id}`}>
      {post.title}
    </a>,
  ]),
)

function Archive() {
  const [selection, setSelection] = useState({ category: 'All', page: 2 })
  return (
    <BlogGrid
      posts={posts}
      cards={cards}
      categories={['Talk', 'Screening']}
      showFeatured={false}
      pageSize={3}
      order="given"
      category={selection.category}
      page={selection.page}
      onPageChange={(page) => setSelection({ ...selection, page })}
      onCategoryChange={(category) => setSelection({ category, page: 1 })}
    />
  )
}

describe('Blog Grid with server-rendered event cards', () => {
  it('filters custom cards and resets a controlled page without restoring the old type', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    const scrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
    try {
      render(<Archive />)
      expect(screen.getByRole('link', { name: 'Event 4' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Screening' }))
      await waitFor(() => expect(screen.getByRole('link', { name: 'Event 9' })).toBeInTheDocument())
      expect(screen.queryByRole('link', { name: 'Event 4' })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
      await waitFor(() =>
        expect(screen.getByRole('link', { name: 'Event 12' })).toBeInTheDocument(),
      )
      expect(screen.queryByRole('link', { name: 'Event 9' })).not.toBeInTheDocument()
    } finally {
      Element.prototype.scrollIntoView = scrollIntoView
      vi.unstubAllGlobals()
    }
  })
})
