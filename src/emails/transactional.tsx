import type { Locale } from '@/i18n/routing'
import { isolate } from '@/lib/bidi'
import type { ReviewState } from '@/lib/review'

import { MessageEmail } from './message'
import { renderEmail } from './render'
import { fill, paragraphs, type EmailSettings } from './settings'

type Mail = { subject: string; html: string; text: string }

const origin = (site: string) => site.replace(/\/+$/, '')

/** The word at the top right of an application email. */
const ADMISSIONS: Record<Locale, string> = { en: 'Admissions', ar: 'القبول' }

/** The word at the top right of an account email. */
const ACCOUNT: Record<Locale, string> = { en: 'Account', ar: 'الحساب' }

/**
 * Isolates each value in an Arabic email, so a Latin name or title keeps its
 * own direction inside right-to-left text (the UI uses <bdi>). The text parts
 * are plain strings, so the isolates stand in for the tag.
 */
const isolated = (values: Record<string, string>, locale: Locale): Record<string, string> =>
  locale === 'ar'
    ? Object.fromEntries(Object.entries(values).map(([k, v]) => [k, isolate(v)]))
    : values

export const acceptanceMail = async (
  settings: EmailSettings,
  data: {
    name: string
    email: string
    title: string
    /** For a new account: its set-password link (src/lib/invitation.ts). */
    setPassword: { url: string; days: number } | null
    site: string
  },
): Promise<Mail> => {
  const { locale } = settings
  const t = settings.texts.acceptance
  const values = {
    ...isolated({ name: data.name, email: data.email, title: data.title }, locale),
    days: String(data.setPassword?.days ?? ''),
  }
  const subject = fill(t.subject, values)
  const body = [
    ...paragraphs(fill(t.body, values)),
    fill(data.setPassword ? t.new_account : t.existing_account, values),
  ]
  const rendered = await renderEmail(
    <MessageEmail
      settings={settings}
      preview={subject}
      heading={subject}
      kicker={ADMISSIONS[locale]}
      lang={locale}
      paragraphs={body}
      button={
        data.setPassword
          ? { label: t.new_account_button, url: data.setPassword.url }
          : { label: t.button, url: `${origin(data.site)}/${locale}/login` }
      }
    />,
  )
  return { subject, ...rendered }
}

/** A new account, made by an admin: a link to set its password (src/lib/invitation.ts). */
export const invitationMail = async (
  settings: EmailSettings,
  data: { name: string; email: string; url: string; days: number },
): Promise<Mail> => {
  const { locale } = settings
  const t = settings.texts.invitation
  const values = {
    ...isolated({ name: data.name, email: data.email }, locale),
    days: String(data.days),
  }
  const subject = fill(t.subject, values)
  const rendered = await renderEmail(
    <MessageEmail
      settings={settings}
      preview={subject}
      heading={subject}
      kicker={ACCOUNT[locale]}
      lang={locale}
      paragraphs={[...paragraphs(fill(t.body, values)), fill(t.google, values)]}
      button={{ label: t.button, url: data.url }}
    />,
  )
  return { subject, ...rendered }
}

/** Sent when one course of an application is rejected. Kind and plain; no button. */
export const rejectionMail = async (
  settings: EmailSettings,
  data: { name: string; email: string; title: string },
): Promise<Mail> => {
  const { locale } = settings
  const t = settings.texts.rejection
  const values = isolated({ name: data.name, email: data.email, title: data.title }, locale)
  const subject = fill(t.subject, values)
  const rendered = await renderEmail(
    <MessageEmail
      settings={settings}
      preview={subject}
      heading={subject}
      kicker={ADMISSIONS[locale]}
      lang={locale}
      paragraphs={paragraphs(fill(t.body, values))}
    />,
  )
  return { subject, ...rendered }
}

type ReviewKey = 'submitted' | 'approved' | 'changes_requested' | 'rejected'
const REVIEW_KEYS: ReviewKey[] = ['submitted', 'approved', 'changes_requested', 'rejected']

/** States whose email carries the editor's note. */
const NOTE_STATES: ReviewState[] = ['changes_requested', 'rejected']

/** A review notification (src/lib/review-mail.ts). */
export const reviewMail = async (
  settings: EmailSettings,
  state: ReviewState,
  title: string,
  note?: string | null,
  /** What is reviewed and, with `url`, a button that opens it in the admin. */
  about: { noun?: string; url?: string } = {},
): Promise<Mail> => {
  const noun = about.noun ?? 'article'
  const t = settings.texts.review
  const key: ReviewKey = REVIEW_KEYS.includes(state as ReviewKey)
    ? (state as ReviewKey)
    : 'submitted'
  const subject = fill(t[`${key}_subject`], { title })
  const withNote = note && NOTE_STATES.includes(state)
  const rendered = await renderEmail(
    <MessageEmail
      settings={settings}
      preview={subject}
      heading={subject}
      kicker={`${noun[0]!.toUpperCase()}${noun.slice(1)} review`}
      paragraphs={paragraphs(fill(t[key], { title }))}
      note={withNote ? { label: t.note_label, text: note } : null}
      button={about.url ? { label: `Open the ${noun}`, url: about.url } : undefined}
    />,
  )
  return { subject, ...rendered }
}

/**
 * The password reset email. The link is absolute: Payload builds it from
 * `serverURL`, which is not set (see src/collections/Users.ts).
 */
export const resetMail = async (
  settings: EmailSettings,
  data: { email: string; token: string; site: string },
): Promise<Mail> => {
  const t = settings.texts.reset
  const subject = fill(t.subject, { email: data.email })
  const rendered = await renderEmail(
    <MessageEmail
      settings={settings}
      preview={subject}
      heading={subject}
      kicker={ACCOUNT.en}
      paragraphs={paragraphs(fill(t.body, { email: data.email }))}
      button={{ label: t.button, url: `${origin(data.site)}/admin/reset/${data.token}` }}
    />,
  )
  return { subject, ...rendered }
}
