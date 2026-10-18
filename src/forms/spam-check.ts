import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { isAdminUser } from '@/access'
import { TURNSTILE_HEADER, verifyTurnstile } from '@/lib/turnstile'

/**
 * Refuses a form submission without a good Turnstile token, so a bot cannot
 * post to /api/form-submissions directly. Off without the secret (development,
 * tests). The Local API (seed, scripts) and admins skip the check.
 */
export const requireTurnstile =
  (secret: string | undefined): CollectionBeforeChangeHook =>
  async ({ data, operation, req }) => {
    if (!secret || operation !== 'create') return data
    if (req.payloadAPI === 'local' || isAdminUser(req.user)) return data
    const token = req.headers.get(TURNSTILE_HEADER)
    const ip =
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (!token || !(await verifyTurnstile(token, secret, ip))) {
      throw new APIError('The spam check failed. Reload the page and try again.', 403)
    }
    return data
  }
