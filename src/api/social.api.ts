import { getPayload } from 'payload'

import config from '@/payload.config'
import { navigationOf, type Navigation } from '@/lib/navigation'

export type SocialLink = { platform: 'facebook' | 'twitter' | 'youtube' | 'instagram'; url: string }

/** The institute's social accounts, from Site settings, in their order there. */
export const getSocialLinks = async (): Promise<SocialLink[]> => {
  const payload = await getPayload({ config })
  // Every page's layout reads this: a failed read leaves the icons out, not the page.
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null)
  return (settings?.social_links ?? []).flatMap((s) =>
    s.platform && s.url ? [{ platform: s.platform, url: s.url }] : [],
  )
}

/** What the header and footer menus show (Site settings → Navigation). */
export const getNavigation = async (): Promise<Navigation> => {
  const payload = await getPayload({ config })
  // A failed read (say, before its migration) shows every item.
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null)
  return navigationOf(settings?.navigation)
}
