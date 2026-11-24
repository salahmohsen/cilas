import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import proxy from '@/proxy'

const signedIn = (path: string) =>
  proxy(
    new NextRequest(new URL(path, 'http://localhost:3000'), {
      headers: { cookie: 'payload-token=x' },
    }),
  ).headers.get('x-middleware-rewrite')

const anonymous = (path: string) =>
  proxy(new NextRequest(new URL(path, 'http://localhost:3000'))).headers.get('x-middleware-rewrite')

const rewritten = (path: string) => `http://localhost:3000${path}`

describe('proxy: pages a signed-in reader gets uncached', () => {
  it.each([
    ['/en', '/en/signed-in'],
    ['/ar/apply', '/ar/signed-in/apply'],
    ['/en/articles', '/en/signed-in/articles'],
    ['/en/articles/some-article', '/en/signed-in/articles/some-article'],
    ['/en/people/some-person', '/en/signed-in/people/some-person'],
    ['/ar/people/some-person', '/ar/signed-in/people/some-person'],
    ['/en/study/some-course', '/en/signed-in/study/some-course'],
    ['/en/study/some-course/apply', '/en/signed-in/study/some-course/apply'],
  ])('rewrites %s', (path, to) => {
    expect(signedIn(path)).toBe(rewritten(to))
  })

  it.each([
    '/en/people/fellows',
    '/en/people/cilasians',
    '/ar/people/fellows',
    '/ar/people/cilasians',
    '/en/study/bridge',
    '/en/study/bridge/apply',
    '/en/study/bridge/2025',
    '/en/about',
    '/en/governance',
  ])('leaves %s to its own page', (path) => {
    expect(signedIn(path)).toBeNull()
  })

  it('does not rewrite anyone without the login cookie', () => {
    expect(anonymous('/en/people/some-person')).toBeNull()
    expect(anonymous('/en/people/fellows')).toBeNull()
  })
})
