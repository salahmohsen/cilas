import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { importWithEnv } from '../../testing/env.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'

const loadLinkPreview = (vars: Record<string, string> = {}) =>
  importWithEnv(vars, () => import('@/lib/link-preview'))

let preview: Awaited<ReturnType<typeof loadLinkPreview>>

beforeEach(async () => {
  preview = await loadLinkPreview()
})

const network = mockNetwork()

describe('the connection lookup', () => {
  const answer = (...addresses: string[]) =>
    preview.publicOnlyLookup(async () => addresses.map((address) => ({ address, family: 4 })))
  const run = (lookup: ReturnType<typeof preview.publicOnlyLookup>, all = false) =>
    new Promise<unknown>((resolve) =>
      (lookup as unknown as (h: string, o: object, cb: (...a: unknown[]) => void) => void)(
        'rebind.example',
        { all },
        (error: unknown, ...rest: unknown[]) => resolve(error ?? rest),
      ),
    )

  it('answers a public address', async () => {
    expect(await run(answer('93.184.216.34'))).toEqual(['93.184.216.34', 4])
    expect(await run(answer('93.184.216.34'), true)).toEqual([
      [{ address: '93.184.216.34', family: 4 }],
    ])
  })

  it('refuses a private answer at connect time, even when another answer is public', async () => {
    expect(await run(answer('10.0.0.5'))).toEqual(new Error('private'))
    expect(await run(answer('93.184.216.34', '127.0.0.1'), true)).toEqual(new Error('private'))
    expect(await run(answer())).toEqual(new Error('private'))
  })

  it('passes a failed lookup on', async () => {
    const failing = preview.publicOnlyLookup(async () => {
      throw new Error('ENOTFOUND')
    })
    expect(await run(failing)).toEqual(new Error('ENOTFOUND'))
  })
})

