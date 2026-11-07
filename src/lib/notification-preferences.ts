import { z } from 'zod'

import { NOTIFICATION_KINDS, type PreferenceKind } from '@/lib/notification-kinds'

/**
 * What an account wants to hear about, per kind and per channel. Stored on the
 * user as `notification_preferences` and read by the senders (the review
 * emails, src/lib/push/send.ts). Everything is on until it is turned off, so a
 * new kind reaches everyone and an account holds only its refusals.
 */
export type Channel = 'email' | 'push'

/** The kinds the settings page lists, in its order, with who can receive them. */
const PREFERENCE_ORDER = [
  'reaction',
  'comment',
  'reply',
  'mention',
  'announcement',
  'event_changed',
  'approved',
  'changes_requested',
  'rejected',
  'removed',
  'submitted',
  'application',
] as const satisfies readonly PreferenceKind[]

export const PREFERENCE_KINDS = PREFERENCE_ORDER.map((kind) => ({
  kind,
  audience: NOTIFICATION_KINDS[kind].audience,
}))

/** The kinds that also send an email (src/lib/review-hooks.ts, review decisions). */
export const EMAIL_KINDS = [
  'submitted',
  'approved',
  'changes_requested',
  'rejected',
] as const satisfies readonly PreferenceKind[]

export type EmailKind = (typeof EMAIL_KINDS)[number]

const KIND_VALUES = PREFERENCE_KINDS.map((p) => p.kind) as [PreferenceKind, ...PreferenceKind[]]

/** What the account stores: only the refusals, a `false` per kind and channel. */
export type NotificationPreferences = {
  email?: Partial<Record<EmailKind, boolean>>
  push?: Partial<Record<PreferenceKind, boolean>>
}

/** What a save sends: the kinds whose switch changed, with their new value. */
export type PreferenceChanges = NotificationPreferences

const flags = <K extends string>(keys: readonly [K, ...K[]]) =>
  z.partialRecord(z.enum(keys), z.boolean())

export const preferenceChangesSchema = z
  .object({
    email: flags(EMAIL_KINDS as unknown as [EmailKind, ...EmailKind[]]).optional(),
    push: flags(KIND_VALUES).optional(),
  })
  .strict()

/** Reads the stored value defensively: anything that is not a refusal is ignored. */
export const readPreferences = (raw: unknown): NotificationPreferences => {
  const parsed = preferenceChangesSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

/** Whether a note of this kind may use this channel for this account. */
export const wantsChannel = (
  preferences: NotificationPreferences | null | undefined,
  channel: Channel,
  kind: string,
): boolean => {
  const flag = (preferences?.[channel] as Record<string, boolean | undefined> | undefined)?.[kind]
  return flag !== false
}

/** Applies a save to the stored value, keeping only the refusals. */
export const mergePreferences = (
  current: NotificationPreferences | null | undefined,
  changes: PreferenceChanges,
): NotificationPreferences => {
  const next: NotificationPreferences = {}
  for (const channel of ['email', 'push'] as const) {
    const merged: Record<string, boolean> = {
      ...(current?.[channel] as Record<string, boolean> | undefined),
      ...(changes[channel] as Record<string, boolean> | undefined),
    }
    const refusals = Object.fromEntries(Object.entries(merged).filter(([, on]) => on === false))
    if (Object.keys(refusals).length) next[channel] = refusals as never
  }
  return next
}

/** The switches the page shows for an account: every listed kind, true unless refused. */
export const switchesOf = (
  preferences: NotificationPreferences | null | undefined,
  isAdmin: boolean,
): { email: Record<string, boolean>; push: Record<string, boolean> } => {
  const kinds = PREFERENCE_KINDS.filter((p) => p.audience === 'all' || isAdmin).map((p) => p.kind)
  return {
    email: Object.fromEntries(
      EMAIL_KINDS.filter((k) => kinds.includes(k)).map((k) => [
        k,
        wantsChannel(preferences, 'email', k),
      ]),
    ),
    push: Object.fromEntries(kinds.map((k) => [k, wantsChannel(preferences, 'push', k)])),
  }
}
