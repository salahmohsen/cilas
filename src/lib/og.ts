/**
 * The picture a shared link shows when a page has no image of its own (an
 * SEO image or a cover): the CILAS rooftop room, cut to the 1200×630 that
 * social cards use.
 */
export const DEFAULT_OG_IMAGE = {
  url: '/assets/images/og-default.jpg',
  width: 1200,
  height: 630,
  alt: 'The CILAS classroom',
}

export const ogImages = (url?: string | null) => (url ? [{ url }] : [DEFAULT_OG_IMAGE])
