import config from '@payload-config'
import { getPayload } from 'payload'

import { saveProfilePhoto } from '@/lib/profile'
import { currentReader } from '@/lib/reader'

export const dynamic = 'force-dynamic'

/**
 * The avatar upload's save. A route, not a server action, because only a
 * plain request lets the page report how much of the photo has been sent;
 * the checks are the action's (lib/profile). Server actions refuse other
 * origins on their own, so this route does it itself.
 */
export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== request.headers.get('host')) {
    return Response.json({ ok: false, error: 'photo' }, { status: 403 })
  }
  const user = await currentReader()
  if (!user) return Response.json({ ok: false, error: 'no-person' }, { status: 401 })
  const form = await request.formData().catch(() => null)
  const file = form?.get('photo')
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ ok: false, error: 'photo' }, { status: 400 })
  }
  const data = Buffer.from(await file.arrayBuffer())
  const result = await saveProfilePhoto(await getPayload({ config }), user, {
    data,
    mimetype: file.type,
    name: file.name,
    size: data.length,
  })
  return Response.json(result, { status: result.ok ? 200 : 400 })
}
