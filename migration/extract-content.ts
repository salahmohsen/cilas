/**
 * Stage 2 for the publishing content → migration/extracted/content/<unit>.json.
 * An agent works unit by unit, on the Claude Code subscription (no API key):
 *   npx tsx migration/extract-content.ts migration/raw --pending
 *   npx tsx migration/extract-content.ts migration/raw --prompt <unit>
 *   npx tsx migration/extract-content.ts migration/raw --record <unit> <answer.json>
 * Units: toc:<doc> (pass 1), essay:<doc>:<order> (pass 2, once the doc's Toc is
 * recorded), page:<file>, doc:newsletter-1. Input comes from prepare-docs.ts.
 * The prompt (and so the hash) includes page-image paths, not image bytes.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type * as z from 'zod'

import { agentPrompt, isCurrent, recordAnswer } from './lib/agent-extract'
import {
  blogPrompt,
  BlogPage,
  CONTENT_PROMPT_VERSION,
  Essay,
  essayPrompt,
  NewsletterSources,
  newsletterPrompt,
  NewsPage,
  newsPrompt,
  PressPage,
  pressPrompt,
  PublicationPage,
  publicationPrompt,
  Toc,
  tocPrompt,
} from './lib/content-schemas'
import { dedupeNewsletterLinks, newsletterLinks } from './lib/newsletter-links'
import { pageText } from './lib/page-text'

const [raw, mode, ...rest] = process.argv.slice(2)
if (!raw || !mode) {
  throw new Error(
    'Usage: extract-content.ts <raw dir> --pending | --prompt <unit> | --record <unit> <answer.json>',
  )
}

type Doc = { id: string; file: string; pages: number; method: 'text' | 'vision' }
type Unit = { id: string; schema: z.ZodType; prompt: () => string }

const here = import.meta.dirname
const rawAbs = path.resolve(raw)
const outDir = path.join(here, 'extracted', 'content')
const docDir = (id: string) => path.join(rawAbs, 'docs', id)
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T

const docs = readJson<Doc[]>(path.join(here, 'docs.json'))
const manifest = readJson<{ pages: Array<{ file: string; source: 'zip' | 'mirror' }> }>(
  path.join(here, 'manifest.json'),
)

const docNamed = (id: string): Doc => {
  const doc = docs.find((d) => d.id === id)
  if (!doc) throw new Error(`${id} is not a prepared document (run prepare-docs.ts)`)
  return doc
}

const nameOf = (unit: string): string => unit.replaceAll(':', '__')

/** The text of these pages, marked by page; a vision document is read from OCR. */
const textOf = (doc: Doc, pages: number[]): string =>
  pages
    .map((n) => {
      const file = path.join(
        docDir(doc.id),
        doc.method === 'vision' ? `page-${n}.ocr.txt` : `page-${n}.txt`,
      )
      return `--- page ${n} ---\n${readFileSync(file, 'utf8')}`
    })
    .join('\n')

const imagesOf = (doc: Doc, pages: number[]): string[] =>
  doc.method === 'vision' ? pages.map((n) => path.join(docDir(doc.id), `page-${n}.png`)) : []

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

const htmlOf = (file: string): string => {
  const page = manifest.pages.find((p) => p.file === file)
  if (!page) throw new Error(`${file} is not in the manifest`)
  const dir =
    page.source === 'zip'
      ? path.join(rawAbs, 'weebly-zip-2025-04-23')
      : path.join(rawAbs, 'mirror', 'pages')
  return readFileSync(path.join(dir, file), 'utf8')
}

const TOC_DOCS = [
  'on_the_emergence_of_pigeon_towers_-_english',
  'on_the_emergence_of_pigeon_towers_-_arabic',
  'translation_lab_works',
]
const NEWSLETTER_DOC = 'cilas_newsletter_issue_no._1'

