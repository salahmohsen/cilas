import type { Payload } from 'payload'

import { pageSiteSettings } from '@/lib/site-settings'

type AiSwitch = { ai_buttons?: boolean | null } | null | undefined

/**
 * The switches for the "Study with AI" buttons: one for the site (Site settings)
 * and one per space. A switch that was never set is on. `space` is passed only
 * inside a space: there both switches must be on.
 */
export const aiButtonsOn = (site: AiSwitch, space?: AiSwitch): boolean =>
  site?.ai_buttons !== false && space?.ai_buttons !== false

/** The site switch, for pages outside a space. */
export const siteAiButtons = async (payload: Payload): Promise<boolean> =>
  aiButtonsOn(await pageSiteSettings(payload))
