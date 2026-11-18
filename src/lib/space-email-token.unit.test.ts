import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import { importWithEnv } from '../../testing/env.test-utils'

let token: typeof import('@/lib/space-email-token')

beforeEach(async () => {
  token = await importWithEnv(
    { PAYLOAD_SECRET: 'unit-test-secret', NEXT_PUBLIC_SERVER_URL: 'https://example.test' },
    () => import('@/lib/space-email-token'),
  )
})

describe('space email unsubscribe token', () => {
  it('names the account it was made for', () => {
    expect(token.verifyUnsubscribeToken(token.unsubscribeToken(42))).toBe(42)
  })

  it('refuses another account behind a valid signature', () => {
    const [, signature] = token.unsubscribeToken(42).split('.')
    expect(token.verifyUnsubscribeToken(`43.${signature}`)).toBeNull()
  })

  it('refuses a changed signature, a missing one and junk', () => {
    const made = token.unsubscribeToken(7)
    const flipped = made.slice(0, -1) + (made.endsWith('A') ? 'B' : 'A')
    for (const bad of [flipped, '7.', '7', '.abc', '', null, undefined, 7, `${made}x`, '0.x'])
      expect(token.verifyUnsubscribeToken(bad)).toBeNull()
  })

  it('is signed with a key for this purpose, not the bare secret', () => {
    const plain = createHmac('sha256', 'unit-test-secret').update('7').digest('base64url')
    expect(token.unsubscribeToken(7).split('.')[1]).not.toBe(plain)
  })

  it('builds a link on the site with the language', () => {
    const url = new URL(token.unsubscribeUrl(5, 'ar'))
    expect(url.origin).toBe('https://example.test')
    expect(url.pathname).toBe('/api/space-email/unsubscribe')
    expect(url.searchParams.get('l')).toBe('ar')
    expect(token.verifyUnsubscribeToken(url.searchParams.get('t'))).toBe(5)
  })
})
