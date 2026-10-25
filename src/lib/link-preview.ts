import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/** What a post shows for a link: the page's own title, summary and image. */
export type LinkPreview = {
  url: string
  host: string
  title: string
  description: string | null
  image: string | null
  site: string | null
}

const TIMEOUT_MS = 4000
const MAX_BYTES = 512 * 1024
const MAX_REDIRECTS = 3
const HIT_MS = 24 * 3600_000
const MISS_MS = 3600_000
const MAX_ENTRIES = 500

/**
 * How many links of one post get a preview. Each is a server fetch of up to
 * 4 seconds and 512 KB, run in parallel; five fills a card without letting one
 * post fan out into a crawl. Later links stay plain links in the text.
 */
export const MAX_PREVIEWS = 5

/** The distinct outside links in a post's Markdown, in reading order; mentions (`/people/…`) are not links out. */
export const outsideLinks = (markdown: string, max = MAX_PREVIEWS): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of markdown.matchAll(
    /\]\((https?:\/\/[^\s)]+)\)|(?<![(\w])(https?:\/\/[^\s)<>\]]+)/g,
  )) {
    const url = (m[1] ?? m[2] ?? '').replace(/[.,;:!?]+$/, '')
    const key = url.replace(/\/$/, '')
    if (!url || seen.has(key)) continue
    seen.add(key)
    out.push(url)
    if (out.length === max) break
  }
  return out
}

/** Whether an address is on the public internet: never loopback, private, link-local or reserved. */
export const isPublicAddress = (address: string): boolean => {
  const v = isIP(address)
  if (v === 4) {
    const [a, b] = address.split('.').map(Number) as [number, number]
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  if (v === 6) {
    const lower = address.toLowerCase()
    if (lower === '::' || lower === '::1') return false
    if (lower.startsWith('::ffff:')) return isPublicAddress(lower.slice(7))
    return !/^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower)
  }
  return false
}

const decode = (text: string) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()

/** Reads Open Graph, Twitter and plain HTML tags from a page's head. */
export const parseMeta = (
  html: string,
  pageUrl: string,
): Omit<LinkPreview, 'url' | 'host'> | null => {
  const end = html.search(/<\/head>/i)
  const head = end === -1 ? html : html.slice(0, end)
  const meta = new Map<string, string>()
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    const value = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]
    if (key && value && !meta.has(key)) meta.set(key, decode(value))
  }
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1]
  const title = meta.get('og:title') ?? meta.get('twitter:title') ?? (titleTag && decode(titleTag))
  if (!title) return null
  const rawImage = meta.get('og:image') ?? meta.get('twitter:image')
  let image: string | null = null
  if (rawImage) {
    try {
      const resolved = new URL(rawImage.trim(), pageUrl)
      const web = resolved.protocol === 'https:' || resolved.protocol === 'http:'
      if (web && !resolved.username && !resolved.password && resolved.href.length <= 2000)
        image = resolved.href
    } catch {
      image = null
    }
  }
  return {
    title: title.slice(0, 200),
    description:
      (
        meta.get('og:description') ??
        meta.get('twitter:description') ??
        meta.get('description')
      )?.slice(0, 300) ?? null,
    image,
    site: meta.get('og:site_name') ?? null,
  }
}

const assertPublic = async (url: URL) => {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol')
  if (url.username || url.password) throw new Error('credentials')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true, verbatim: true })).map((a) => a.address)
  if (!addresses.length || !addresses.every(isPublicAddress)) throw new Error('private')
}

/** Fetches at most MAX_BYTES of HTML, following up to MAX_REDIRECTS, each hop checked again. */
const fetchHead = async (start: string): Promise<{ html: string; url: string } | null> => {
  let url = new URL(start)
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url)
    const res = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: { 'user-agent': 'CILAS link preview', accept: 'text/html' },
      cache: 'no-store',
    })
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location')
      await res.body?.cancel()
      if (!next) return null
      url = new URL(next, url)
      continue
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) {
      await res.body?.cancel()
      return null
    }
    const reader = res.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let size = 0
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      size += value.byteLength
    }
    await reader.cancel()
    return {
      html: new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES)),
      url: url.href,
    }
  }
  return null
}

const IMAGE_MS = 2500

/**
 * Whether a preview's image is worth showing. Only a sure answer drops it: a
 * private host, a 4xx, or a page that is not an image. A server that refuses
 * HEAD, a redirect or a timeout keeps it, and the browser's own onError has the last word.
 */
export const imageUsable = async (raw: string): Promise<boolean> => {
  try {
    const url = new URL(raw)
    await assertPublic(url)
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(IMAGE_MS),
      headers: { 'user-agent': 'CILAS link preview', accept: 'image/*' },
      cache: 'no-store',
    })
    if (res.status === 404 || res.status === 410) return false
    if (res.ok) {
      const type = res.headers.get('content-type')
      return !type || type.toLowerCase().startsWith('image/')
    }
    return true
  } catch (e) {
    return !(e instanceof Error && (e.message === 'private' || e.message === 'protocol'))
  }
}

const cache = new Map<string, { value: LinkPreview | null; until: number }>()

/**
 * A link's preview, fetched on the server only and kept for a day (a miss
 * for an hour). Null for a page that is private, slow, not HTML or has no
 * title. Never throws: a broken link simply shows no card.
 */
export const linkPreview = async (raw: string): Promise<LinkPreview | null> => {
  const hit = cache.get(raw)
  if (hit && hit.until > Date.now()) return hit.value
  let value: LinkPreview | null = null
  try {
    const page = await fetchHead(raw)
    const meta = page && parseMeta(page.html, page.url)
    if (meta) {
      if (meta.image && !(await imageUsable(meta.image))) meta.image = null
      value = { url: raw, host: new URL(page.url).hostname.replace(/^www\./, ''), ...meta }
    }
  } catch {
    value = null
  }
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!)
  cache.set(raw, { value, until: Date.now() + (value ? HIT_MS : MISS_MS) })
  return value
}
