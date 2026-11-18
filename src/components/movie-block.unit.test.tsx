import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { RichTextField } from '@/components/RichTextField'
import { moviePosterUrl } from '@/lib/movie'
import { movie } from '../../testing/movie.fixture'
import { renderWithIntl } from '../../testing/intl.test-utils'

afterEach(cleanup)
const data = (value: unknown, subtitleLanguages?: string[]) => ({
  root: {
    type: 'root',
    version: 1,
    direction: null,
    format: '',
    indent: 0,
    children: [
      {
        type: 'block',
        version: 2,
        fields: { blockType: 'movie', movie: value, subtitleLanguages },
      },
    ],
  },
})
const renderMovie = (value: unknown, plain = false, subtitleLanguages?: string[]) =>
  renderWithIntl(<RichTextField data={data(value, subtitleLanguages)} plain={plain} />)

describe('movie editor blocks', () => {
  it('shows every selected screening subtitle language separately from the film’s spoken languages', () => {
    renderMovie(movie, false, ['ar', 'fr'])
    expect(screen.getByText('Screening subtitles').nextElementSibling).toHaveTextContent(
      'Arabic, French',
    )
    expect(screen.getByText('Languages').nextElementSibling).toHaveTextContent('English')
  })
  it('keeps older movie blocks without screening subtitles usable', () => {
    renderMovie(movie)
    expect(screen.queryByText('Screening subtitles')).toBeNull()
  })
  it('renders the saved film on the card and the rest of its metadata in a dialog', async () => {
    renderMovie(movie)
    expect(screen.getByRole('heading', { name: 'Faces (1968)' })).toBeInTheDocument()
    const poster = new URL(screen.getByAltText('Faces').getAttribute('src')!, 'http://localhost')
    expect(poster.pathname).toBe('/_next/image')
    expect(poster.searchParams.get('url')).toBe('https://image.tmdb.org/t/p/w500/poster.jpg')
    expect(screen.getByText(movie.overview)).toBeInTheDocument()
    expect(screen.queryByText('130 minutes')).toBeNull()
    expect(screen.queryByRole('link', { name: 'TMDB' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'All movie details' }))
    expect(await screen.findByText('130 minutes')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'TMDB' })).toHaveAttribute(
      'href',
      'https://www.themoviedb.org/movie/753',
    )
    expect(screen.getByRole('link', { name: 'IMDb' })).toHaveAttribute(
      'href',
      'https://www.imdb.com/title/tt0062952/',
    )
    expect(screen.getByRole('region', { name: 'Credits and attribution' })).toHaveTextContent(
      'This product uses the TMDB API but is not endorsed or certified by TMDB.',
    )
    expect(screen.getByRole('img', { name: 'TMDB' })).toBeInTheDocument()
  })
  it('keeps missing posters usable and rejects malformed saved metadata', () => {
    const { container } = renderMovie({ ...movie, posterPath: null })
    expect(screen.queryByRole('img', { name: 'Faces' })).toBeNull()
    expect(container.querySelector('svg')).toBeTruthy()
    cleanup()
    expect(renderMovie({ ...movie, id: -1 }).container.querySelector('article')).toBeNull()
    expect(moviePosterUrl('//untrusted.example/image.jpg')).toBeUndefined()
  })
  it('omits the movie card from plain text presentations', () => {
    expect(renderMovie(movie, true).container.querySelector('article')).toBeNull()
  })
})
