import { z } from 'zod'

import { env } from '@/env'
import { movieSnapshotSchema, type MovieSearchResult } from '@/lib/movie'

const named = z.object({ name: z.string() })
const baseMovie = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  original_title: z.string(),
  release_date: z.string().default(''),
  poster_path: z.string().nullable().default(null),
})

const detailsSchema = baseMovie.extend({
  overview: z.string().nullable().default(''),
  tagline: z.string().nullable().default(''),
  runtime: z.number().nullable().default(null),
  genres: z.array(named).default([]),
  production_countries: z.array(named).default([]),
  spoken_languages: z.array(z.object({ english_name: z.string() })).default([]),
  original_language: z.string().default(''),
  production_companies: z.array(named).default([]),
  credits: z.object({
    cast: z.array(named.extend({ character: z.string().default('') })).default([]),
    crew: z.array(named.extend({ job: z.string(), department: z.string() })).default([]),
  }),
  external_ids: z.object({ imdb_id: z.string().nullable().default(null) }),
  vote_average: z.number().default(0),
  vote_count: z.number().default(0),
  budget: z.number().default(0),
  revenue: z.number().default(0),
  status: z.string().default(''),
})

export class MovieApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function tmdb(path: string, parameters: Record<string, string>) {
  if (!env.TMDB_API_READ_TOKEN)
    throw new MovieApiError(
      'Movie search needs a TMDB API Read Access Token in server settings.',
      503,
    )
  const url = new URL(`https://api.themoviedb.org/3/${path}`)
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.TMDB_API_READ_TOKEN}`, accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  })
  if (response.status === 429)
    throw new MovieApiError('Movie search is busy. Please try again shortly.', 429)
  if (!response.ok)
    throw new MovieApiError(
      'TMDB could not load this movie. Check the server token and try again.',
      502,
    )
  return response.json() as Promise<unknown>
}

export async function searchMovies(query: string, language: string): Promise<MovieSearchResult[]> {
  const data = z.object({ results: z.array(baseMovie) }).parse(
    await tmdb('search/movie', {
      query,
      language,
      include_adult: 'false',
      page: '1',
    }),
  )
  return data.results.map((movie) => ({
    id: movie.id,
    title: movie.title,
    originalTitle: movie.original_title,
    releaseDate: movie.release_date,
    posterPath: movie.poster_path,
  }))
}

export async function readMovie(id: number, language: string) {
  const parameters = { language, append_to_response: 'credits,external_ids' }
  const movie = detailsSchema.parse(await tmdb(`movie/${id}`, parameters))
  const fallback =
    language !== 'en-US' && !movie.overview
      ? detailsSchema.parse(await tmdb(`movie/${id}`, { ...parameters, language: 'en-US' }))
      : movie
  const crew = movie.credits.crew
  return movieSnapshotSchema.parse({
    source: 'tmdb',
    id: movie.id,
    title: movie.title || fallback.title,
    originalTitle: movie.original_title,
    overview: movie.overview || fallback.overview || '',
    tagline: movie.tagline || fallback.tagline || '',
    releaseDate: movie.release_date,
    runtime: movie.runtime,
    genres: movie.genres.map(({ name }) => name),
    countries: movie.production_countries.map(({ name }) => name),
    languages: movie.spoken_languages.map(({ english_name }) => english_name),
    originalLanguage: movie.original_language,
    studios: movie.production_companies.map(({ name }) => name),
    directors: crew.filter(({ job }) => job === 'Director').map(({ name }) => name),
    writers: [
      ...new Set(crew.filter(({ department }) => department === 'Writing').map(({ name }) => name)),
    ],
    cast: movie.credits.cast,
    crew,
    posterPath: movie.poster_path || fallback.poster_path,
    imdbId: movie.external_ids.imdb_id,
    rating: movie.vote_average,
    voteCount: movie.vote_count,
    budget: movie.budget,
    revenue: movie.revenue,
    status: movie.status,
    fetchedAt: new Date().toISOString(),
  })
}
