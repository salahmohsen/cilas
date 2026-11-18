import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { MoviePickerForm } from '@/components/admin/movie-picker-form'
import type { MovieSnapshot } from '@/lib/movie'

import { movie } from '../../../testing/movie.fixture'
import { mockNetwork, nextImages } from '../../../testing/msw-browser.test-utils'

const network = mockNetwork(nextImages())
afterEach(cleanup)

const saved: (MovieSnapshot | null)[] = []
const Host = () => {
  const [value, setValue] = useState<MovieSnapshot | null>(null)
  return (
    <MoviePickerForm
      value={value}
      setValue={(next) => {
        saved.push(next)
        setValue(next)
      }}
      showError={false}
      locale="en"
    />
  )
}

describe('movie picker', () => {
  it('searches by title and saves full movie metadata only after selection', async () => {
    saved.length = 0
    const asked: string[] = []
    network.use(
      http.get('/api/movies', ({ request }) => {
        const parameters = new URL(request.url).searchParams
        asked.push(parameters.toString())
        return parameters.has('id')
          ? HttpResponse.json({ movie })
          : HttpResponse.json({ results: [movie] })
      }),
    )
    render(<Host />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Faces' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    const choice = await screen.findByRole('button', { name: 'Faces (1968)' })
    expect(saved).toEqual([])
    fireEvent.click(choice)
    await waitFor(() => expect(saved).toEqual([movie]))
    expect(asked).toEqual(['locale=en&query=Faces', 'locale=en&id=753'])
  })
  it('shows an API error without altering the selected data', async () => {
    saved.length = 0
    network.use(
      http.get('/api/movies', () =>
        HttpResponse.json({ error: 'Movie search is busy.' }, { status: 429 }),
      ),
    )
    render(<Host />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Faces' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Movie search is busy.')
    expect(saved).toEqual([])
  })
})
