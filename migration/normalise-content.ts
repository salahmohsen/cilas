/**
 * Stage 3 for the publishing content: migration/extracted/content/*.json →
 * seed/data/archive/{articles,publications,press,events,newsletters}.json and
 * migration/review/content.md (every guess and gap, for a person to check).
 *
 *   npx tsx migration/normalise-content.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { slugify } from '../src/lib/slugify'
import { weekdayOf } from '../src/lib/cairo-day'
import {
  BlogPage,
  NewsPage,
  NewsletterSources,
  PressPage,
  PublicationPage,
  Toc,
  Essay,
} from './lib/content-schemas'
import {
  absolutizeLinks,
  arabicNameMap,
  creditRole,
  foldArabic,
  hyphenationSpots,
  licenseOf,
  outletFromUrl,
  pairEssays,
  pressDate,
} from './lib/normalise-content'
import { canonicalName } from './lib/normalise-courses'
import { resolveUpload } from './lib/uploads'

const here = import.meta.dirname
const root = path.join(here, '..')
const aliases = JSON.parse(readFileSync(path.join(here, 'aliases.json'), 'utf8')) as Record<string, string[]>
const manifest = JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf8')) as {
  pages: Array<{ file: string; legacy_url: string; title: string; uploads: Array<{ path: string; missing: boolean }> }>
}
const docs = JSON.parse(readFileSync(path.join(here, 'docs.json'), 'utf8')) as Array<{ id: string; file: string }>
const people = JSON.parse(readFileSync(path.join(root, 'seed/data/archive/people.json'), 'utf8')) as Array<{ name: string }>
const known = new Set(people.map((p) => p.name))

const uploadFiles = new Set(manifest.pages.flatMap((p) => p.uploads.map((u) => u.path)))
for (const d of docs) uploadFiles.add(d.file)
const docFile = (id: string): string => {
  const d = docs.find((x) => x.id === id)
  if (!d) throw new Error(`docs.json has no ${id}`)
  return d.file
}

const SITE = 'https://www.ci-las.org/'
const siteUrl = (p: string): string => SITE + encodeURI(p)

const unit = <T>(name: string, schema: { parse: (x: unknown) => T }): T =>
  schema.parse(JSON.parse(readFileSync(path.join(here, 'extracted', 'content', `${name}.json`), 'utf8')).data)

/* ------------------------------------------------------------ review log */

const review = {
  pairing: [] as string[],
  titles: [] as string[],
  intro: [] as string[],
  blog: [] as string[],
  undated: [] as string[],
  notImported: [] as string[],
  outlets: [] as string[],
  links: [] as string[],
  other: [] as string[],
  hyphens: [] as string[],
}
const unresolvedArabic = new Set<string>()
const resolvedArabic = new Map<string, string>()
const usedNames = new Set<string>()

/* ---------------------------------------------------------------- names */

// Original authors of the booklet's essays, in Latin script as the dev seed
// gives them (the booklet itself prints them in Arabic).
const KNOWN_ARABIC: Record<string, string> = {
  'شريا جانسنز-سانون': 'Shereen Janzen-Sanson',
  'شليبا جابن': 'Shelba Jain',
  'شليبا جاين': 'Shelba Jain',
  'مانيش جابن': 'Manish Jain',
  'مانيش جاين': 'Manish Jain',
  'جوستابو إستيبا': 'Gustavo Esteva',
  'جوستابو إستبا': 'Gustavo Esteva',
  'رون ميلر': 'Ron Miller',
  'كريس رايت': 'Chris Wright',
  'فيكي أ. جاكوبز': 'Vicki A. Jacobs',
  'فريدة مقار': 'Farida Makar',
}
const arabicMap = new Map<string, string>(Object.entries(KNOWN_ARABIC).map(([k, v]) => [foldArabic(k), v]))
const ARABIC = /[؀-ۿ]/

