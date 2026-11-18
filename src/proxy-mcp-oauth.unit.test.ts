import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

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
    const security = proxy(request('/.well-known/security.txt'))
    expect(security.status).toBe(307)
    expect(security.headers.get('location')).toBe(
      'http://localhost:3000/en/.well-known/security.txt',
    )
    const post = proxy(
      request('/', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      }),
    )
    expect(post.status).toBe(307)
    expect(post.headers.get('location')).toBe('http://localhost:3000/en')
  })

  it('keeps the language, legacy and sign-in behaviour', () => {
    const about = proxy(request('/en/about'))
    expect(about.headers.get('x-middleware-next')).toBe('1')
    expect(about.headers.get('x-middleware-request-x-next-intl-locale')).toBe('en')
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
