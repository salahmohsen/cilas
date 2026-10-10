import { pathOf } from '@/lib/paths'

/**
 * Weebly links appear with and without `.html` and a trailing slash, so a
 * request tries each form, the one asked for first.
 */
export const legacyCandidates = (requested: string): string[] => {
  let path = requested
  try {
    path = decodeURI(requested)
  } catch {
    // Malformed escapes: match the path as given.
  }
  const bare = path.replace(/\/$/, '').replace(/\.html$/, '') || '/'
  return [...new Set([path, bare, `${bare}/`, `${bare}.html`])]
}

export type RedirectDoc = {
  type?: '301' | '302' | null
  to?: {
    type?: 'reference' | 'custom' | null
    url?: string | null
    reference?: { relationTo: string; value: unknown } | null
  } | null
}

/** Where a redirect sends people, or null when its target has no page. */
export const redirectTarget = (
  redirect: RedirectDoc,
): { url: string; permanent: boolean } | null => {
  const permanent = redirect.type !== '302'
  const to = redirect.to
  if (to?.type === 'custom') return to.url ? { url: to.url, permanent } : null

  const ref = to?.reference
  if (!ref || typeof ref.value !== 'object' || ref.value === null) return null
  const url = pathOf(ref.relationTo, ref.value as { slug?: string | null })
  return url ? { url, permanent } : null
}