const nameOf = (raw: string): string => {
  const name = raw.replace(/\s+/g, ' ').trim()
  let out: string
  if (ARABIC.test(name)) {
    const latin = arabicMap.get(foldArabic(name))
    if (latin) {
      out = canonicalName(latin, aliases)
      resolvedArabic.set(name, out)
    } else {
      unresolvedArabic.add(name)
      out = name
    }
  } else {
    out = canonicalName(name, aliases)
  }
  usedNames.add(out)
  return out
}
const namesOf = (xs: string[]): string[] => [...new Set(xs.map(nameOf))]

/* ---------------------------------------------------------------- blocks */

type Blk = { type: 'heading' | 'paragraph' | 'quote' | 'list_item' | 'note'; level: number | null; text: string }

const fixUpload = (p: string): string => {
  const r = resolveUpload(p, uploadFiles)
  if (r && !r.missing) return encodeURI(r.path)
  // A name whose Arabic mark was cut off in the link ("..._-_Ùarabic.pdf").
  if (/pigeon_towers_-_.{0,3}arabic\.pdf$/i.test(p)) return encodeURI(docFile('on_the_emergence_of_pigeon_towers_-_arabic'))
  review.links.push(`- upload link not found in the archive: ${p}`)
  return encodeURI(p)
}
const blocksOf = (blocks: Blk[]): Blk[] =>
  blocks.map((b) => ({ type: b.type, level: b.level, text: absolutizeLinks(b.text, fixUpload) }))

const scanHyphens = (where: string, blocks: Blk[]) => {
  const spots = blocks.flatMap((b) => hyphenationSpots(b.text))
  if (spots.length) review.hyphens.push(`- ${where}: ${spots.map((s) => `"${s}"`).join(', ')}`)
}

/* ---------------------------------------------------------------- credits */

type Credit = { role: string; label?: { en?: string; ar?: string }; people: string[] }

const COMBINED: Record<string, { en: string; ar: string }> = {
  supervisor_and_coordinator: { en: 'Supervision & coordination', ar: 'إشراف وتنسيق' },
  translator_and_editor: { en: 'Translation & editing', ar: 'ترجمة وتحرير' },
}

const creditsOf = (lines: Array<{ role: string; names: string[] }>): Credit[] =>
  lines.map((line) => {
    const role = creditRole(line.role)
    const credit: Credit = { role, people: namesOf(line.names) }
    if (COMBINED[line.role]) credit.label = COMBINED[line.role]
    else if (role === 'other') credit.label = ARABIC.test(line.role) ? { ar: line.role } : { en: line.role }
    else if (/&|\band\b|وتحرير|وتنسيق/.test(line.role)) credit.label = ARABIC.test(line.role) ? { ar: line.role } : { en: line.role }
    if (role === 'other') review.other.push(`- credit role "${line.role}" is not a known role; kept as "other" with its label`)
    return credit
  })

/* ------------------------------------------------------------------ slugs */

const taken = new Set<string>()
const legacy = (page: string, title: string): string => {
  const slug = slugify(title) || 'item'
  let url = `${page}#${slug}`
  for (let n = 2; taken.has(url); n++) url = `${page}#${slug}-${n}`
  taken.add(url)
  return url
}

/* ================================================================ articles */

type Article = {
  legacy_url: string
  kind: 'essay' | 'blog'
  title_en: string
  title_ar: string | null
  match_titles_en: string[]
  blocks_en: Blk[] | null
  blocks_ar: Blk[] | null
  authors: string[]
  credits: Credit[]
  translation: null | {
    original_language: 'en'
    original_title: string | null
    original_authors: string[]
    original_source: string | null
  }
  publication: string | null
  published_date: string | null
}
const articles: Article[] = []

/* ---- Pigeon Towers: English + Arabic books, paired by order. */
const PIGEON = '/on-pigeon-towers.html'
const TRANSLATION = '/translation-as-education.html'
const pigeonEn = 'on_the_emergence_of_pigeon_towers_-_english'
const pigeonAr = 'on_the_emergence_of_pigeon_towers_-_arabic'
const tocEn = unit(`toc__${pigeonEn}`, Toc)
const tocAr = unit(`toc__${pigeonAr}`, Toc)
const { pairs, problems } = pairEssays(tocEn, tocAr)
review.pairing.push(
  ...(problems.length ? problems.map((p) => `- Pigeon Towers: ${p}`) : [`- Pigeon Towers: ${pairs.length} English essays paired with ${pairs.length} Arabic essays by order, none left over`]),
)

