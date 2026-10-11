import { JSDOM } from 'jsdom'

export type NewsletterLink = { text: string; url: string }

/** A Facebook redirect (`l.facebook.com/l.php?u=…`) to the address it wraps. */
const unwrap = (href: string): string => {
  try {
    const url = new URL(href)
    return url.hostname === 'l.facebook.com' ? (url.searchParams.get('u') ?? href) : href
  } catch {
    return href
  }
}

const NEWSLETTER = /campaign-archive|eepurl\.com|lucidpress\.com\/CILASNEWSLETTER/i

/**
 * The newsletter-issue links on a page: Mailchimp campaign archives, their
 * eepurl short links (often wrapped in a Facebook redirect) and the Lucidpress
 * issue. The archives themselves are never fetched. Order is page order.
 */
export const newsletterLinks = (html: string): NewsletterLink[] => {
  const { document } = new JSDOM(html).window
  const out: NewsletterLink[] = []
  for (const a of document.querySelectorAll('a[href]')) {
    const url = unwrap(a.getAttribute('href') ?? '')
    if (!NEWSLETTER.test(url)) continue
    const text = (a.textContent ?? '').replace(/[\s​﻿]+/g, ' ').trim()
    out.push({ text, url })
  }
  return out
}

/** One entry per campaign (same `id`, whatever the host), keeping the first with text. */
export const dedupeNewsletterLinks = (links: NewsletterLink[]): NewsletterLink[] => {
  const byKey = new Map<string, NewsletterLink>()
  for (const link of links) {
    const key = /campaign-archive/.test(link.url)
      ? (/[?&]id=([0-9a-f]+)/.exec(link.url)?.[1] ?? link.url)
      : link.url
    const seen = byKey.get(key)
    if (!seen || (!seen.text && link.text)) byKey.set(key, link)
  }
  return [...byKey.values()]
}
