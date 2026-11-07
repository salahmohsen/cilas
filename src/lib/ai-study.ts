/**
 * Taking a page to study with AI: the deep links that open a chat assistant
 * with a study prompt prefilled. The prompts themselves live in the messages
 * (`StudyPrompt`), one per page language, so an Arabic page hands over an
 * Arabic prompt. Each asks the assistant to read the page's llms.txt twin
 * (the same content in plain markdown, built per page beside the routes) and
 * keeps the site's own llms.txt at hand for pointing to related pages.
 *
 * The provider links prefill a first message. Verified once (2026-10):
 * - `https://claude.ai/new?q=` prefills a new conversation
 * - `https://aistudio.google.com/prompts/new_chat?prompt=` prefills AI
 *   Studio (Gemini), as Google's own quality-of-life update documents
 * - `https://chatgpt.com/?q=` prefills the composer
 * - `https://grok.com/?q=` prefills Grok
 * When one drifts, the assistant simply opens without the prefill.
 *
 * `maxUrl` is the longest link we hand each one, measured 2026-10-25:
 * - grok.com answered 431 from about 7,900 characters with no cookies, and
 *   a signed-in browser sends cookies in the same header budget, so 6,000.
 * - aistudio.google.com answered 400 from about 16,400 characters, and a
 *   signed-out visitor is redirected to sign-in with the whole link inside
 *   the redirect, so half of it.
 * - claude.ai answered 200 at 28,000 characters and chatgpt.com at 24,000
 *   (a fresh headless browser; repeat requests meet a bot check, not a limit).
 *   Both sit behind Cloudflare, which refuses a URI over 32 KB. 20,000.
 * Arabic text grows six times when encoded, so an Arabic prompt meets these
 * limits long before an English one does.
 */

export type StudyKind = 'course' | 'article' | 'session'

export type ProviderId = 'claude' | 'gemini' | 'grok' | 'chatgpt'

export const providers: Array<{ id: ProviderId; maxUrl: number; href: (q: string) => string }> = [
  { id: 'claude', maxUrl: 20_000, href: (q) => `https://claude.ai/new?q=${q}` },
  {
    id: 'gemini',
    maxUrl: 8_000,
    href: (q) => `https://aistudio.google.com/prompts/new_chat?prompt=${q}`,
  },
  { id: 'grok', maxUrl: 6_000, href: (q) => `https://grok.com/?q=${q}` },
  { id: 'chatgpt', maxUrl: 20_000, href: (q) => `https://chatgpt.com/?q=${q}` },
]

/**
 * A provider's link for the longest prompt that fits its limit. `prompts` run
 * from the fullest to the shortest; when none fits, the last one goes anyway,
 * since a link the assistant cuts short still beats no link.
 */
export const aiLink = (id: ProviderId, prompts: string[]): string => {
  const provider = providers.find((p) => p.id === id)
  if (!provider || !prompts.length) return ''
  const links = prompts.map((p) => provider.href(encodeURIComponent(p)))
  return links.find((l) => l.length <= provider.maxUrl) ?? links[links.length - 1]
}

export const fillPrompt = (template: string, values: Record<string, string>): string =>
  template
    .split('\n')
    .filter((line) => !/^\{\w+\}$/.test(line.trim()) || values[line.trim().slice(1, -1)])
    .join('\n')
    .replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot)

const trim = (url: string): string => url.replace(/\/+$/, '')

export const studyFiles = (origin: string, path: string) => ({
  pageUrl: `${trim(origin)}${path}`,
  pageFile: `${trim(origin)}${trim(path)}/llms.txt`,
  siteFile: `${trim(origin)}/llms.txt`,
})