// The Arabic essays name no translator; the Arabic imprint credits the translation.
const pigeonTranslators = tocAr.imprint.credits
  .filter((c) => creditRole(c.role) === 'translator')
  .map((c) => namesOf(c.names))
  .flat()
review.pairing.push(`- Translator credit on every Pigeon Towers article comes from the Arabic imprint (ترجمة): ${pigeonTranslators.join(', ')}`)

const PIGEON_SEED_TITLES: Record<number, string> = { 1: 'On the Emergence of Pigeon Towers: Foreword' }
const pigeonUrls = new Map<number, string>()
for (const pair of pairs) {
  if (!pair.en || !pair.ar) continue
  const en = unit(`essay__${pigeonEn}__${pair.order}`, Essay)
  const ar = unit(`essay__${pigeonAr}__${pair.order}`, Essay)
  const url = legacy(PIGEON, pair.en.title)
  pigeonUrls.set(pair.order, url)
  const blocksEn = blocksOf(en.blocks)
  scanHyphens(`${url} (English)`, blocksEn)
  articles.push({
    legacy_url: url,
    kind: 'essay',
    title_en: pair.en.title,
    title_ar: pair.ar.title,
    match_titles_en: PIGEON_SEED_TITLES[pair.order] ? [PIGEON_SEED_TITLES[pair.order]] : [],
    blocks_en: blocksEn,
    blocks_ar: blocksOf(ar.blocks),
    authors: namesOf(en.authors.length ? en.authors : pair.en.authors),
    credits: pigeonTranslators.length ? [{ role: 'translator', people: pigeonTranslators }] : [],
    translation: null,
    publication: PIGEON,
    published_date: null,
  })
}
review.titles.push(
  '- Article titles come from the table of contents (the full title), not the essay\'s own title/subtitle split.',
  `- The foreword is titled "Foreword" (and Arabic "مقدمة"); it lists "${PIGEON_SEED_TITLES[1]}" in \`match_titles_en\` so the dev seed's article is still found.`,
)

/* ---- Translation Lab booklet: Arabic only. */
const lab = 'translation_lab_works'
const tocLab = unit(`toc__${lab}`, Toc)
const labPage = unit('page__translation-as-education.html', PublicationPage)

// The booklet's page and imprint list the same people in the same order.
for (const [k, v] of arabicNameMap(labPage.credits, tocLab.imprint.credits)) arabicMap.set(k, v)

// English titles of the five translated essays, from the dev seed (the booklet is Arabic only).
const LAB_SEED_TITLES: Record<number, string> = {
  2: 'Recovering from the Diploma Disease',
  3: 'Reclaiming Our Fire in Education',
  4: 'A Short History of Alternative Education',
  5: 'On How to Read Theoretical Works',
  6: 'Reading, Writing, and Understanding',
}
const labUrls = new Map<number, string>()
for (const toc of tocLab.essays) {
  const essay = unit(`essay__${lab}__${toc.order}`, Essay)
  const seedTitle = LAB_SEED_TITLES[toc.order]
  const titleEn = seedTitle ?? toc.title
  const url = legacy(TRANSLATION, titleEn)
  labUrls.set(toc.order, url)
  if (!seedTitle) {
    review.titles.push(
      `- ${url}: no English title exists (the booklet is Arabic only and the dev seed has no matching article), so the Arabic title "${toc.title}" is used as \`title_en\`. The Articles collection requires a title; give it an English one if wanted.`,
    )
  }
  const translated = Boolean(seedTitle)
  const translators = namesOf(essay.translators)
  const authors = namesOf(essay.authors.length ? essay.authors : toc.authors)
  articles.push({
    legacy_url: url,
    kind: 'essay',
    title_en: titleEn,
    title_ar: toc.title,
    match_titles_en: seedTitle ? [seedTitle] : [],
    blocks_en: null,
    blocks_ar: blocksOf(essay.blocks),
    authors,
    credits: translators.length ? [{ role: 'translator', people: translators }] : [],
    translation: translated
      ? {
          original_language: 'en',
          original_title: essay.original?.title ?? null,
          original_authors: essay.original?.authors.length ? namesOf(essay.original.authors) : authors,
          original_source: essay.original?.source ?? null,
        }
      : null,
    publication: TRANSLATION,
    published_date: null,
  })
}
review.titles.push(
  `- Booklet essays 2-6 take their English titles from the dev seed: ${Object.values(LAB_SEED_TITLES).map((t) => `"${t}"`).join(', ')}. Their Arabic titles are the booklet's table of contents (a few differ slightly from the seed's Arabic titles).`,
  '- Booklet articles list the original authors as `authors` (as the essay prints them) and again as `translation.original_authors`; the translators are credits. `original_language` is "en" for all five (inferred: the sources are English-language publications).',
)

