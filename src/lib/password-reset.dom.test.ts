import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { isEmail, passwordProblem, requestResetLink, saveNewPassword } from '@/lib/password-reset'

import { mockNetwork } from '../../testing/msw-node.test-utils'

const network = mockNetwork()

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
    const bodies: unknown[] = []
    network.use(
      http.post('/api/users/forgot-password', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({})
      }),
    )
    expect(await requestResetLink(' a@b.co ')).toBe('sent')
    expect(bodies).toEqual([{ email: 'a@b.co' }])
  })

  it('fails on a server error or no network', async () => {
    network.use(
      http.post('/api/users/forgot-password', () => HttpResponse.json({}, { status: 500 })),
    )
    expect(await requestResetLink('a@b.co')).toBe('failed')
    network.use(http.post('/api/users/forgot-password', () => HttpResponse.error()))
    expect(await requestResetLink('a@b.co')).toBe('failed')
  })
})

describe('saveNewPassword', () => {
  it('posts the token and the password', async () => {
    const bodies: unknown[] = []
    network.use(
      http.post('/api/users/reset-password', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({})
      }),
    )
    expect(await saveNewPassword('tok', 'long enough 1')).toBe('saved')
    expect(bodies).toEqual([{ token: 'tok', password: 'long enough 1' }])
  })

  it('tells an expired or used link from another failure', async () => {
    for (const [status, result] of [
      [403, 'invalid'],
      [400, 'invalid'],
      [500, 'failed'],
    ] as const) {
      network.use(http.post('/api/users/reset-password', () => HttpResponse.json({}, { status })))
      expect(await saveNewPassword('tok', 'x')).toBe(result)
    }
  })
})
