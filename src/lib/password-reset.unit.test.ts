import { describe, expect, it, vi } from 'vitest'

import { isEmail, passwordProblem, requestResetLink, saveNewPassword } from '@/lib/password-reset'

const answer = (status: number) => vi.fn(async () => new Response('{}', { status }))

describe('isEmail', () => {
  it('accepts an address, with spaces around it', () => {
    expect(isEmail('name@example.com')).toBe(true)
    expect(isEmail('  name@example.com ')).toBe(true)
  })

  it('refuses text that is not an address', () => {
    expect(isEmail('')).toBe(false)
    expect(isEmail('name')).toBe(false)
    expect(isEmail('name@')).toBe(false)
    expect(isEmail('na me@example.com')).toBe(false)
  })
})

describe('passwordProblem', () => {
  it('asks for at least 8 characters', () => {
    expect(passwordProblem('short', 'short')).toBe('tooShort')
    expect(passwordProblem('', '')).toBe('tooShort')
  })

  it('asks for the same password twice', () => {
    expect(passwordProblem('long enough 1', 'long enough 2')).toBe('mismatch')
  })

  it('lets a good password through', () => {
    expect(passwordProblem('long enough 1', 'long enough 1')).toBeNull()
  })
})

describe('requestResetLink', () => {
  it('posts the trimmed email to Payload', async () => {
    const send = answer(200)
    expect(await requestResetLink(' a@b.co ', send as never)).toBe('sent')
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/users/forgot-password')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.co' })
  })

  it('fails on a server error or no network', async () => {
    expect(await requestResetLink('a@b.co', answer(500) as never)).toBe('failed')
    const offline = vi.fn(async () => {
      throw new TypeError('offline')
    })
    expect(await requestResetLink('a@b.co', offline as never)).toBe('failed')
  })
})

describe('saveNewPassword', () => {
  it('posts the token and the password', async () => {
    const send = answer(200)
    expect(await saveNewPassword('tok', 'long enough 1', send as never)).toBe('saved')
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/users/reset-password')
    expect(JSON.parse(init.body as string)).toEqual({ token: 'tok', password: 'long enough 1' })
  })

  it('tells an expired or used link from another failure', async () => {
    expect(await saveNewPassword('tok', 'x', answer(403) as never)).toBe('invalid')
    expect(await saveNewPassword('tok', 'x', answer(400) as never)).toBe('invalid')
    expect(await saveNewPassword('tok', 'x', answer(500) as never)).toBe('failed')
  })
})
