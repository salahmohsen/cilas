import { afterEach, describe, expect, it, vi } from 'vitest'

import { readMovie, searchMovies } from '@/lib/tmdb'

const { settings } = vi.hoisted(() => ({
  settings: { TMDB_API_READ_TOKEN: 'test-token' as string | undefined },
}))
vi.mock('@/env', () => ({ env: settings }))
afterEach(() => {
  vi.unstubAllGlobals()
  settings.TMDB_API_READ_TOKEN = 'test-token'
})

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
    const fetch = vi.fn().mockResolvedValue(Response.json({ results: [upstream] }))
    vi.stubGlobal('fetch', fetch)
    expect(await searchMovies('Faces', 'en-US')).toEqual([
      {
        id: 753,
        title: 'Faces',
        originalTitle: 'Faces',
        releaseDate: '1968-11-24',
        posterPath: '/poster.jpg',
      },
    ])
    const [url, options] = fetch.mock.calls[0]
    expect(String(url)).toContain('include_adult=false')
    expect(String(url)).not.toContain('test-token')
    expect(options.headers.Authorization).toBe('Bearer test-token')
  })
  it('normalizes full credits and falls back to English when a translation has no overview', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ...upstream, overview: '' }))
      .mockResolvedValueOnce(Response.json(upstream))
    vi.stubGlobal('fetch', fetch)
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
    expect(String(fetch.mock.calls[1][0])).toContain('language=en-US')
  })
  it('reports missing credentials without making an upstream request', async () => {
    settings.TMDB_API_READ_TOKEN = undefined
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(searchMovies('Faces', 'en-US')).rejects.toMatchObject({ status: 503 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('preserves rate-limit errors and rejects malformed provider data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))
    await expect(readMovie(753, 'en-US')).rejects.toMatchObject({ status: 429 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ id: 753 })))
    await expect(readMovie(753, 'en-US')).rejects.toThrow()
  })
})
