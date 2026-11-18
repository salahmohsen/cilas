import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { mockNetwork } from '../../testing/msw-node.test-utils'
import { importWithEnv } from '../../testing/env.test-utils'

const network = mockNetwork()
const adapter = (token = 'test-token') =>
  importWithEnv({ TMDB_API_READ_TOKEN: token }, () => import('@/lib/tmdb'))

const upstream = {
  id: 753,
  title: 'Faces',
  original_title: 'Faces',
  release_date: '1968-11-24',
  poster_path: '/poster.jpg',
  overview: 'A synopsis.',
  runtime: 130,
  genres: [{ name: 'Drama' }],
  production_countries: [{ name: 'United States of America' }],
  credits: {
    cast: [{ name: 'Gena Rowlands', character: 'Jeannie' }],
    crew: [
      { name: 'John Cassavetes', department: 'Directing', job: 'Director' },
      { name: 'John Cassavetes', department: 'Writing', job: 'Writer' },
    ],
  },
  external_ids: { imdb_id: 'tt0062952' },
}

describe('TMDB server adapter', () => {
  it('searches without adult results and keeps the token out of URLs and results', async () => {
    const seen: Request[] = []
    network.use(
      http.get('https://api.themoviedb.org/3/search/movie', ({ request }) => {
        seen.push(request)
        return HttpResponse.json({ results: [upstream] })
      }),
    )
    const { searchMovies } = await adapter()
    expect(await searchMovies('Faces', 'en-US')).toEqual([
      {
        id: 753,
        title: 'Faces',
        originalTitle: 'Faces',
        releaseDate: '1968-11-24',
        posterPath: '/poster.jpg',
      },
    ])
    expect(seen).toHaveLength(1)
    expect(seen[0]!.url).toContain('include_adult=false')
    expect(seen[0]!.url).not.toContain('test-token')
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer test-token')
  })
  it('normalizes full credits and falls back to English when a translation has no overview', async () => {
    const languages: (string | null)[] = []
    network.use(
      http.get('https://api.themoviedb.org/3/movie/753', ({ request }) => {
        const language = new URL(request.url).searchParams.get('language')
        languages.push(language)
        return HttpResponse.json(language === 'en-US' ? upstream : { ...upstream, overview: '' })
      }),
    )
    const { readMovie } = await adapter()
    const result = await readMovie(753, 'ar-EG')
    expect(result).toMatchObject({
      source: 'tmdb',
      id: 753,
      runtime: 130,
      directors: ['John Cassavetes'],
      writers: ['John Cassavetes'],
      imdbId: 'tt0062952',
      overview: 'A synopsis.',
    })
    expect(result.crew).toHaveLength(2)
    expect(languages).toEqual(['ar-EG', 'en-US'])
  })
  it('reports missing credentials without making an upstream request', async () => {
    const { searchMovies } = await adapter('')
    await expect(searchMovies('Faces', 'en-US')).rejects.toMatchObject({ status: 503 })
  })
  it('preserves rate-limit errors and rejects malformed provider data', async () => {
    const { readMovie } = await adapter()
    network.use(
      http.get(
        'https://api.themoviedb.org/3/movie/753',
        () => new HttpResponse('', { status: 429 }),
      ),
    )
    await expect(readMovie(753, 'en-US')).rejects.toMatchObject({ status: 429 })
    network.use(
      http.get('https://api.themoviedb.org/3/movie/753', () => HttpResponse.json({ id: 753 })),
    )
    await expect(readMovie(753, 'en-US')).rejects.toThrow()
  })
})
