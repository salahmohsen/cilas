import type { ReviewState } from '@/lib/review'

import { MessageEmail } from './message'
import { renderEmail } from './render'
import { fill, paragraphs, type EmailSettings } from './settings'

type Mail = { subject: string; html: string; text: string }

const origin = (site: string) => site.replace(/\/+$/, '')

export const acceptanceMail = async (
  settings: EmailSettings,
  data: { name: string; email: string; title: string; newAccount: boolean; site: string },
): Promise<Mail> => {
  const t = settings.texts.acceptance
  const values = { name: data.name, email: data.email, title: data.title }
  const subject = fill(t.subject, values)
  const body = [
    ...paragraphs(fill(t.body, values)),
    fill(data.newAccount ? t.new_account : t.existing_account, values),
  ]
  const rendered = await renderEmail(
    <MessageEmail
      settings={settings}
      preview={subject}
      heading={subject}
      kicker="Admissions"
      paragraphs={body}
      button={{ label: t.button, url: `${origin(data.site)}/en/login` }}
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
      kicker="Account"
      paragraphs={paragraphs(fill(t.body, { email: data.email }))}
      button={{ label: t.button, url: `${origin(data.site)}/admin/reset/${data.token}` }}
    />,
  )
  return { subject, ...rendered }
}
