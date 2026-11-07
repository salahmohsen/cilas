import type { PayloadRequest } from 'payload'

/** The header the site's forms send their Cloudflare Turnstile token in. */
export const TURNSTILE_HEADER = 'x-turnstile-token'
/** The file endpoint has already spent the token. */
export const TURNSTILE_VERIFIED = 'turnstileVerified'

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Asks Cloudflare whether a Turnstile token is good. A token passes once and
 * expires after five minutes. An unreachable Cloudflare counts as a failure.
 */
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip?: string | null,
): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)
  try {
    const res = await fetch(SITEVERIFY, { method: 'POST', body })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

/** Verify a request's token once, or allow requests when the check is disabled. */
export const checkTurnstile = async (req: PayloadRequest, secret: string | undefined) => {
  if (!secret) return true
  const token = req.headers.get(TURNSTILE_HEADER)
  const ip =
    req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return Boolean(token && (await verifyTurnstile(token, secret, ip)))
}
