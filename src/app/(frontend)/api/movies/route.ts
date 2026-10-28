import config from '@payload-config'
import { getPayload } from 'payload'

import { isAdminUser } from '@/access'
import { MovieApiError, readMovie, searchMovies } from '@/lib/tmdb'

export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user || user.collection !== 'users' || !isAdminUser(user)) {
    return Response.json(
      { error: 'An administrator must sign in to search movies.' },
      { status: 403 },
    )
  }
  const params = new URL(request.url).searchParams
  const language = params.get('locale') === 'ar' ? 'ar-EG' : 'en-US'
  const id = params.get('id')
  const query = params.get('query')?.trim() ?? ''
  if (
    id !== null ? !/^\d{1,9}$/.test(id) || Number(id) < 1 : query.length < 2 || query.length > 160
  ) {
    return Response.json({ error: 'Enter a movie title or choose a valid movie.' }, { status: 400 })
  }
  try {
    const data = id
      ? { movie: await readMovie(Number(id), language) }
      : { results: await searchMovies(query, language) }
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof MovieApiError
            ? error.message
            : 'Movie search is unavailable. Please try again.',
      },
      { status: error instanceof MovieApiError ? error.status : 502 },
    )
  }
}
