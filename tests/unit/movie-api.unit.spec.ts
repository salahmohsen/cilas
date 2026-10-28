import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/(frontend)/api/movies/route'
import { readMovie, searchMovies } from '@/lib/tmdb'
import { movie } from '../fixtures/movie'

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({ auth }) }))
vi.mock('@/lib/tmdb', () => ({
  readMovie: vi.fn(),
  searchMovies: vi.fn(),
  MovieApiError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message)
    }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  auth.mockResolvedValue({ user: { id: 1, collection: 'users', roles: ['admin'] } })
})

describe('admin movie search API', () => {
  it.each([null, { collection: 'users', roles: ['member'] }])(
    'rejects visitors and non-admin users before calling TMDB',
    async (user) => {
      auth.mockResolvedValue({ user })
      expect((await GET(new Request('http://localhost/api/movies?query=Faces'))).status).toBe(403)
      expect(searchMovies).not.toHaveBeenCalled()
    },
  )
  it('searches in the selected content language with a private response', async () => {
    vi.mocked(searchMovies).mockResolvedValue([])
    const response = await GET(new Request('http://localhost/api/movies?query=Faces&locale=ar'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(searchMovies).toHaveBeenCalledWith('Faces', 'ar-EG')
  })
  it('returns a saved metadata snapshot after selecting an integer movie ID', async () => {
    vi.mocked(readMovie).mockResolvedValue(movie)
    const response = await GET(new Request('http://localhost/api/movies?id=753'))
    expect(await response.json()).toEqual({ movie })
    expect(readMovie).toHaveBeenCalledWith(753, 'en-US')
  })
  it.each(['id=https://example.com', 'id=-1', 'query=a'])(
    'rejects invalid search input: %s',
    async (parameters) => {
      expect((await GET(new Request(`http://localhost/api/movies?${parameters}`))).status).toBe(400)
      expect(readMovie).not.toHaveBeenCalled()
      expect(searchMovies).not.toHaveBeenCalled()
    },
  )
})
