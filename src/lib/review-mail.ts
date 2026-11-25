import { ADMIN_ROLES } from '@/access'
import type { PayloadRequest } from 'payload'

import { getEmailSettings } from '@/emails/settings'
import { reviewMail } from '@/emails/transactional'
import { localeOf, type Locale } from '@/i18n/routing'
import { absoluteLink, documentHref, type DocumentTarget } from '@/lib/document-href'
import { readPreferences, wantsChannel } from '@/lib/notification-preferences'
import { relId } from '@/lib/relation'
import type { ReviewState } from '@/lib/review'
import { withSavepoint } from '@/lib/savepoint'

export type Recipient = { id: number; email: string }

/** A recipient of a review email, with the language its link opens in. */
export type LocalRecipient = Recipient & { locale: Locale }

const recipientsOf = (docs: Array<{ id: number; email?: string | null }>): Recipient[] =>
  docs.flatMap((d) => (d.email ? [{ id: d.id, email: d.email }] : []))

export const adminRecipients = async (req: PayloadRequest): Promise<Recipient[]> => {
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { roles: { in: ADMIN_ROLES } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
  })
  return recipientsOf(docs)
}

export const ownerRecipients = async (
  req: PayloadRequest,
  people: number[],
): Promise<Recipient[]> => {
  if (!people.length) return []
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { person: { in: people } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
  })
  return recipientsOf(docs)
}

/**
 * The recipients who have not turned this kind's email off (Settings →
 * Notifications). A failed read keeps everyone: the default is to send.
 */
const wantingEmail = async (
  req: PayloadRequest,
  people: Recipient[],
  kind: string,
): Promise<Recipient[]> => {
  if (!people.length) return people
  try {
    const { docs } = await withSavepoint(req, (scoped) =>
      req.payload.find({
        collection: 'users',
        where: { id: { in: people.map((p) => p.id) } },
        depth: 0,
        limit: people.length,
        pagination: false,
        overrideAccess: true,
        select: { notification_preferences: true },
        req: scoped,
      }),
    )
    const refused = new Set(
      docs
        .filter((u) => !wantsChannel(readPreferences(u.notification_preferences), 'email', kind))
        .map((u) => u.id),
    )
    return people.filter((p) => !refused.has(p.id))
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Email preferences not read; sending to all' })
    return people
  }
}

/**
 * Adds the language each account last saved (space-preferences), else the
 * site's default. A failed read keeps everyone, in the default.
 */
const withLocale = async (req: PayloadRequest, people: Recipient[]): Promise<LocalRecipient[]> => {
  if (!people.length) return []
  const saved = new Map<unknown, unknown>()
  try {
    const { docs } = await withSavepoint(req, (scoped) =>
      req.payload.find({
        collection: 'space-preferences',
        where: { account: { in: people.map((p) => p.id) } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
        select: { account: true, locale: true },
        req: scoped,
      }),
    )
    for (const row of docs) saved.set(relId(row.account), row.locale)
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Email languages not read; using the default' })
  }
  return people.map((p) => ({ ...p, locale: localeOf(saved.get(p.id)) }))
}

/** Who gets this kind of email, each with the language for their link. */
export const emailRecipients = async (
  req: PayloadRequest,
  people: Recipient[],
  kind: string,
): Promise<LocalRecipient[]> => withLocale(req, await wantingEmail(req, people, kind))

/** The link in a review email to this recipient. */
export const reviewEmailUrl = (recipient: LocalRecipient, target: DocumentTarget): string =>
  absoluteLink(documentHref(target), recipient.locale)

/**
 * One message to one address, so no recipient sees another's.
 *
 * The settings are read without `req`, so a failed read cannot roll back the
 * request's transaction. `withSavepoint` cannot hold this read: it populates.
 */
export const sendReviewEmail = async (
  req: PayloadRequest,
  recipient: Recipient,
  state: ReviewState,
  title: string,
  note: string | null | undefined,
  about: { noun: string; url: string },
): Promise<void> => {
  try {
    const mail = await reviewMail(await getEmailSettings(req.payload), state, title, note, about)
    await req.payload.sendEmail({ to: recipient.email, ...mail })
  } catch (error) {
    req.payload.logger.error({ err: error, msg: `Review email for "${title}" failed` })
  }
}
