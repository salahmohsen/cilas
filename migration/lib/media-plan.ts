/**
 * Which archive file goes to which document field. Pure: the runner reads the
 * archive JSON and the pages' text, `importMedia` does the uploading.
 */

export type MediaJob = {
  collection: 'people' | 'press' | 'publications' | 'courses' | 'newsletters'
  /** The target document's `legacy_url`. An outlet's logo goes to every press item from it, by `name`. */
  legacy_url?: string
  name?: string
  /** An upload field, or `print_edition_url` / `body_pdf_link` for a PDF. */
  field: string
  /** The archive path, without its query: `uploads/1/9/…/x.jpg`. */
  path: string
  alt: string
}

export const stripQuery = (href: string): string => href.split(/[?#]/)[0]

/** The `uploads/…` path inside a link of any form (relative, rooted, absolute), decoded; null if none. */
export const uploadsPath = (href: string): string | null => {
  const match = /(?:^|\/)(uploads\/.+)$/.exec(stripQuery(href))
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

/** The first uploaded image in page text (`![image](src)` lines), or null. */
export const firstImage = (text: string): string | null => {
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^)]*)\)/g)) {
    const path = uploadsPath(m[1])
    if (path) return path
  }
  return null
}

/** Each path once, in first-seen order: two jobs on one file share one upload. */
export const uniquePaths = (jobs: Array<{ path: string }>): string[] => [
  ...new Set(jobs.map((j) => j.path)),
]

type Page = { legacy_url: string; kind: string; text: string }

/** Publications whose page shows no cover (Pigeon Towers: only portraits). */
const NO_COVER = new Set(['/on-pigeon-towers.html'])

export const mediaJobs = ({
  people,
  press,
  publications,
  courses,
  pages,
}: {
  people: Array<{ name: string; legacy_url: string; photo?: string | null }>
  press: Array<{ outlet: string | null; logo?: string | null }>
  publications: Array<{ legacy_url: string; title_en: string; title_ar: string | null }>
  courses: Array<{ legacy_url: string; title: string; title_ar: string | null }>
  pages: Page[]
}): MediaJob[] => {
  const jobs: MediaJob[] = []

  for (const p of people) {
    if (p.photo)
      jobs.push({
        collection: 'people',
        legacy_url: p.legacy_url,
        field: 'photo',
        path: stripQuery(p.photo),
        alt: p.name,
      })
  }

  const outlets = new Set<string>()
  for (const item of press) {
    if (!item.outlet || !item.logo || outlets.has(item.outlet)) continue
    outlets.add(item.outlet)
    jobs.push({
      collection: 'press',
      name: item.outlet,
      field: 'outlet.logo',
      path: stripQuery(item.logo),
      alt: item.outlet,
    })
  }

  const byUrl = new Map(pages.map((p) => [p.legacy_url, p]))
  for (const pub of publications) {
    if (NO_COVER.has(pub.legacy_url)) continue
    const image = firstImage(byUrl.get(pub.legacy_url)?.text ?? '')
    if (image) {
      jobs.push({
        collection: 'publications',
        legacy_url: pub.legacy_url,
        field: 'cover_image',
        path: image,
        alt: pub.title_en || pub.title_ar || '',
      })
    }
  }

  const perPage = new Map<string, number>()
  for (const c of courses)
    perPage.set(c.legacy_url.split('#')[0], (perPage.get(c.legacy_url.split('#')[0]) ?? 0) + 1)
  for (const c of courses) {
    const url = c.legacy_url.split('#')[0]
    const page = byUrl.get(url)
    if (!page || page.kind !== 'course' || perPage.get(url) !== 1) continue
    const image = firstImage(page.text)
    if (image)
      jobs.push({
        collection: 'courses',
        legacy_url: c.legacy_url,
        field: 'cover_image',
        path: image,
        alt: c.title || c.title_ar || '',
      })
  }

  return jobs
}

/**
 * Rewrites every `link` node's url in a Lexical tree through `map` (null keeps
 * it). Returns a copy and the number of links changed.
 */
export const rewriteLinks = <T>(
  tree: T,
  map: (url: string) => string | null,
): { tree: T; count: number } => {
  let count = 0
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (!node || typeof node !== 'object') return node
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) out[k] = walk(v)
    const fields = out.fields as { url?: unknown } | undefined
    if (out.type === 'link' && typeof fields?.url === 'string') {
      const next = map(fields.url)
      if (next && next !== fields.url) {
        out.fields = { ...fields, url: next }
        count++
      }
    }
    return out
  }
  return { tree: walk(tree) as T, count }
}

/**
 * The PDFs the archive content points at: a publication's print edition and a
 * newsletter's "Original PDF" link. Both are set to the media file's URL.
 */
export const pdfJobs = ({
  publications,
  newsletters,
}: {
  publications: Array<{ legacy_url: string; title_en: string; print_edition_url?: string | null }>
  newsletters: Array<{ legacy_url: string; title_en: string; archive_url?: string | null }>
}): MediaJob[] => {
  const jobs: MediaJob[] = []
  for (const p of publications) {
    const path = p.print_edition_url ? uploadsPath(p.print_edition_url) : null
    if (path)
      jobs.push({
        collection: 'publications',
        legacy_url: p.legacy_url,
        field: 'print_edition_url',
        path,
        alt: p.title_en,
      })
  }
  for (const n of newsletters) {
    const path =
      n.archive_url && /\.pdf$/i.test(stripQuery(n.archive_url)) ? uploadsPath(n.archive_url) : null
    if (path)
      jobs.push({
        collection: 'newsletters',
        legacy_url: n.legacy_url,
        field: 'body_pdf_link',
        path,
        alt: n.title_en,
      })
  }
  return jobs
}
