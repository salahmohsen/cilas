/** The header the site's forms send their Cloudflare Turnstile token in. */
export const TURNSTILE_HEADER = 'x-turnstile-token'

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