const PAGES: Array<{
  file: string
  schema: z.ZodType
  prompt: (id: string, text: string) => string
}> = [
  { file: 'press.html', schema: PressPage, prompt: (id, text) => pressPrompt({ id, text }) },
  {
    file: 'news-and-events.html',
    schema: NewsPage,
    prompt: (id, text) => newsPrompt({ id, text }),
  },
  { file: '-latest.html', schema: BlogPage, prompt: (id, text) => blogPrompt({ id, text }) },
  {
    file: 'on-pigeon-towers.html',
    schema: PublicationPage,
    prompt: (id, text) => publicationPrompt({ id, text }),
  },
  {
    file: 'translation-as-education.html',
    schema: PublicationPage,
    prompt: (id, text) => publicationPrompt({ id, text }),
  },
  {
    file: 'events-documents.html',
    schema: NewsletterSources,
    prompt: (id, text) => {
      // every newsletter-issue link on every archived page, once per campaign
      const links = dedupeNewsletterLinks(
        manifest.pages.flatMap((p) => newsletterLinks(htmlOf(p.file))),
      )
      return newsletterPrompt({ id, text, mailchimp: links })
    },
  },
]

const tocUnit = (docId: string): Unit => ({
  id: `toc:${docId}`,
  schema: Toc,
  prompt: () => {
    const doc = docNamed(docId)
    const pages = [
      ...new Set([
        ...range(1, Math.min(6, doc.pages)),
        ...range(Math.max(1, doc.pages - 1), doc.pages),
      ]),
    ]
    return tocPrompt({
      id: docId,
      pageCount: doc.pages,
      pages,
      text: textOf(doc, pages),
      images: imagesOf(doc, pages),
    })
  },
})

/** Essays become units once their document's Toc is recorded. */
const essayUnits = (): Unit[] =>
  TOC_DOCS.flatMap((docId) => {
    const file = path.join(outDir, `${nameOf(`toc:${docId}`)}.json`)
    if (!existsSync(file)) return []
    const doc = docNamed(docId)
    return readJson<{ data: Toc }>(file).data.essays.map((e) => ({
      id: `essay:${docId}:${e.order}`,
      schema: Essay,
      prompt: () => {
        if (e.first_page > e.last_page || e.last_page > doc.pages) {
          throw new Error(
            `essay ${e.order} of ${docId}: pages ${e.first_page}-${e.last_page} outside 1-${doc.pages}`,
          )
        }
        const pages = range(e.first_page, e.last_page)
        return essayPrompt({
          id: `essay:${docId}:${e.order}`,
          doc: docId,
          title: e.title,
          authors: e.authors,
          firstPage: e.first_page,
          lastPage: e.last_page,
          text: textOf(doc, pages),
          images: imagesOf(doc, pages),
        })
      },
    }))
  })

const units = (): Unit[] => [
  ...TOC_DOCS.map(tocUnit),
  ...essayUnits(),
  ...PAGES.map((p): Unit => ({
    id: `page:${p.file}`,
    schema: p.schema,
    prompt: () => p.prompt(`page:${p.file}`, pageText(htmlOf(p.file))),
  })),
  {
    id: 'doc:newsletter-1',
    schema: NewsletterSources,
    prompt: () => {
      const doc = docNamed(NEWSLETTER_DOC)
      const pages = range(1, doc.pages)
      return newsletterPrompt({
        id: 'doc:newsletter-1',
        text: textOf(doc, pages),
        images: imagesOf(doc, pages),
      })
    },
  },
]

const unitNamed = (id: string): Unit => {
  const unit = units().find((u) => u.id === id)
  if (!unit)
    throw new Error(
      `${id} is not an extraction unit (an essay unit needs its document's toc recorded first)`,
    )
  return unit
}

if (mode === '--pending') {
  const all = units()
  const pending = all.filter(
    (u) =>
      !isCurrent({
        outDir,
        name: nameOf(u.id),
        prompt: u.prompt(),
        version: CONTENT_PROMPT_VERSION,
      }),
  )
  for (const u of pending) console.log(u.id)
  console.error(`${pending.length} of ${all.length} unit(s) pending`)
} else if (mode === '--prompt') {
  const unit = unitNamed(rest[0])
  console.log(agentPrompt(unit.prompt(), unit.schema))
} else if (mode === '--record') {
  const unit = unitNamed(rest[0])
  recordAnswer({
    outDir,
    name: nameOf(unit.id),
    prompt: unit.prompt(),
    version: CONTENT_PROMPT_VERSION,
    schema: unit.schema, // throws with the exact field on a bad answer
    answerFile: rest[1],
  })
  console.log(`${unit.id}: recorded`)
} else {
  throw new Error(`Unknown mode ${mode}`)
}
