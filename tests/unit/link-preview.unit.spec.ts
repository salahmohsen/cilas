import { describe, expect, it } from 'vitest'

import { firstLink, isPublicAddress, linkPreview, parseMeta } from '@/lib/link-preview'

describe('link previews', () => {
  it('takes the first outside link, never a mention', () => {
    expect(firstLink('Hi [@Mona](/people/3), see [this](https://example.org/a).')).toBe(
      'https://example.org/a',
    )
    expect(firstLink('bare https://cilas.org/x. then more')).toBe('https://cilas.org/x')
    expect(firstLink('only [@Mona](/people/3)')).toBeNull()
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

  it('never fetches a private host and shows no card for it', async () => {
    expect(await linkPreview('http://127.0.0.1:3000/')).toBeNull()
    expect(await linkPreview('http://localhost:5433/')).toBeNull()
    expect(await linkPreview('file:///etc/passwd')).toBeNull()
  })
})
