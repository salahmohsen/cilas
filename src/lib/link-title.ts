/** A bare address in plain text: the match ends before trailing punctuation. */
const BARE = /(?<![(\w/])https?:\/\/[^\s<>)\]]+/g
const TRAILING = /[.,;:!?'"]+$/

/** Titles are keyed without a trailing slash, so `a.org/x` and `a.org/x/` share one. */
export const titleKey = (url: string) => url.replace(/\/$/, '')

/** The bare addresses in Markdown or plain text: not `[text](url)` targets, not mentions. */
export const bareAddresses = (text: string): string[] => {
  const out: string[] = []
  for (const m of text.matchAll(BARE)) out.push(m[0].replace(TRAILING, ''))
  return out
}

/** The distinct bare addresses across a page's texts, in reading order, at most `max`. */
export const pageAddresses = (texts: string[], max = 30): string[] => {
  const seen = new Set<string>()
  for (const text of texts)
    for (const url of bareAddresses(text)) {
      if (seen.size >= max) return [...seen]
      seen.add(url)
    }
  return [...seen]
}

/** What a link shows when its page has no readable title: host and path, no scheme or `www.`. */
export const shortAddress = (url: string, max = 48): string => {
  let text = url
  try {
    const u = new URL(url)
    text = `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}${u.search}`
  } catch {
    text = url.replace(/^https?:\/\/(www\.)?/, '')
  }
  text = text.replace(/\/$/, '')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** A text cut into plain strings and bare addresses, for plain-text comments. */
export const splitAddresses = (text: string): (string | { url: string; tail: string })[] => {
  const out: (string | { url: string; tail: string })[] = []
  let from = 0
  for (const m of text.matchAll(BARE)) {
    const url = m[0].replace(TRAILING, '')
    if (m.index > from) out.push(text.slice(from, m.index))
    out.push({ url, tail: m[0].slice(url.length) })
    from = m.index + m[0].length
  }
  if (from < text.length) out.push(text.slice(from))
  return out
}

/** The texts of a post and its thread, replies included, for one title batch. */
export const threadTexts = (
  bodies: string[],
  comments: { body: string; replies?: { body: string }[] }[],
): string[] => [
  ...bodies,
  ...comments.flatMap((c) => [c.body, ...(c.replies ?? []).map((r) => r.body)]),
]
