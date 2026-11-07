import { getPayload } from 'payload'
import config from '@payload-config'
import { privateClient, privateSearchEnabled } from '@/lib/private-search/config'
import { CursorReset, inputSchema } from '@/lib/private-search/model'
import {
  permissionEnvelope,
  searchPrivate,
  SelectionDenied,
  spaceOptions,
} from '@/lib/private-search/search'
import { rateAllowed } from '@/lib/private-search/rate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Vary: 'Cookie, Authorization',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })

export async function POST(request: Request) {
  try {
    if (!privateSearchEnabled()) return reply({ error: 'unavailable' }, 404)
    const payload = await getPayload({ config })
    const authHeaders = new Headers(request.headers)
    authHeaders.set('DisableAutologin', 'true')
    const { user } = await payload.auth({ headers: authHeaders })
    if (!user || user.collection !== 'users') return reply({ error: 'unauthenticated' }, 401)
    // Do not trust forwarded headers without a deployment-specific proxy contract.
    if (!(await rateAllowed(payload, user.id, 'untrusted-proxy', payload.secret)))
      return reply({ error: 'rate-limited' }, 429)
    const declaredSize = Number(request.headers.get('content-length') ?? 0)
    if (!Number.isFinite(declaredSize) || declaredSize > 65536)
      return reply({ error: 'invalid-input' }, 400)
    const reader = request.body?.getReader()
    if (!reader) return reply({ error: 'invalid-input' }, 400)
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 65536) {
        await reader.cancel()
        return reply({ error: 'invalid-input' }, 400)
      }
      chunks.push(value)
    }
    let raw: unknown
    try {
      raw = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      return reply({ error: 'invalid-input' }, 400)
    }
    // Options use the same authorization path and never contact Typesense.
    if (raw && typeof raw === 'object' && 'options' in raw && raw.options === true) {
      const keys = Object.keys(raw)
      const locale = 'locale' in raw ? raw.locale : 'en'
      if (
        keys.some((key) => key !== 'options' && key !== 'locale') ||
        (locale !== 'en' && locale !== 'ar')
      )
        return reply({ error: 'invalid-input' }, 400)
      const envelope = await permissionEnvelope(payload, user, {})
      return reply({
        spaces: await spaceOptions(payload, user, envelope, locale),
        account: user.id,
      })
    }
    const parsed = inputSchema.safeParse(raw)
    if (!parsed.success) return reply({ error: 'invalid-input' }, 400)
    return reply(
      await searchPrivate({
        payload,
        user,
        input: parsed.data,
        client: privateClient('read'),
        secret: payload.secret,
      }),
    )
  } catch (error) {
    if (error instanceof CursorReset) return reply({ error: 'restart' }, 409)
    if (error instanceof SelectionDenied) return reply({ error: 'inaccessible-space' }, 403)
    // Neither engine errors nor queries reach logs or HTTP responses.
    return reply({ error: 'unavailable' }, 503)
  }
}
