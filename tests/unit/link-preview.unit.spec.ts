import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  MAX_PREVIEWS,
  imageUsable,
  isPublicAddress,
  linkPreview,
  outsideLinks,
  parseMeta,
  publicOnlyLookup,
} from '@/lib/link-preview'

describe('the connection lookup', () => {
  const answer = (...addresses: string[]) =>
    publicOnlyLookup(async () => addresses.map((address) => ({ address, family: 4 })))
  const run = (lookup: ReturnType<typeof publicOnlyLookup>, all = false) =>
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
    const failing = publicOnlyLookup(async () => {
      throw new Error('ENOTFOUND')
    })
    expect(await run(failing)).toEqual(new Error('ENOTFOUND'))
  })
})

describe('link previews', () => {
  it('lists every distinct outside link in order, never a mention', () => {
    expect(outsideLinks('Hi [@Mona](/people/3), see [this](https://example.org/a).')).toEqual([
      'https://example.org/a',
    ])
    expect(outsideLinks('bare https://cilas.org/x. then more')).toEqual(['https://cilas.org/x'])
    expect(outsideLinks('only [@Mona](/people/3)')).toEqual([])
    expect(
      outsideLinks(
        '[one](https://a.org/) and https://b.org/p, again https://a.org and [x](https://c.org/z)',
      ),
    ).toEqual(['https://a.org/', 'https://b.org/p', 'https://c.org/z'])
  })

  it('keeps at most five links for previews', () => {
    const body = Array.from({ length: 8 }, (_, i) => `https://site${i}.org/`).join(' ')
    expect(outsideLinks(body)).toHaveLength(MAX_PREVIEWS)
    expect(outsideLinks(body)[4]).toBe('https://site4.org/')
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
      expect(isPublicAddress(a), a).toBe(false)
    for (const a of ['93.184.216.34', '1.1.1.1', '2606:4700::1111'])
      expect(isPublicAddress(a), a).toBe(true)
  })

  it('reads Open Graph first, then the title tag, and resolves the image', () => {
    const html = `<html><head><title>Plain</title>
      <meta property="og:title" content="Rich &amp; full">
      <meta name="description" content="About it">
      <meta property="og:image" content="/img.png"></head><body></body></html>`
    expect(parseMeta(html, 'https://example.org/page')).toEqual({
      title: 'Rich & full',
      description: 'About it',
      image: 'https://example.org/img.png',
      site: null,
    })
    expect(parseMeta('<html><head></head></html>', 'https://example.org')).toBeNull()
  })

  it('drops an image that is not a web address, or that carries credentials', () => {
    const page = (image: string) =>
      parseMeta(
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
    expect(await linkPreview('http://127.0.0.1:3000/')).toBeNull()
    expect(await linkPreview('http://localhost:5433/')).toBeNull()
    expect(await linkPreview('file:///etc/passwd')).toBeNull()
  })

  describe('a failed fetch', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
      vi.useRealTimers()
    })
    const page = () =>
      new Response('<html><head><title>Back again</title></head></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })

    it('fetches this production site through its local server while keeping public preview URLs', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://93.184.216.34')
      vi.stubEnv('PORT', '3000')
      const fetch = vi.fn().mockImplementation(async () => page())
      vi.stubGlobal('fetch', fetch)
      const url = 'https://93.184.216.34/en/articles/local-preview'
      expect((await linkPreview(url))?.url).toBe(url)
      expect(String(fetch.mock.calls[0]?.[0])).toBe(
        'http://127.0.0.1:3000/en/articles/local-preview',
      )
      expect(fetch.mock.calls[0]?.[1].headers.host).toBe('93.184.216.34')
    })

    it('keeps lookalike origins on the checked public transport', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://93.184.216.34:8443')
      const fetch = vi.fn().mockImplementation(async () => page())
      vi.stubGlobal('fetch', fetch)
      const url = 'https://93.184.216.34/other-origin'
      await linkPreview(url)
      expect(String(fetch.mock.calls[0]?.[0])).toBe(url)
      expect(fetch.mock.calls[0]?.[1].headers.host).toBeUndefined()
    })

    it('still blocks a private redirect from this site', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://93.184.216.34')
      const fetch = vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }),
        )
      vi.stubGlobal('fetch', fetch)
      expect(await linkPreview('https://93.184.216.34/private-redirect')).toBeNull()
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('tries a link again soon when the network fails, whatever the error says', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockRejectedValueOnce(new Error('getaddrinfo EAI_AGAIN example.org'))
          .mockImplementation(async () => page()),
      )
      const url = 'https://93.184.216.34/retry-dns'
      expect(await linkPreview(url)).toBeNull()
      vi.setSystemTime(Date.now() + 3 * 60_000)
      expect((await linkPreview(url))?.title).toBe('Back again')
    })
  })

  describe('image check', () => {
    afterEach(() => vi.unstubAllGlobals())
    const answer = (status: number, type?: string) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () => new Response(null, { status, headers: type ? { 'content-type': type } : {} }),
        ),
      )

    it('drops an image that is gone or not an image', async () => {
      answer(404)
      expect(await imageUsable('https://93.184.216.34/gone.png')).toBe(false)
      answer(200, 'text/html')
      expect(await imageUsable('https://93.184.216.34/page')).toBe(false)
      expect(await imageUsable('http://127.0.0.1/i.png')).toBe(false)
    })

    it('keeps an image when the server is merely unsure', async () => {
      answer(200, 'image/png')
      expect(await imageUsable('https://93.184.216.34/i.png')).toBe(true)
      answer(405)
      expect(await imageUsable('https://93.184.216.34/i.png')).toBe(true)
      answer(302)
      expect(await imageUsable('https://93.184.216.34/i.png')).toBe(true)
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
      expect(await imageUsable('https://93.184.216.34/i.png')).toBe(true)
    })
  })
})