/* ---- Blog: the three 2015 posts. */
const blog = unit('page__-latest.html', BlogPage)
const WRITERS: Array<[RegExp, string]> = [[/\bFayez\b/, 'Mohamed Fayez']]
for (const post of blog.posts) {
  const text = post.blocks.map((b) => b.text).join('\n')
  let authors = post.authors
  if (!authors.length) {
    const hit = WRITERS.find(([re]) => re.test(text) && /written by|account of/i.test(text))
    if (hit) {
      authors = [hit[1]]
      review.blog.push(`- "${post.title}": the post says the account was "written by the young gentleman with the red hair, otherwise known as Fayez"; author set to ${hit[1]} (the only Fayez in people.json). Check.`)
    } else {
      authors = ['Karim-Yassin Goessinger']
      review.blog.push(`- "${post.title}": names no author; set to Karim-Yassin Goessinger, who wrote the blog. Check.`)
    }
  }
  const blocks = blocksOf(post.blocks)
  const url = legacy('/-latest.html', post.title)
  scanHyphens(url, blocks)
  articles.push({
    legacy_url: url,
    kind: 'blog',
    title_en: post.title,
    title_ar: null,
    match_titles_en: [],
    blocks_en: blocks,
    blocks_ar: null,
    authors: namesOf(authors),
    credits: [],
    translation: null,
    publication: null,
    published_date: post.date,
  })
  if (!post.date) review.undated.push(`- blog post "${post.title}" has no date`)
}

/* ============================================================ publications */

const introBlocks = (blocks: Blk[], from: RegExp, to: RegExp): Blk[] => {
  const a = blocks.findIndex((b) => from.test(b.text))
  const z = blocks.findIndex((b) => to.test(b.text))
  if (a < 0 || z < a) throw new Error('could not find the publication introduction')
  return blocks.slice(a, z + 1)
}

const pigeonPage = unit('page__on-pigeon-towers.html', PublicationPage)
const pigeonIntro = introBlocks(pigeonPage.intro, /^The idea behind a collection of essays/, /^I hope you enjoy/)
review.intro.push(
  `- Pigeon Towers: the page's text (${pigeonPage.intro.length} blocks) is the foreword (with two epigraphs, Goodman and Darwish, in blocks 1-7), then the contributors' bios. The publication's introduction is only the part about the collection itself: blocks ${pigeonPage.intro.indexOf(pigeonIntro[0]) + 1}-${pigeonPage.intro.indexOf(pigeonIntro[pigeonIntro.length - 1]) + 1}, from "The idea behind a collection of essays…" to "I hope you enjoy the collection of essays!". Left out: the epigraphs, the Ivory Tower/Pigeon Tower foreword (it is the foreword article), and the six bios (${pigeonPage.intro.length - pigeonPage.intro.indexOf(pigeonIntro[pigeonIntro.length - 1]) - 1} blocks). The bios are not imported anywhere yet.`,
  '- Pigeon Towers intro still says the recordings are "coming shortly / coming soon" (the old page text); edit if they never appeared.',
  '- The two PDF links in that intro are made absolute; the Arabic one had a cut-off character in the page and was repaired from the archive file name.',
)
const labIntro = labPage.intro.filter((b) => !/^\[[^\]]*\]\(uploads\/[^)]*\.pdf\)$/.test(b.text.trim()))
review.intro.push(
  `- Translation as Education: the page text is only its introduction (${labPage.intro.length} blocks); the last, a "click to read" link to the PDF, is dropped from the intro because it becomes \`print_edition_url\`.`,
)

