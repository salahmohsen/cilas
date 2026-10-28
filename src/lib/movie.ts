import { z } from 'zod'

export const movieSnapshotSchema = z.object({
  source: z.literal('tmdb'),
  id: z.number().int().positive(),
  title: z.string().min(1),
  originalTitle: z.string(),
  overview: z.string(),
  tagline: z.string(),
  releaseDate: z.string(),
  runtime: z.number().nonnegative().nullable(),
  genres: z.array(z.string()),
  countries: z.array(z.string()),
  languages: z.array(z.string()),
  originalLanguage: z.string(),
  studios: z.array(z.string()),
  directors: z.array(z.string()),
  writers: z.array(z.string()),
  cast: z.array(z.object({ name: z.string(), character: z.string() })),
  crew: z.array(z.object({ name: z.string(), job: z.string() })),
  posterPath: z
    .string()
    .regex(/^\/[a-zA-Z0-9_.-]+$/)
    .nullable(),
  imdbId: z
    .string()
    .regex(/^tt\d+$/)
    .nullable(),
  rating: z.number().min(0).max(10),
  voteCount: z.number().int().nonnegative(),
  budget: z.number().nonnegative(),
  revenue: z.number().nonnegative(),
  status: z.string(),
  fetchedAt: z.string().datetime(),
})

export type MovieSnapshot = z.infer<typeof movieSnapshotSchema>
export type MovieSearchResult = Pick<
  MovieSnapshot,
  'id' | 'title' | 'originalTitle' | 'releaseDate' | 'posterPath'
>

export const moviePosterUrl = (path: MovieSnapshot['posterPath']) =>
  path && /^\/[a-zA-Z0-9_.-]+$/.test(path) ? `https://image.tmdb.org/t/p/w500${path}` : undefined
