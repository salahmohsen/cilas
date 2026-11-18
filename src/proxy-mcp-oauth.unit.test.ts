import { NextRequest, NextResponse } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

// next-intl's middleware does not load under vitest; a request that reaches it
// is marked, so the tests can tell it from one the OAuth step took.
vi.mock('next-intl/middleware', () => ({
  default: () => () => NextResponse.next({ headers: { 'x-reached-intl': '1' } }),
}))

import proxy, { config } from '@/proxy'

const request = (path: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) =>
  new NextRequest(new URL(path, 'http://localhost:3000'), init)

const rewrite = (res: Response) => res.headers.get('x-middleware-rewrite')

describe('proxy: assistant discovery', () => {
  it('rewrites the two discovery documents to Payload', () => {
    expect(rewrite(proxy(request('/.well-known/oauth-authorization-server')))).toBe(
      'http://localhost:3000/api/.well-known/oauth-authorization-server',
    )
    expect(rewrite(proxy(request('/.well-known/oauth-protected-resource')))).toBe(
      'http://localhost:3000/api/.well-known/oauth-protected-resource',
    )
  })

  it('serves the resource document under the MCP path too', () => {
    expect(rewrite(proxy(request('/.well-known/oauth-protected-resource/api/mcp')))).toBe(
      'http://localhost:3000/api/.well-known/oauth-protected-resource',
    )
  })

  it('does not take other well-known paths or a bare-host POST', () => {
    expect(proxy(request('/.well-known/security.txt')).headers.get('x-reached-intl')).toBe('1')
    const post = proxy(
      request('/', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      }),
    )
    expect(post.headers.get('x-reached-intl')).toBe('1')
  })

  it('keeps the language, legacy and sign-in behaviour', () => {
    expect(proxy(request('/en/about')).headers.get('x-reached-intl')).toBe('1')
    expect(proxy(request('/old-page.html')).headers.get('x-middleware-rewrite')).toBe(
      'http://localhost:3000/en/old-page.html',
    )
    expect(proxy(request('/admin/login')).status).toBe(307)
    expect(proxy(request('/en/about/')).status).toBe(308)
  })

  it('matches the discovery paths', () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining([
        '/.well-known/oauth-authorization-server',
        '/.well-known/oauth-protected-resource',
        '/.well-known/oauth-protected-resource/api/mcp',
      ]),
    )
  })
})