const FUNDERS: Array<[RegExp, string]> = [
  [/arab council/i, 'Arab Council for the Social Sciences'],
  [/ford/i, 'Ford Foundation'],
]
const funderName = (n: string): string => FUNDERS.find(([re]) => re.test(n))?.[1] ?? n.trim()

const pigeonCredits: Credit[] = creditsOf(tocEn.imprint.credits)
for (const line of pigeonPage.credits) {
  if (creditRole(line.role) === 'author') {
    pigeonCredits.push({ role: 'author', label: { en: 'Contributing authors' }, people: namesOf(line.names) })
  }
}

const labPageLicense = licenseOf(labPage.license)
const labLicense = licenseOf(tocLab.imprint.license)
if (labPageLicense && labPageLicense !== labLicense) {
  review.other.push(
    `- Translation as Education: the imprint says "${tocLab.imprint.license}" (${labLicense}) but the page says Creative Commons BY-SA 3.0 (${labPageLicense}). Used the imprint, as the plan decides.`,
  )
}

const pigeonLegacy = (order: number): string => pigeonUrls.get(order) as string
const publications = [
  {
    legacy_url: PIGEON,
    kind: 'essay_collection' as const,
    title_en: 'On the Emergence of Pigeon Towers',
    title_ar: null,
    subtitle_en: null,
    subtitle_ar: null,
    match_titles_en: ['On the Emergence of Pigeon Towers'],
    year_from: tocEn.imprint.year,
    year_to: tocEn.imprint.year,
    intro_en: blocksOf(pigeonIntro),
    intro_ar: null,
    foreword: pigeonLegacy(tocEn.essays.find((e) => e.is_foreword)?.order ?? 1),
    articles: tocEn.essays.filter((e) => !e.is_foreword).map((e) => pigeonLegacy(e.order)),
    credits: pigeonCredits,
    funders: pigeonPage.funders.map(funderName),
    license: licenseOf(tocEn.imprint.license),
    produced_by: [] as string[],
    print_edition_url: siteUrl(docFile(pigeonEn)),
  },
  (() => {
    const [title, ...rest] = labPage.title.split(':')
    return {
      legacy_url: TRANSLATION,
      kind: 'translation_booklet' as const,
      title_en: 'Translation as Education',
      title_ar: title.trim(),
      subtitle_en: null,
      subtitle_ar: rest.join(':').trim() || null,
      match_titles_en: ['Works of the Translation Lab'],
      year_from: 2016,
      year_to: tocLab.imprint.year,
      intro_en: null,
      intro_ar: blocksOf(labIntro),
      foreword: labUrls.get(tocLab.essays.find((e) => e.is_foreword)?.order ?? 1) as string,
      articles: tocLab.essays.filter((e) => !e.is_foreword).map((e) => labUrls.get(e.order) as string),
      credits: creditsOf(labPage.credits),
      funders: labPage.funders.map(funderName),
      license: labLicense,
      produced_by: [] as string[],
      print_edition_url: siteUrl(docFile(lab)),
    }
  })(),
]
review.other.push(
  '- Pigeon Towers `print_edition_url` is the English PDF (the field holds one URL); the Arabic PDF is ' + siteUrl(docFile(pigeonAr)) + '.',
  '- Translation as Education: title_en "Translation as Education" (Arabic title and subtitle split at the page title\'s colon). The dev seed calls it "Works of the Translation Lab", kept in `match_titles_en`. Pigeon Towers has no Arabic title in the extraction; the dev seed has one.',
  '- `produced_by` is empty for both: courses.json has no 2016-2018 Translation Lab course (only labs from 2021 on).',
  '- Booklet credits use the page\'s roles (the page calls the last-but-two line proofreading; the imprint says مراجعة لغوية). Arabic names are mapped to the imprint\'s Latin spelling line by line.',
  '- Book year_from for the booklet is 2016 (from the title "2016 - 2018"); Pigeon Towers is 2018 (imprint).',
)

