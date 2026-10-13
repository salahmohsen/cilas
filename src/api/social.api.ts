import { getPayload } from 'payload'

import config from '@/payload.config'

export type SocialLink = { platform: 'facebook' | 'twitter' | 'youtube' | 'instagram'; url: string }

/** The institute's social accounts, from Site settings, in their order there. */
export const getSocialLinks = async (): Promise<SocialLink[]> => {
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  return (settings.social_links ?? []).flatMap((s) => (s.platform && s.url ? [{ platform: s.platform, url: s.url }] : []))
}
