import type { Payload } from 'payload'

import { cache } from 'react'

/**
 * What a course or article page needs from Site settings, in one read per
 * render, so the contact email and the AI switch cost one query between them.
 */
export const pageSiteSettings = cache((payload: Payload) =>
  payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    select: { contact_emails: true, ai_buttons: true },
  }),
)