/* ================================================================== press */

const press = unit('page__press.html', PressPage)
const pressOut = press.items.map((item) => {
  const date = pressDate(item.date)
  let outlet = item.outlet
  let derived = false
  if (!outlet) {
    outlet = item.links.map((l) => outletFromUrl(l.url)).find(Boolean) ?? null
    if (outlet) {
      derived = true
      review.outlets.push(`- "${item.title}": outlet "${outlet}" derived from the link domain (the page names none)`)
    } else {
      review.outlets.push(`- "${item.title}": no outlet on the page and none derivable from ${item.links[0]?.url}`)
    }
  }
  const links = item.links.map((l) => {
    let url = l.url
    if (/^uploads\//.test(url)) {
      // Arabic file names arrive mis-decoded; the page's own uploads hold the real one.
      const real = manifest.pages
        .find((pg) => pg.file === 'press.html')
        ?.uploads.map((u) => u.path)
        .find((u) => ARABIC.test(u) && /\.pdf$/i.test(u))
      const fixed = real && /[\u0080-\u00ff]/.test(url) ? encodeURI(real) : fixUpload(url)
      url = SITE + fixed
    }
    const mirror = /^https?:\/\/[^/]*appspot\.com\/(madamasr\.com\/.+?)(\?.*)?$/.exec(url)
    if (mirror) {
      url = `https://www.${mirror[1]}`
      review.links.push(`- "${item.title}": link was a mirror (${l.url.slice(0, 60)}…); rewritten to ${url}`)
    }
    return { language: l.language, url }
  })
  if (new Set(links.map((l) => l.url)).size < links.length) {
    review.links.push(`- "${item.title}": two links with the same address but different languages (${links.map((l) => l.language).join(', ')}); kept as the page has them`)
  }
  if (!date) review.undated.push(`- press item "${item.title}" has no date`)
  return {
    legacy_url: legacy('/press.html', item.title),
    kind: item.kind,
    title: item.title,
    language: links[0]?.language ?? null,
    outlet,
    outlet_derived: derived,
    authors: namesOf(item.authors),
    published_date: date?.date ?? null,
    date_precision: date?.precision ?? null,
    links,
    excerpt: item.excerpt,
    logo: item.logo,
  }
})
review.outlets.push('- Outlet names follow the dev seed\'s partners (e.g. "OpenDemocracy"), so an import finds them.')

/* ================================================================= events */

const news = unit('page__news-and-events.html', NewsPage)
const events = news.posts
  .filter((p) => p.is_gathering)
  .map((p) => {
    const slots =
      p.date && p.start_time && p.end_time
        ? [{ weekday: weekdayOf(p.date), start_time: p.start_time, end_time: p.end_time }]
        : []
    if (!p.date) review.undated.push(`- event "${p.title}" has no date`)
    if (p.start_time && !p.end_time) {
      review.other.push(`- event "${p.title}": only a start time (${p.start_time}) is stated, so it has no slot (a slot needs an end); the time is in the description if the page gives it`)
    }
    return {
      legacy_url: legacy('/news-and-events.html', p.title),
      title_en: p.title,
      event_type: p.event_type ?? 'other',
      tier: 'public' as const,
      schedule: { start_date: p.date, start_precision: 'day' as const, weeks: 1, slots },
      speakers: namesOf(p.speakers),
      description_en: blocksOf(p.blocks),
    }
  })
for (const p of news.posts.filter((x) => !x.is_gathering)) {
  review.notImported.push(`- "${p.title}" (${p.date ?? 'undated'}): not a gathering, not imported`)
}
const sameDay = events.filter((e, i) => events.findIndex((o) => o.schedule.start_date === e.schedule.start_date) !== i)
for (const e of sameDay) {
  review.other.push(`- event "${e.title_en}" is on the same day as another event; it looks like a second post about the same day (the open day schedule). Both imported; consider merging.`)
}

