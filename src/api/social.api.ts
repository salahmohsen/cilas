import { getPayload } from 'payload'

import config from '@/payload.config'
import type { SOCIAL_PLATFORMS } from '@/fields/social'

export type SocialLink = { platform: (typeof SOCIAL_PLATFORMS)[number]; url: string }

/** The institute's social accounts, from Site settings, in their order there. */
export const getSocialLinks = async (): Promise<SocialLink[]> => {
  const payload = await getPayload({ config })
  // Every page's layout reads this: a failed read leaves the icons out, not the page.
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null)
  return (settings?.social_links ?? []).flatMap((s) =>
    s.platform && s.url ? [{ platform: s.platform, url: s.url }] : [],
  )
}
