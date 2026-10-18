import type { Payload, PayloadRequest } from 'payload'

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
    read: 'Read more',
    apply: 'Apply',
    unsubscribe: 'Unsubscribe',
  },
} as const

type Texts = { [K in keyof typeof DEFAULT_TEXTS]: { [F in keyof (typeof DEFAULT_TEXTS)[K]]: string } }

export type EmailSettings = {
  logo: { url: string; alt: string } | null
  accent: string
  fromName: string
  replyTo: string | null
  footer: string
  texts: Texts
}

/** The global as stored: any field may be empty. */
export type StoredEmailSettings = {
  logo?: unknown
  accent?: string | null
  from_name?: string | null
  reply_to?: string | null
  footer?: string | null
  texts?: { [K in keyof Texts]?: { [F in keyof Texts[K]]?: string | null } | null } | null
}

const DEFAULT_FOOTER = 'Cairo Institute for Liberal Arts and Sciences (CILAS)\nCairo, Egypt'

export const withDefaults = (stored: StoredEmailSettings): EmailSettings => {
  const texts = {} as Record<string, Record<string, string>>
  for (const [group, fields] of Object.entries(DEFAULT_TEXTS)) {
    const saved = (stored.texts as Record<string, Record<string, string | null> | null> | null)?.[group]
    texts[group] = {}
    for (const [field, fallback] of Object.entries(fields)) {
      texts[group][field] = saved?.[field]?.trim() || fallback
    }
  }
  const logo = stored.logo as { url?: string | null; alt?: string | null } | null | undefined
  return {
    logo: logo && typeof logo === 'object' && logo.url ? { url: logo.url, alt: logo.alt || 'CILAS' } : null,
    accent: /^#[0-9a-f]{6}$/i.test(stored.accent ?? '') ? stored.accent! : '#000000',
    fromName: stored.from_name?.trim() || 'CILAS',
    replyTo: stored.reply_to?.trim() || null,
    footer: stored.footer?.trim() || DEFAULT_FOOTER,
    texts: texts as Texts,
  }
}

/** The global, read past access, with defaults filled in. */
export const getEmailSettings = async (payload: Payload, req?: PayloadRequest) =>
  withDefaults(
    (await payload.findGlobal({
      slug: 'email-settings',
      depth: 1,
      overrideAccess: true,
      req,
    })) as StoredEmailSettings,
  )

/** Replaces each {key} with its value; unknown keys stay as written. */
export const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

/** A textarea's text as paragraphs: blank lines separate them. */
export const paragraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
