import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  MAX_PREVIEWS,
  imageUsable,
  isPublicAddress,
  linkPreview,
  outsideLinks,
  parseMeta,
} from '@/lib/link-preview'

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
