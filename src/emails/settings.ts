import type { Payload, PayloadRequest } from 'payload'

import { env } from '@/env'

/**
 * What every email reads from the Email settings global, with a default for
 * each empty field. Texts carry {placeholders} that `fill` replaces.
 */

export const DEFAULT_TEXTS = {
  acceptance: {
    subject: 'You are accepted to {title}',
    body: 'Dear {name},\n\nYou are accepted to {title}.',
    new_account:
      'We made a CILAS account for {email}. To sign in, use “Continue with Google” if this is a Google address. If not, choose “Forgot password?” to set a password.',
    existing_account: 'Sign in with your CILAS account as usual.',
    button: 'Sign in',
  },
  review: {
    submitted_subject: 'Submitted for review: {title}',
    submitted: '“{title}” was submitted for review.',
    approved_subject: 'Published: {title}',
    approved: '“{title}” was approved and is now published.',
    changes_requested_subject: 'Changes requested: {title}',
    changes_requested: '“{title}” needs changes before it can be published.',
    rejected_subject: 'Not accepted: {title}',
    rejected: '“{title}” was not accepted for publication.',
    note_label: 'Note from the editor',
  },
  reset: {
    subject: 'Reset your CILAS password',
    body: 'Someone asked to reset the password for {email}. To choose a new password, use the button below. If this was not you, ignore this email: your password stays the same.',
    button: 'Choose a new password',
  },
  newsletter: {
    in_this_issue: 'In this issue',
    read: 'Read more',
    apply: 'Apply',
    unsubscribe: 'Unsubscribe',
  },
} as const

type Texts = {
  [K in keyof typeof DEFAULT_TEXTS]: { [F in keyof (typeof DEFAULT_TEXTS)[K]]: string }
}

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
  { site = 'https://ci-las.org', social = [] }: { site?: string; social?: StoredSocial } = {},
): EmailSettings => {
  const origin = site.replace(/\/+$/, '')
  const texts = {} as Record<string, Record<string, string>>
  for (const [group, fields] of Object.entries(DEFAULT_TEXTS)) {
    const saved = (stored.texts as Record<string, Record<string, string | null> | null> | null)?.[
      group
    ]
    texts[group] = {}
    for (const [field, fallback] of Object.entries(fields)) {
      texts[group][field] = saved?.[field]?.trim() || fallback
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

/** The global, read past access, with defaults filled in and the site's social links. */
export const getEmailSettings = async (payload: Payload, req?: PayloadRequest) => {
  const [stored, site] = await Promise.all([
    payload.findGlobal({ slug: 'email-settings', depth: 1, overrideAccess: true, req }),
    payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, req }),
  ])
  return withDefaults(stored as StoredEmailSettings, {
    site: env.NEXT_PUBLIC_SERVER_URL,
    social: site.social_links,
  })
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
