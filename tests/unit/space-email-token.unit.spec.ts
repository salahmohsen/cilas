import { describe, expect, it, vi } from 'vitest'

vi.mock('@/env', () => ({
  env: { PAYLOAD_SECRET: 'unit-test-secret', NEXT_PUBLIC_SERVER_URL: 'https://example.test' },
}))

import { unsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from '@/lib/space-email-token'

describe('space email unsubscribe token', () => {
  it('names the account it was made for', () => {
    expect(verifyUnsubscribeToken(unsubscribeToken(42))).toBe(42)
  })

  it('refuses another account behind a valid signature', () => {
    const [, signature] = unsubscribeToken(42).split('.')
    expect(verifyUnsubscribeToken(`43.${signature}`)).toBeNull()
  })

  it('refuses a changed signature, a missing one and junk', () => {
    const token = unsubscribeToken(7)
    const flipped = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')
    for (const bad of [flipped, '7.', '7', '.abc', '', null, undefined, 7, `${token}x`, '0.x'])
      expect(verifyUnsubscribeToken(bad)).toBeNull()
  })

  it('is signed with a key for this purpose, not the bare secret', async () => {
    const { createHmac } = await import('node:crypto')
    const plain = createHmac('sha256', 'unit-test-secret').update('7').digest('base64url')
    expect(unsubscribeToken(7).split('.')[1]).not.toBe(plain)
  })

  it('builds a link on the site with the language', () => {
    const url = new URL(unsubscribeUrl(5, 'ar'))
    expect(url.origin).toBe('https://example.test')
    expect(url.pathname).toBe('/api/space-email/unsubscribe')
    expect(url.searchParams.get('l')).toBe('ar')
    expect(verifyUnsubscribeToken(url.searchParams.get('t'))).toBe(5)
  })
})
