import { env } from '@/env'

const API = 'https://api.resend.com'

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * One call to Resend with the server's key. Resend allows 10 requests a
 * second for the whole team, transactional mail included: a 429 waits as long
 * as its retry-after says, three times at most.
 */
export const resend = async (path: string, init: RequestInit = {}) => {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not set on the server.')
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
    if (res.status === 429 && attempt < 3) {
      await wait(Math.max(1, Number(res.headers.get('retry-after')) || 1) * 1000)
      continue
    }
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: res.ok, status: res.status, body }
  }
}
