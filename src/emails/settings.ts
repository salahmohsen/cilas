import type { Payload, PayloadRequest } from 'payload'

import { env } from '@/env'
import type { Locale } from '@/i18n/routing'

import { defaultTexts, EMAIL_IDS, EMAILS, type EmailId, type Texts } from './catalog'

/**
 * What every email reads from the Email settings global, with a default for
 * each empty field. Texts carry {placeholders} that `fill` replaces.
 */

/** The English default of every text, by email (src/emails/catalog.ts). */
export const DEFAULT_TEXTS = Object.fromEntries(
  EMAIL_IDS.map((id) => [id, EMAILS[id].texts.en]),
) as { [K in EmailId]: (typeof EMAILS)[K]['texts']['en'] }

export type SocialLink = { platform: string; url: string; icon: string }

export type EmailSettings = {
  site: string
  logo: { url: string; alt: string }
  accent: string
  fromName: string
  replyTo: string | null
  tagline: string
  signoff: string
  footer: string
  /** The chosen place's address and map link (Email settings → Address). */
  address: { text: string; url: string | null }
  /** From Site settings → Contact, each with its icon (scripts/email-assets.mjs). */
  social: SocialLink[]
  texts: Texts
}

export type StoredEmailSettings = {
  logo?: unknown
  accent?: string | null
  from_name?: string | null
  reply_to?: string | null
  tagline?: string | null
  signoff?: string | null
  footer?: string | null
  address_place?: unknown
  texts?: { [K in keyof Texts]?: { [F in keyof Texts[K]]?: string | null } | null } | null
}

const DEFAULT_FOOTER = 'Cairo Institute of Liberal Arts and Sciences (CILAS)'
// A postal address: bulk email must carry one (CAN-SPAM). Used when no place is chosen.
const DEFAULT_ADDRESS = {
  text: '10 Darb El Labana, El Darb El Ahmar, Cairo 11311, Egypt',
  url: 'https://www.google.com/maps/search/?api=1&query=10%20Darb%20El%20Labana%2C%20El%20Darb%20El%20Ahmar%2C%20Cairo',
}
const DEFAULT_SIGNOFF = 'From CILAS, with love.'
const DEFAULT_TAGLINE = 'A pedagogy of discovery and attunement.'
const PLATFORMS: Record<string, string> = {
  facebook: 'Facebook',
  twitter: 'X',
  youtube: 'YouTube',
  instagram: 'Instagram',
}

type StoredSocial = Array<{ platform?: string | null; url?: string | null }> | null | undefined

const addressOf = (place: unknown): EmailSettings['address'] | null => {
  const s = place as { address?: string | null; map_url?: string | null } | null
  if (!s || typeof s !== 'object' || !s.address?.trim()) return null
  return { text: s.address.trim(), url: s.map_url?.startsWith('http') ? s.map_url : null }
}

export const withDefaults = (
  stored: StoredEmailSettings,
  {
    site = 'https://ci-las.org',
    social = [],
    locale = 'en',
    fallback,
  }: {
    site?: string
    social?: StoredSocial
    /** The language of the texts in `stored`. */
    locale?: Locale
    /** The English settings, read when `stored` is in another language. */
    fallback?: StoredEmailSettings
  } = {},
): EmailSettings => {
  const origin = site.replace(/\/+$/, '')
  // Saved text in the reader's language, then its default, then the saved
  // English text, then the English default. An email without Arabic defaults
  // thus sends the admin's English text to an Arabic reader, as before.
  const savedIn = (from: StoredEmailSettings | undefined, id: EmailId) =>
    (from?.texts as Record<string, Record<string, string | null> | null> | null | undefined)?.[id]
  const texts = {} as Record<string, Record<string, string>>
  for (const id of EMAIL_IDS) {
    const own = savedIn(stored, id)
    const english = savedIn(fallback, id)
    const localDefaults = defaultTexts(id, locale)
    const englishDefaults = defaultTexts(id, 'en')
    texts[id] = {}
    for (const field of Object.keys(englishDefaults)) {
      texts[id][field] =
        own?.[field]?.trim() ||
        (localDefaults !== englishDefaults ? localDefaults[field] : '') ||
        english?.[field]?.trim() ||
        englishDefaults[field]!
    }
  }
  const logo = stored.logo as { url?: string | null; alt?: string | null } | null | undefined
  return {
    site: origin,
    logo:
      logo && typeof logo === 'object' && logo.url
        ? { url: logo.url, alt: logo.alt || 'CILAS' }
        : { url: `${origin}/assets/email/logo.png`, alt: 'CILAS' },
    accent: /^#[0-9a-f]{6}$/i.test(stored.accent ?? '') ? stored.accent! : '#000000',
    fromName: stored.from_name?.trim() || 'CILAS',
    replyTo: stored.reply_to?.trim() || null,
    tagline: stored.tagline?.trim() || DEFAULT_TAGLINE,
    signoff: stored.signoff?.trim() || DEFAULT_SIGNOFF,
    footer: stored.footer?.trim() || DEFAULT_FOOTER,
    address: addressOf(stored.address_place) ?? DEFAULT_ADDRESS,
    social: (social ?? []).flatMap((s) =>
      s.platform && PLATFORMS[s.platform] && s.url?.startsWith('http')
        ? [
            {
              platform: PLATFORMS[s.platform],
              url: s.url,
              icon: `${origin}/assets/email/${s.platform}.png`,
            },
          ]
        : [],
    ),
    texts: texts as Texts,
  }
}

/**
 * The stored global in `locale` (past access), the English one beside it,
 * and the site's social links: what `withDefaults` builds the settings from.
 */
export const readEmailSettings = async (
  payload: Payload,
  req?: PayloadRequest,
  locale: Locale = 'en',
) => {
  const read = (lang: Locale) =>
    payload.findGlobal({
      slug: 'email-settings',
      depth: 1,
      overrideAccess: true,
      req,
      locale: lang,
      // No Payload fallback: withDefaults puts the Arabic defaults before the English text.
      fallbackLocale: false,
    }) as Promise<StoredEmailSettings>
  const [stored, fallback, site] = await Promise.all([
    read(locale),
    locale === 'en' ? undefined : read('en'),
    payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, req }),
  ])
  return { stored, fallback, social: site.social_links as StoredSocial, locale }
}

/**
 * The global with defaults filled in and the site's social links. `locale`
 * picks the language of the localized emails' texts (src/emails/catalog.ts);
 * see `withDefaults` for what an empty text reads as.
 */
export const getEmailSettings = async (
  payload: Payload,
  req?: PayloadRequest,
  locale: Locale = 'en',
) => {
  const { stored, ...rest } = await readEmailSettings(payload, req, locale)
  return withDefaults(stored, { site: env.NEXT_PUBLIC_SERVER_URL, ...rest })
}

/** Replaces each {key} with its value; unknown keys stay as written. */
export const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

/** A textarea's text as paragraphs: blank lines separate them. */
export const paragraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
