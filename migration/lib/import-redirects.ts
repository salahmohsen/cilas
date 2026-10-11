import type { Payload } from 'payload'

export const REDIRECT_COLLECTIONS = ['courses', 'cycles', 'programmes', 'publications', 'articles', 'events', 'press', 'people'] as const
export type RedirectCollection = (typeof REDIRECT_COLLECTIONS)[number]

export type PageRef = { legacy_url: string; kind: string; title?: string }
export type DocRef = { collection: string; id: number; legacy_url: string }
export type Target = { collection: string; id: number }
export type RedirectPlan = {
  from: string
  target: Target | null
  reason: 'exact' | 'page-doc' | 'single-fragment' | 'ambiguous' | 'no-document' | 'space'
  candidates?: Target[]
}

const base = (url: string) => url.split('#')[0]
const rank = (c: string) => REDIRECT_COLLECTIONS.indexOf(c as RedirectCollection)
const ref = (d: DocRef): Target => ({ collection: d.collection, id: d.id })

/**
 * Which document replaces each legacy page. In order: the document whose
 * `legacy_url` is the page; the one cycle or programme among the page's
 * fragment documents; the only fragment document. Otherwise none.
 * Spaces are not in the redirects plugin's list, so they never get one.
 */
export const redirectTargets = (pages: PageRef[], docs: DocRef[]): RedirectPlan[] => {
  const exact = new Map<string, DocRef[]>()
  const fragments = new Map<string, DocRef[]>()
  for (const d of docs) {
    if (rank(d.collection) < 0) continue
    const map = d.legacy_url.includes('#') ? fragments : exact
    const key = base(d.legacy_url)
    map.set(key, [...(map.get(key) ?? []), d])
  }

  return pages.map((p): RedirectPlan => {
    const from = p.legacy_url
    if (p.kind === 'space') return { from, target: null, reason: 'space' }

    const hit = [...(exact.get(from) ?? [])].sort((a, b) => rank(a.collection) - rank(b.collection))[0]
    if (hit) return { from, target: ref(hit), reason: 'exact' }

    const frags = fragments.get(from) ?? []
    const pageDocs = frags.filter((d) => d.collection === 'cycles' || d.collection === 'programmes')
    if (pageDocs.length === 1) return { from, target: ref(pageDocs[0]), reason: 'page-doc' }
    if (pageDocs.length === 0 && frags.length === 1) return { from, target: ref(frags[0]), reason: 'single-fragment' }
    if (frags.length > 0) return { from, target: null, reason: 'ambiguous', candidates: (pageDocs.length ? pageDocs : frags).map(ref) }
    return { from, target: null, reason: 'no-document' }
  })
}

export type RedirectTally = { created: number; unchanged: number; kept: number }

type Existing = { id: number; to?: { type?: string | null; url?: string | null; reference?: { relationTo: string; value: unknown } | null } | null }

const idOf = (v: unknown): unknown => (typeof v === 'object' && v !== null ? (v as { id?: unknown }).id : v)

const same = (old: Existing['to'], to: { type: 'reference'; reference: { relationTo: string; value: number } } | { type: 'custom'; url: string }): boolean => {
  if (!old || old.type !== to.type) return false
  if (to.type === 'custom') return old.url === to.url
  return old.reference?.relationTo === to.reference.relationTo && idOf(old.reference?.value) === to.reference.value
}

/**
 * Upserts one 301 per planned page and one per uploaded file. A redirect that
 * already exists is never rewritten: if its target differs from what the
 * importer would write, an admin edited it, so it counts as kept.
 *
 * `uploads` are media docs: `legacy_url` is the archive path, `url` the R2 URL.
 */
export const importRedirects = async (
  payload: Payload,
  plans: RedirectPlan[],
  uploads: Array<{ legacy_url: string; url: string }> = [],
): Promise<RedirectTally> => {
  const tally: RedirectTally = { created: 0, unchanged: 0, kept: 0 }

  const upsert = async (from: string, to: Parameters<typeof same>[1]) => {
    const { docs } = await payload.find({ collection: 'redirects', where: { from: { equals: from } }, limit: 1, depth: 0, overrideAccess: true })
    const found = docs[0] as unknown as Existing | undefined
    if (found) {
      if (same(found.to, to)) tally.unchanged++
      else tally.kept++
      return
    }
    await payload.create({
      collection: 'redirects',
      // The plugin types `reference` as a union over its collections.
      data: { from, type: '301', to } as never,
      overrideAccess: true,
    })
    tally.created++
  }

  for (const plan of plans) {
    if (!plan.target) continue
    await upsert(plan.from, { type: 'reference', reference: { relationTo: plan.target.collection, value: plan.target.id } })
  }
  for (const u of uploads) {
    if (!u.legacy_url || !u.url) continue
    await upsert(`/${u.legacy_url}`, { type: 'custom', url: u.url })
  }
  return tally
}
