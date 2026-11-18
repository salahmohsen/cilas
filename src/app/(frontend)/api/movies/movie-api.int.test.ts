import { http, HttpResponse } from 'msw'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../../../../testing/local-services.test-utils'
import { mockNetwork } from '../../../../../testing/msw-node.test-utils'
import { movie } from '../../../../../testing/movie.fixture'
import { createTracker, uniqEmail } from '../../../../../testing/payload.fixture'
import { signedInHeaders } from '../../../../../testing/reader.test-utils'

const upstreamMovie = {
  id: movie.id,
  title: movie.title,
  original_title: movie.originalTitle,
  release_date: movie.releaseDate,
  poster_path: movie.posterPath,
  overview: movie.overview,
  tagline: movie.tagline,
  runtime: movie.runtime,
  genres: movie.genres.map((name) => ({ name })),
  production_countries: movie.countries.map((name) => ({ name })),
  spoken_languages: movie.languages.map((english_name) => ({ english_name })),
  original_language: movie.originalLanguage,
  production_companies: movie.studios.map((name) => ({ name })),
  credits: {
    cast: movie.cast,
    crew: movie.crew.map((member) => ({ ...member, department: 'Writing' })),
  },
  external_ids: { imdb_id: movie.imdbId },
  vote_average: movie.rating,
  vote_count: movie.voteCount,
  budget: movie.budget,
  revenue: movie.revenue,
  status: movie.status,
}

const tmdbRequests: URL[] = []
mockNetwork(
  ...localServices,
  http.get('https://api.themoviedb.org/3/search/movie', ({ request }) => {
    tmdbRequests.push(new URL(request.url))
    return HttpResponse.json({ results: [] })
  }),
  http.get('https://api.themoviedb.org/3/movie/753', ({ request }) => {
    tmdbRequests.push(new URL(request.url))
    return HttpResponse.json(upstreamMovie)
  }),
)

beforeEach(() => {
  tmdbRequests.length = 0
})

let payload: Payload
let GET: typeof import('@/app/(frontend)/api/movies/route').GET
const { track, cleanup } = createTracker()
const accounts = new Map<string, { email: string; password: string }>()

const account = async (key: string, roles: User['roles']) => {
  const password = crypto.randomUUID()
  const email = uniqEmail(`movie-api-${key}`)
  track(
    'users',
    await payload.create({
      collection: 'users',
      data: { email, password, roles },
      overrideAccess: true,
    }),
  )
  accounts.set(key, { email, password })
}

const request = async (query: string, who: string | null = 'admin') =>
  GET(
    new Request(`http://localhost/api/movies?${query}`, {
      headers: who ? await signedInHeaders(payload, accounts.get(who)!) : {},
    }),
  )

beforeAll(async () => {
  vi.stubEnv('TMDB_API_READ_TOKEN', 'test-token')
  vi.resetModules()
  GET = (await import('@/app/(frontend)/api/movies/route')).GET
  payload = await getPayload({ config: await config })
  await account('admin', ['admin'])
  await account('member', ['member'])
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('admin movie search API', () => {
  it.each([null, 'member'])(
    'rejects visitors and non-admin users before calling TMDB',
    async (who) => {
      expect((await request('query=Faces', who)).status).toBe(403)
      expect(tmdbRequests).toHaveLength(0)
    },
  )
  it('searches in the selected content language with a private response', async () => {
    const response = await request('query=Faces&locale=ar')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(tmdbRequests[0]!.searchParams.get('query')).toBe('Faces')
    expect(tmdbRequests[0]!.searchParams.get('language')).toBe('ar-EG')
  })
  it('returns a saved metadata snapshot after selecting an integer movie ID', async () => {
    const response = await request('id=753')
    expect(await response.json()).toEqual({ movie: { ...movie, fetchedAt: expect.any(String) } })
    expect(tmdbRequests[0]!.searchParams.get('language')).toBe('en-US')
  })
  it.each(['id=https://example.com', 'id=-1', 'query=a'])(
    'rejects invalid search input: %s',
    async (parameters) => {
      expect((await request(parameters)).status).toBe(400)
      expect(tmdbRequests).toHaveLength(0)
    },
  )
})
