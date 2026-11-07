import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { isAdminUser } from '@/access'
import { checkTurnstile, TURNSTILE_VERIFIED } from '@/lib/turnstile'

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
    // The files endpoint (src/forms/submit-with-files.ts) has spent the token already.
    if (req.context?.[TURNSTILE_VERIFIED]) return data
    if (!(await checkTurnstile(req, secret))) {
      throw new APIError('The spam check failed. Reload the page and try again.', 403)
    }
    return data
  }
