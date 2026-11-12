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
 * - `https://chat.z.ai/?q=` prefills Z.ai (GLM, open weights), signed out
 *   too (2026-11)
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
 * - chat.z.ai answered 200 at 7,449 characters and 414 at 12,402, so
 *   7,000 (2026-11-07).
 * Arabic text grows six times when encoded, so an Arabic prompt meets these
 * limits long before an English one does.
 */

export type StudyKind = 'course' | 'article' | 'session'

export type ProviderId = 'claude' | 'gemini' | 'grok' | 'chatgpt' | 'zai'

export const providers: Array<{ id: ProviderId; maxUrl: number; href: (q: string) => string }> = [
  { id: 'claude', maxUrl: 20_000, href: (q) => `https://claude.ai/new?q=${q}` },
  {
    id: 'gemini',
    maxUrl: 8_000,
    href: (q) => `https://aistudio.google.com/prompts/new_chat?prompt=${q}`,
  },
  { id: 'grok', maxUrl: 6_000, href: (q) => `https://grok.com/?q=${q}` },
  { id: 'chatgpt', maxUrl: 20_000, href: (q) => `https://chatgpt.com/?q=${q}` },
  { id: 'zai', maxUrl: 7_000, href: (q) => `https://chat.z.ai/?q=${q}` },
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

/** The cache tag of the prompts an admin saved; dropped when they save again. */
export const STUDY_PROMPTS_TAG = 'study-prompts'

/** The prompts of each kind, from the fullest to the shortest. */
export const STUDY_KINDS = ['course', 'article', 'session'] as const satisfies StudyKind[]
export const STUDY_TIERS = ['full', 'compact', 'short'] as const
export type StudyTier = (typeof STUDY_TIERS)[number]

/** The {placeholders} each kind's prompts may use. */
export const STUDY_VARIABLES: Record<StudyKind, readonly string[]> = {
  course: ['pageUrl', 'pageFile', 'siteFile'],
  article: ['pageUrl', 'pageFile', 'siteFile'],
  session: ['pageUrl', 'pageFile', 'siteFile', 'course', 'session', 'readings'],
}

/** Every prompt hands the assistant the page's llms.txt and the site's. */
const REQUIRED_VARIABLES = ['pageFile', 'siteFile'] as const

/** Why an edited prompt cannot be saved, or null when it can. */
export const promptProblem = (kind: StudyKind, text: string): string | null => {
  const used = [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!)
  const allowed = STUDY_VARIABLES[kind]
  const unknown = used.find((name) => !allowed.includes(name))
  if (unknown)
    return `{${unknown}} is not a placeholder here. This prompt can use ${allowed.map((name) => `{${name}}`).join(', ')}.`
  const missing = REQUIRED_VARIABLES.filter((name) => !used.includes(name))
  if (missing.length)
    return `Keep ${missing.map((name) => `{${name}}`).join(' and ')}: the assistant reads the page and the site from them.`
  return null
}

/** The length of the link that hands `prompt` to a provider. */
export const linkLength = (id: ProviderId, prompt: string): number => aiLink(id, [prompt]).length
