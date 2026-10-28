import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JSONFieldClientProps } from 'payload'

import { MoviePicker } from '@/components/admin/movie-picker'
import { movie } from '../fixtures/movie'

const { setValue } = vi.hoisted(() => ({ setValue: vi.fn() }))
vi.mock('@payloadcms/ui', () => ({
  useField: () => ({ value: null, setValue, showError: false }),
  useLocale: () => ({ code: 'en' }),
}))
beforeEach(() => setValue.mockReset())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('movie picker', () => {
  it('searches by title and saves full movie metadata only after selection', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ results: [movie] }))
      .mockResolvedValueOnce(Response.json({ movie }))
    vi.stubGlobal('fetch', fetch)
    render(<MoviePicker {...({ path: 'movie' } as JSONFieldClientProps)} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Faces' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    const choice = await screen.findByRole('button', { name: 'Faces (1968)' })
    expect(setValue).not.toHaveBeenCalled()
    fireEvent.click(choice)
    await waitFor(() => expect(setValue).toHaveBeenCalledWith(movie))
    expect(fetch.mock.calls[1][0]).toContain('id=753')
  })
  it('shows an API error without altering the selected data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'Movie search is busy.' }, { status: 429 })),
    )
    render(<MoviePicker {...({ path: 'movie' } as JSONFieldClientProps)} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Faces' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Movie search is busy.')
    expect(setValue).not.toHaveBeenCalled()
  })
})
