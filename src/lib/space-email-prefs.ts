import type { Payload } from 'payload'

import type { Lang } from '@/emails/space-mail'
import { relId } from '@/lib/relation'

/**
 * What the member chose for space email (spec §8). No row yet counts as the
 * defaults: a weekly digest, email on.
 */
export type SpaceEmailPrefs = {
  digest: 'daily' | 'weekly' | 'off'
  stopped: boolean
  locale: Lang
  sentAt: Date | null
}

export const prefsOf = (
  row?: {
    digest?: string | null
    stop_all_email?: boolean | null
    locale?: string | null
    digest_sent_at?: string | null
  } | null,
): SpaceEmailPrefs => ({
  digest: row?.digest === 'daily' || row?.digest === 'off' ? row.digest : 'weekly',
  stopped: Boolean(row?.stop_all_email),
  locale: row?.locale === 'ar' ? 'ar' : 'en',
  sentAt: row?.digest_sent_at ? new Date(row.digest_sent_at) : null,
})

export const loadPrefs = async (
  payload: Payload,
  accounts: number[],
): Promise<Map<number, SpaceEmailPrefs>> => {
  const out = new Map<number, SpaceEmailPrefs>()
  if (!accounts.length) return out
  const { docs } = await payload.find({
    collection: 'space-preferences',
    where: { account: { in: accounts } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  for (const row of docs) out.set(relId(row.account) as number, prefsOf(row))
  return out
}

export type PrefsPatch = {
  digest?: 'daily' | 'weekly' | 'off'
  stopped?: boolean
  locale?: Lang
}

/**
 * Saves part of an account's space email choices, making the row if there is
 * none. The digest choice and the stop are separate, so stopping all email
 * keeps the frequency for when it comes back on.
 */
export const setSpaceEmail = async (payload: Payload, account: number, patch: PrefsPatch) => {
  const data = {
    ...(patch.digest ? { digest: patch.digest } : {}),
    ...(patch.stopped === undefined ? {} : { stop_all_email: patch.stopped }),
    ...(patch.locale ? { locale: patch.locale } : {}),
  }
  const update = async () => {
    const { docs } = await payload.find({
      collection: 'space-preferences',
      where: { account: { equals: account } },
      overrideAccess: true,
      pagination: false,
      limit: 1,
      depth: 0,
    })
    if (!docs[0]) return false
    await payload.update({
      collection: 'space-preferences',
      id: docs[0].id,
      data,
      overrideAccess: true,
    })
    return true
  }
  if (await update()) return
  // Two first saves can both find no row; the unique index lets one create it.
  await payload
    .create({
      collection: 'space-preferences',
      data: { account, digest: 'weekly', ...data },
      overrideAccess: true,
    })
    .catch(async (error) => {
      if (!(await update())) throw error
    })
}