describe('link previews', () => {
  it('lists every distinct outside link in order, never a mention', () => {
    expect(
      preview.outsideLinks('Hi [@Mona](/people/3), see [this](https://example.org/a).'),
    ).toEqual(['https://example.org/a'])
    expect(preview.outsideLinks('bare https://cilas.org/x. then more')).toEqual([
      'https://cilas.org/x',
    ])
    expect(preview.outsideLinks('only [@Mona](/people/3)')).toEqual([])
    expect(
      preview.outsideLinks(
        '[one](https://a.org/) and https://b.org/p, again https://a.org and [x](https://c.org/z)',
      ),
    ).toEqual(['https://a.org/', 'https://b.org/p', 'https://c.org/z'])
  })

  it('keeps at most five links for previews', () => {
    const body = Array.from({ length: 8 }, (_, i) => `https://site${i}.org/`).join(' ')
    expect(preview.outsideLinks(body)).toHaveLength(preview.MAX_PREVIEWS)
    expect(preview.outsideLinks(body)[4]).toBe('https://site4.org/')
  })

  it('refuses loopback, private, link-local and reserved addresses', () => {
    for (const a of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.1',
      '192.168.1.34',
      '169.254.169.254',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      '100.64.0.1',
    ])
      expect(preview.isPublicAddress(a), a).toBe(false)
    for (const a of ['93.184.216.34', '1.1.1.1', '2606:4700::1111'])
      expect(preview.isPublicAddress(a), a).toBe(true)
  })

  it('reads Open Graph first, then the title tag, and resolves the image', () => {
    const html = `<html><head><title>Plain</title>
      <meta property="og:title" content="Rich &amp; full">
      <meta name="description" content="About it">
      <meta property="og:image" content="/img.png"></head><body></body></html>`
    expect(preview.parseMeta(html, 'https://example.org/page')).toEqual({
      title: 'Rich & full',
      description: 'About it',
      image: 'https://example.org/img.png',
      site: null,
    })
    expect(preview.parseMeta('<html><head></head></html>', 'https://example.org')).toBeNull()
  })

  it('drops an image that is not a web address, or that carries credentials', () => {
    const page = (image: string) =>
      preview.parseMeta(
        `<head><meta property="og:title" content="T"><meta property="og:image" content="${image}"></head>`,
        'https://example.org/a/b',
      )?.image
    expect(page('data:image/png;base64,AAAA')).toBeNull()
    expect(page('javascript:alert(1)')).toBeNull()
    expect(page('https://user:pw@cdn.example.org/i.png')).toBeNull()
    expect(page('')).toBeNull()
    expect(page('../i.png')).toBe('https://example.org/i.png')
    expect(page('//cdn.example.org/i.png')).toBe('https://cdn.example.org/i.png')
  })

  it('never fetches a private host and shows no card for it', async () => {
    expect(await preview.linkPreview('http://127.0.0.1:3000/')).toBeNull()
    expect(await preview.linkPreview('http://localhost:5433/')).toBeNull()
    expect(await preview.linkPreview('file:///etc/passwd')).toBeNull()
  })

  describe('a failed fetch', () => {
    const html = '<html><head><title>Back again</title></head></html>'
    const production = (vars: Record<string, string>) =>
      loadLinkPreview({ NODE_ENV: 'production', ...vars })

    it('fetches this production site through its local server while keeping public preview URLs', async () => {
      const hosts: (string | null)[] = []
      network.use(
        http.get('http://127.0.0.1:3000/en/articles/local-preview', ({ request }) => {
          hosts.push(request.headers.get('host'))
          return HttpResponse.html(html)
        }),
      )
      const local = await production({
        NEXT_PUBLIC_SERVER_URL: 'https://93.184.216.34',
        PORT: '3000',
      })
      const url = 'https://93.184.216.34/en/articles/local-preview'
      expect((await local.linkPreview(url))?.url).toBe(url)
      expect(hosts).toEqual(['93.184.216.34'])
    })

    it('keeps lookalike origins on the checked public transport', async () => {
      const hosts: (string | null)[] = []
      network.use(
        http.get('https://93.184.216.34/other-origin', ({ request }) => {
          hosts.push(request.headers.get('host'))
          return HttpResponse.html(html)
        }),
      )
      const lookalike = await production({ NEXT_PUBLIC_SERVER_URL: 'https://93.184.216.34:8443' })
      await lookalike.linkPreview('https://93.184.216.34/other-origin')
      expect(hosts).toEqual([null])
    })

    it('still blocks a private redirect from this site', async () => {
      let requests = 0
      network.use(
        http.get('http://127.0.0.1:3000/private-redirect', () => {
          requests++
          return new HttpResponse(null, {
            status: 302,
            headers: { location: 'http://127.0.0.1/private' },
          })
        }),
      )
      const site = await production({ NEXT_PUBLIC_SERVER_URL: 'https://93.184.216.34' })
      expect(await site.linkPreview('https://93.184.216.34/private-redirect')).toBeNull()
      expect(requests).toBe(1)
    })

    it('tries a link again soon when the network fails, whatever the error says', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      const url = 'https://93.184.216.34/retry-dns'
      network.use(
        http.get(url, () => HttpResponse.error(), { once: true }),
        http.get(url, () => HttpResponse.html(html)),
      )
      expect(await preview.linkPreview(url)).toBeNull()
      vi.setSystemTime(Date.now() + 3 * 60_000)
      expect((await preview.linkPreview(url))?.title).toBe('Back again')
      vi.useRealTimers()
    })
  })

  describe('image check', () => {
    const image = 'https://93.184.216.34/i.png'
    const answer = (status: number, type?: string) =>
      network.use(
        http.head(
          image,
          () => new HttpResponse(null, { status, headers: type ? { 'content-type': type } : {} }),
        ),
      )

    it('drops an image that is gone or not an image', async () => {
      answer(404)
      expect(await preview.imageUsable(image)).toBe(false)
      network.use(
        http.head(
          'https://93.184.216.34/page',
          () => new HttpResponse(null, { status: 200, headers: { 'content-type': 'text/html' } }),
        ),
      )
      expect(await preview.imageUsable('https://93.184.216.34/page')).toBe(false)
      expect(await preview.imageUsable('http://127.0.0.1/i.png')).toBe(false)
    })

    it('keeps an image when the server is merely unsure', async () => {
      answer(200, 'image/png')
      expect(await preview.imageUsable(image)).toBe(true)
      answer(405)
      expect(await preview.imageUsable(image)).toBe(true)
      answer(302)
      expect(await preview.imageUsable(image)).toBe(true)
      network.use(http.head(image, () => HttpResponse.error()))
      expect(await preview.imageUsable(image)).toBe(true)
    })
  })
})
