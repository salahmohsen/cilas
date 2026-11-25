import type { Payload } from 'payload'

import { cache } from 'react'

/**
 * The switches for the "Study with AI" buttons: one for the site (Site settings)
 * and one per space. A switch that was never set is on.
 */
type AiSwitch = { ai_buttons?: boolean | null } | null | undefined

/** `space` is passed only inside a space: there both switches must be on. */
export const aiButtonsOn = (site: AiSwitch, space?: AiSwitch): boolean =>
  site?.ai_buttons !== false && space?.ai_buttons !== false

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

/** The site switch, for pages outside a space. */
export const siteAiButtons = async (payload: Payload): Promise<boolean> =>
  aiButtonsOn(await pageSiteSettings(payload))
