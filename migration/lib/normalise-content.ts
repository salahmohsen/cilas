import type { Toc } from './content-schemas'

export type CreditRole =
  | 'author'
  | 'editor'
  | 'translator'
  | 'copy_editor'
  | 'proofreader'
  | 'supervisor'
  | 'coordinator'
  | 'art_director'
  | 'cover_designer'
  | 'illustrator'
  | 'photographer'
  | 'other'

export type LicenseValue = 'cc_by_nc_sa' | 'cc_by_sa' | 'cc_by' | 'all_rights_reserved'

type TocEssay = Toc['essays'][number]

export type EssayPair = { order: number; en: TocEssay | null; ar: TocEssay | null }

/**
 * Pairs the essays of two tables of contents by `order`. An order only one
 * book has stays in the result with a null side, and every mismatch is
 * explained in `problems`.
 */
export const pairEssays = (
  enToc: Pick<Toc, 'essays'>,
  arToc: Pick<Toc, 'essays'>,
): { pairs: EssayPair[]; problems: string[] } => {
  const problems: string[] = []
  if (enToc.essays.length !== arToc.essays.length) {
    problems.push(`English has ${enToc.essays.length} essays, Arabic has ${arToc.essays.length}`)
  }
  const en = new Map(enToc.essays.map((e) => [e.order, e]))
  const ar = new Map(arToc.essays.map((e) => [e.order, e]))
  const orders = [...new Set([...en.keys(), ...ar.keys()])].sort((a, b) => a - b)
  const pairs = orders.map((order) => {
    const pair = { order, en: en.get(order) ?? null, ar: ar.get(order) ?? null }
    if (!pair.en)
      problems.push(`order ${order}: no English essay for the Arabic "${pair.ar?.title}"`)
    if (!pair.ar)
      problems.push(`order ${order}: no Arabic essay for the English "${pair.en?.title}"`)
    return pair
  })
  return { pairs, problems }
}

/**
 * The credit role an imprint or page label names. Combined labels
 * ("Translation & editing") give the first role; English, Arabic and the
 * extractor's snake_case labels are all understood. Anything else is `other`.
 */
export const creditRole = (label: string): CreditRole => {
  const l = label
    .toLowerCase()
    .replace(/[_&\-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const has = (...needles: string[]) => needles.some((n) => l.includes(n))
  if (has('copy edit', 'مراجعة لغوية')) return 'copy_editor'
  if (has('proofread', 'تدقيق')) return 'proofreader'
  if (has('art direct', 'الإخراج الفني', 'اخراج فني')) return 'art_director'
  if (has('cover design', 'تصميم الغلاف')) return 'cover_designer'
  if (has('supervis', 'إشراف', 'اشراف')) return 'supervisor'
  if (has('coordinat', 'تنسيق')) return 'coordinator'
  if (has('translat', 'ترجمة')) return 'translator'
  if (has('edit', 'تحرير')) return 'editor'
  if (has('illustrat', 'رسوم')) return 'illustrator'
  if (has('photograph', 'تصوير')) return 'photographer'
  if (has('author', 'contributor', 'تأليف')) return 'author'
  return 'other'
}

/** A press date as the page states it: YYYY, YYYY-MM or YYYY-MM-DD. */
export const pressDate = (
  value: string | null,
): { date: string; precision: 'year' | 'month' | 'day' } | null => {
  if (!value) return null
  if (/^\d{4}$/.test(value)) return { date: `${value}-01-01`, precision: 'year' }
  if (/^\d{4}-\d{2}$/.test(value)) return { date: `${value}-01`, precision: 'month' }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: value, precision: 'day' }
  return null
}

/** The `license` option for a licence line (or a sentence containing a licence URL). */
export const licenseOf = (text: string | null): LicenseValue | null => {
  if (!text) return null
  const l = text.toLowerCase().replace(/[_\-\s]+/g, ' ')
  if (/all rights reserved/.test(l)) return 'all_rights_reserved'
  if (/\bby nc sa\b/.test(l)) return 'cc_by_nc_sa'
  if (/\bby sa\b/.test(l)) return 'cc_by_sa'
  if (/\bcc by\b/.test(l)) return 'cc_by'
  return null
}

/** Whether `host` is `domain` or one of its subdomains. */
const onDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)

const OUTLETS: Array<[domain: string, name: string]> = [
  ['madamasr.com', 'Mada Masr'],
  ['opendemocracy.net', 'OpenDemocracy'],
  ['mashallahnews.com', 'Mashallah News'],
  ['egyptianstreets.com', 'Egyptian Streets'],
  ['al-fanarmedia.org', 'Al-Fanar Media'],
  ['goethe.de', 'Goethe-Institut'],
  ['sciencespo.fr', 'Sciences Po'],
]

/**
 * An outlet name guessed from a link's domain. A mirror host (appspot.com)
 * carries the original domain as the first path segment, so that is used.
 */
export const outletFromUrl = (url: string): string | null => {
  let host: string
  let first = ''
  try {
    const u = new URL(url)
    host = u.hostname.toLowerCase()
    first = u.pathname.split('/')[1]?.toLowerCase() ?? ''
  } catch {
    return null
  }
  const hosts = onDomain(host, 'appspot.com') ? [first, host] : [host]
  for (const h of hosts) {
    for (const [domain, name] of OUTLETS) {
      if (onDomain(h, domain)) return name
    }
  }
  return null
}

/** Arabic text reduced to what makes two spellings of a name the same. */
export const foldArabic = (text: string): string =>
  text
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Arabic-script names to the Latin spelling the imprint gives, by position:
 * the booklet's page and its imprint list the same people in the same order,
 * credit line by credit line. Lines that do not line up map nothing. Keys are
 * folded (see foldArabic).
 */
export const arabicNameMap = (
  arabic: Array<{ names: string[] }>,
  latin: Array<{ names: string[] }>,
): Map<string, string> => {
  const map = new Map<string, string>()
  if (arabic.length !== latin.length) return map
  arabic.forEach((line, i) => {
    if (line.names.length !== latin[i].names.length) return
    line.names.forEach((name, j) => map.set(foldArabic(name), latin[i].names[j]))
  })
  return map
}

const SITE = 'https://www.ci-las.org/'

/**
 * Markdown links made absolute: site-relative ones point at the old site (the
 * redirects of 6.6 take it from there), and Facebook's `l.php?u=` wrapper is
 * replaced by the address it hides. `fixUpload` may repair an uploads/ path.
 */
export const absolutizeLinks = (text: string, fixUpload?: (href: string) => string): string =>
  text.replace(/\]\(([^)\s]+)\)/g, (_, href: string) => {
    let url = href
    const wrapped = /^https?:\/\/(?:www\.)?facebook\.com\/l\.php\?u=([^&]+)/.exec(url)
    if (wrapped) {
      try {
        url = decodeURIComponent(wrapped[1])
      } catch {
        /* keep the wrapper */
      }
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('#')) {
      const path = url.replace(/^\//, '')
      url = SITE + (fixUpload && path.startsWith('uploads/') ? fixUpload(path) : path)
    }
    return `](${url})`
  })

/** Spots where a hyphen was left at a line end ("out- side"). */
export const hyphenationSpots = (text: string): string[] =>
  [...text.matchAll(/\p{L}+- (\p{Ll}+)/gu)].filter((m) => !/^(and|or)$/.test(m[1])).map((m) => m[0])
