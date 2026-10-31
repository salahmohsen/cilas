import { createTranslator } from 'next-intl'
import type { Payload } from 'payload'
import webpush from 'web-push'

import { readPreferences, wantsChannel } from '@/lib/notification-preferences'
import { EVENT_NAMES, type NotificationKind } from '@/lib/notify'
import { pushConfig, type PushConfig } from '@/lib/push/config'
import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'

/** The Web Push limit is about 4 KB; stay well under it. */
const MAX_BYTES = 3500
const ICON = '/assets/icons/icon-192.png'
/** A link longer than this is not worth the room in a push: the device opens home. */
const MAX_URL_BYTES = 512

/**
 * A path of this site, or home. `//host` and `/\\host` are addresses of other
 * sites to a browser, so they do not count as paths.
 */
const pathOf = (link: string | null | undefined): string =>
  link &&
  link.startsWith('/') &&
  !link.startsWith('//') &&
  !link.startsWith('/\\') &&
  Buffer.byteLength(link) <= MAX_URL_BYTES
    ? link
    : '/'

/** What a stored notification carries into a push: no more than the bell shows. */
export type PushNote = {
  id: number
  recipient: number
  kind: string
  description?: string | null
  link?: string | null
}

export type PushSubscriptionRow = {
  id: number | string
  endpoint: string
  p256dh: string
  auth: string
  locale?: string | null
}

/** The one call to a push service; swapped in tests. */
export type PushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  body: string,
  config: PushConfig,
) => Promise<unknown>

const send: PushSender = (subscription, body, config) =>
  webpush.sendNotification(subscription, body, {
    TTL: 60 * 60 * 24,
    urgency: 'normal',
    timeout: 10_000,
    vapidDetails: {
      subject: config.subject,
      publicKey: config.publicKey,
      privateKey: config.privateKey,
    },
  })

const MESSAGES = { en, ar } as const

/** The push body for one device: the kind in the device's language, then the note's own line. */
export const pushBody = (note: PushNote, locale: string | null | undefined): string => {
  const lang = locale === 'ar' ? 'ar' : 'en'
  const t = createTranslator({
    locale: lang,
    messages: MESSAGES[lang],
    namespace: 'Notifications.kinds',
  })
  const known = note.kind in EVENT_NAMES
  const title = known ? t(note.kind as NotificationKind) : 'CILAS'
  const make = (description: string | null | undefined) =>
    JSON.stringify({
      title,
      body: description ?? '',
      // A path stays on this site: the service worker resolves it against its own origin.
      url: pathOf(note.link),
      tag: `cilas-${note.id}`,
      icon: ICON,
    })
  let description = note.description?.trim() || null
  let json = make(description)
  // Every other field is small (the title is a fixed label, the url is capped),
  // so cutting the line always ends: an empty line leaves a few hundred bytes.
  while (description && Buffer.byteLength(json) > MAX_BYTES) {
    const cut = description.slice(0, Math.floor(description.length * 0.7)).trimEnd()
    description = cut.length > 1 ? `${cut}…` : null
    json = make(description)
  }
  return json
}

type Deps = { config?: PushConfig | null; sender?: PushSender }

/** The status a push service answered with, if it answered. */
const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error && 'statusCode' in error
    ? Number((error as { statusCode: unknown }).statusCode)
    : undefined

/**
 * Sends a stored notification to the recipient's devices when their
 * preferences allow it. A push service that says the device is gone (404 or
 * 410) loses its row. Never throws: a failed push must not undo the
 * notification that caused it.
 */
export const sendPushForNotification = async (
  payload: Payload,
  note: PushNote,
  deps: Deps = {},
): Promise<void> => {
  try {
    const config = deps.config === undefined ? pushConfig() : deps.config
    if (!config) return
    const user = await payload.findByID({
      collection: 'users',
      id: note.recipient,
      depth: 0,
      overrideAccess: true,
      select: { notification_preferences: true },
    })
    if (!wantsChannel(readPreferences(user.notification_preferences), 'push', note.kind)) return
    const { docs } = await payload.find({
      collection: 'push-subscriptions',
      where: { user: { equals: note.recipient } },
      depth: 0,
      limit: 50,
      pagination: false,
      overrideAccess: true,
    })
    const sender = deps.sender ?? send
    await Promise.all(
      (docs as unknown as PushSubscriptionRow[]).map(async (row) => {
        try {
          await sender(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            pushBody(note, row.locale),
            config,
          )
        } catch (error) {
          const status = statusOf(error)
          if (status === 404 || status === 410) {
            await payload
              .delete({ collection: 'push-subscriptions', id: row.id, overrideAccess: true })
              .catch((e) =>
                payload.logger.error({
                  err: e,
                  msg: `Dead push subscription ${row.id} not removed`,
                }),
              )
            return
          }
          payload.logger.error({ err: error, msg: `Push to subscription ${row.id} failed` })
        }
      }),
    )
  } catch (error) {
    payload.logger.error({ err: error, msg: `Push for notification ${note.id} failed` })
  }
}
