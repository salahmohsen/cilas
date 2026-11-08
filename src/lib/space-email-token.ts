import { createHmac, timingSafeEqual } from 'node:crypto'

import { env } from '@/env'

/**
 * The signed link in every space email that stops all of an account's space
 * email (spec §8). The token names the account and carries an HMAC made with a
 * key derived for this purpose only, so it can do nothing else and PAYLOAD_SECRET
 * itself never signs it. It does not expire: a mail may be opened months later.
 */
const PURPOSE = 'cilas:space-email-unsubscribe:v1'

const derivedKey = () => createHmac('sha256', env.PAYLOAD_SECRET).update(PURPOSE).digest()

const sign = (account: number) =>
  createHmac('sha256', derivedKey()).update(`${PURPOSE}:${account}`).digest('base64url')

export const unsubscribeToken = (account: number): string => `${account}.${sign(account)}`

/** The account a token names, or null for anything not made by `unsubscribeToken`. */
export const verifyUnsubscribeToken = (token: unknown): number | null => {
  if (typeof token !== 'string' || token.length > 200) return null
  const match = /^([1-9]\d{0,14})\.([A-Za-z0-9_-]{43})$/.exec(token)
  if (!match) return null
  const account = Number(match[1])
  const given = Buffer.from(match[2]!)
  const expected = Buffer.from(sign(account))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return account
}

export const unsubscribeUrl = (account: number, locale: 'en' | 'ar'): string => {
  const origin = env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')
  return `${origin}/api/space-email/unsubscribe?t=${unsubscribeToken(account)}&l=${locale}`
}
