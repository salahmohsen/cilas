import { NextRequest, NextResponse } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

// next-intl's middleware does not load under vitest; the language step is
// not what these tests check.
vi.mock('next-intl/middleware', () => ({ default: () => () => NextResponse.next() }))

import { safeNext } from '@/lib/safe-next'
import proxy from '@/proxy'

const request = (path: string, cookies: Record<string, string> = {}) => {
  const req = new NextRequest(new URL(path, 'http://localhost:3000'))
  for (const [name, value] of Object.entries(cookies)) req.cookies.set(name, value)
  return req
}

describe('safeNext', () => {
  it.each(['/', '/en/articles/x', '/admin/collections/courses?limit=10'])('keeps %s', (path) => {
    expect(safeNext(path)).toBe(path)
  })

  it.each(['//evil.example', '/\\evil.example', 'https://evil.example', '', null, undefined])(
    'refuses %s',
    (value) => {
      expect(safeNext(value)).toBe('/')
    },
  )
})

describe('proxy', () => {
  const rewrite = (res: Response) => res.headers.get('x-middleware-rewrite')

  it('serves signed-in readers the uncached article pages', () => {
    const signedIn = { 'payload-token': 'token' }
    expect(rewrite(proxy(request('/en/articles/on-pigeons', signedIn)))).toBe(
      'http://localhost:3000/en/signed-in/articles/on-pigeons',
    )
    expect(rewrite(proxy(request('/ar/articles', signedIn)))).toBe(
      'http://localhost:3000/ar/signed-in/articles',
    )
  })

  it('serves signed-in readers the pages that list community courses', () => {
    const signedIn = { 'payload-token': 'token' }
    expect(rewrite(proxy(request('/en', signedIn)))).toBe('http://localhost:3000/en/signed-in')
    expect(rewrite(proxy(request('/ar/apply', signedIn)))).toBe('http://localhost:3000/ar/signed-in/apply')
    expect(rewrite(proxy(request('/en/study/on-cities', signedIn)))).toBe(
      'http://localhost:3000/en/signed-in/study/on-cities',
    )
    expect(rewrite(proxy(request('/en/study/on-cities/apply', signedIn)))).toBe(
      'http://localhost:3000/en/signed-in/study/on-cities/apply',
    )
  })

  it('keeps the Bridge pages cached for signed-in readers', () => {
    const signedIn = { 'payload-token': 'token' }
    for (const path of ['/en/study/bridge', '/en/study/bridge/apply', '/en/study/bridge/2025']) {
      expect(rewrite(proxy(request(path, signedIn)))).toBeNull()
    }
  })

  it('keeps anonymous visitors on the cached pages', () => {
    expect(rewrite(proxy(request('/en/articles/on-pigeons')))).toBeNull()
    expect(rewrite(proxy(request('/en/study/on-cities')))).toBeNull()
    expect(rewrite(proxy(request('/en/apply')))).toBeNull()
  })

  it('sends the admin login to the site login, keeping where to return', () => {
    const res = proxy(request('/admin/login?redirect=%2Fadmin%2Fcollections%2Fcourses', { NEXT_LOCALE: 'ar' }))
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/ar/login?next=%2Fadmin%2Fcollections%2Fcourses',
    )
  })
})

describe('resetPasswordEmail', () => {
  it('links to the reset page with an absolute URL', async () => {
    const { resetPasswordEmail } = await import('@/collections/Users')
    expect(await resetPasswordEmail({ token: 'abc123' })).toContain(
      'href="http://localhost:3000/admin/reset/abc123"',
    )
  })
})