/* ============================================================== newsletters */

const nlDoc = unit('doc__newsletter-1', NewsletterSources)
const issues = unit('page__events-documents.html', NewsletterSources)
const nlDocIssue = nlDoc.issues[0]
const newsletters = issues.issues.map((issue) => {
  const isPdf = Boolean(issue.archive_url && /^uploads\//.test(issue.archive_url))
  const archive = issue.archive_url ? (isPdf ? SITE + fixUpload(issue.archive_url) : issue.archive_url) : null
  const date = pressDate(issue.date)
  if (!date) review.undated.push(`- newsletter "${issue.title}" has no date`)
  let blocks: Blk[]
  if (isPdf) {
    if (!nlDocIssue) throw new Error('doc__newsletter-1 has no issue')
    blocks = [
      ...blocksOf(nlDocIssue.blocks),
      { type: 'paragraph', level: null, text: `Original PDF: [${issue.title}](${archive})` },
    ]
  } else {
    blocks = archive ? [{ type: 'paragraph', level: null, text: `Read this issue online: [${issue.title}](${archive})` }] : []
  }
  return {
    legacy_url: legacy('/events-documents.html', issue.title),
    title_en: issue.title,
    issue_date: date?.date ?? null,
    date_precision: date?.precision ?? null,
    archive_url: archive,
    blocks_en: blocks,
  }
})
review.other.push(
  `- Newsletter issue 1 appears on the events-documents page (PDF link) and as the doc unit; output once, with the doc unit's text plus a closing "Original PDF" link, and \`archive_url\` set to the PDF.`,
  `- Newsletter dates are month-precise (the first of the month) except where the page gives a day. The title "December 2019 - Janurary 2020" keeps the page's spelling.`,
)

/* ================================================================= output */

const outDir = path.join(root, 'seed', 'data', 'archive')
mkdirSync(outDir, { recursive: true })
const write = (name: string, data: unknown) => writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`)
write('articles', articles)
write('publications', publications)
write('press', pressOut)
write('events', events)
write('newsletters', newsletters)

const noPerson = [...usedNames].filter((n) => !ARABIC.test(n) && !known.has(n)).sort()
const section = (title: string, lines: string[], empty = '- none'): string => `## ${title}\n\n${(lines.length ? lines : [empty]).join('\n')}\n`
const md = [
  '# Publishing content: to check',
  '',
  'Generated by `normalise-content.ts`. Each line is a guess or a gap.',
  '',
  `Counts: ${articles.length} articles (${articles.filter((a) => a.kind === 'essay').length} essays, ${articles.filter((a) => a.kind === 'blog').length} blog posts), ${publications.length} publications, ${pressOut.length} press items, ${events.length} events, ${newsletters.length} newsletters.`,
  '',
  section('Essay pairing', review.pairing),
  section('Titles', review.titles),
  section('Publication introductions', review.intro),
  section('Blog authors', review.blog),
  section('Undated', review.undated),
  section('News posts not imported', review.notImported),
  section('Press outlets', review.outlets),
  section('Links', review.links),
  section('Other judgement calls', review.other),
  section(
    'Arabic-script names kept as written (no alias or imprint match)',
    [...unresolvedArabic].sort().map((n) => `- ${n}`),
  ),
  section(
    'Arabic-script names resolved to a Latin spelling (check)',
    [...resolvedArabic].sort().map(([a, l]) => `- ${a} → ${l}`),
  ),
  section('Names with no match in people.json (an import creates them as needs_review)', noPerson.map((n) => `- ${n}`)),
  section('Line-end hyphens left in English text (not fixed)', review.hyphens),
].join('\n')
mkdirSync(path.join(here, 'review'), { recursive: true })
writeFileSync(path.join(here, 'review', 'content.md'), md)

console.log(
  `${articles.length} articles, ${publications.length} publications, ${pressOut.length} press, ${events.length} events, ${newsletters.length} newsletters; ${unresolvedArabic.size} Arabic names unresolved`,
)
