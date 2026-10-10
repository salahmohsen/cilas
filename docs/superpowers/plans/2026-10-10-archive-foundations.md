# Archive Import Foundations Implementation Plan (6.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the ground for importing the old site:
- every imported document records where it came from (`legacy_url`) and whether a person has checked it (`import_status`);
- the dev reset can never wipe checked content;
- the few pages missing from the ZIP are fetched from Wayback;
- a committed `migration/manifest.json` catalogues every page and upload, with its kind and what it links to.

**Architecture:**
- **Pure helpers in `migration/lib/`:** page classification and upload-path resolution. Both are unit-tested.
- **Two scripts in `migration/`:**
  - `fetch-wayback.ts`: idempotent downloads into the gitignored `migration/raw/wayback/`.
  - `ingest.ts`: parses every page with `jsdom` and writes the manifest.
- **Later plans:** the next sub-plans (6.2 cycles and courses, 6.3 people, 6.4 course flows, 6.5 publishing and redirects) read the manifest instead of re-scanning the raw files.

**Tech Stack:** TypeScript run with `tsx`, `jsdom` (already a dev dependency), Payload 3.90.2, vitest.

**Spec:** `docs/schema.md` (Archive import), ADR 0004.

**Branch:** work directly on `main`, one commit per task. Don't push.

---

## Roadmap (plan 6 is split into five)

- **6.1 Foundations** (this plan)
- 6.2 Cycles and courses from cycle and course pages
- 6.3 People, cohorts (memberships), advisors and trustees
- 6.4 Course flows: PDFs read by a vision model into sessions (ADR 0004)
- 6.5 Articles, publications, press, events, newsletters; one redirect per legacy URL

Each later sub-plan is written just before it starts, using this manifest.

## Decisions made in this plan

**Import fields**
- **`legacy_url` and `import_status` go on every collection the import writes to:** spaces, people, memberships, governance, partners, cycles, programmes, courses, articles, publications, press, events and newsletters.
- **`legacy_url`:**
  - It is unique per collection, and it is the upsert key.
  - A page that yields several documents gives each one a fragment: a cycle page's courses become `/fall-cycle-2024.html#melancholia-in-the-city`.
  - It is hidden in the admin, as the spec says.
- **`import_status`:**
  - Values: `needs_review` or `reviewed`.
  - It sits in the sidebar, and only admins may set it.
  - Documents created by hand leave it empty.

**Reset guard**
- `resetContent()` refuses to run when any content collection holds a `reviewed` document. It throws an error naming the counts, before deleting anything.

**Manifest**
- **Legacy URLs:** every page's legacy URL is `/<file name>`, e.g. `/fall-cycle-2024.html`. The Weebly home page `index.html` becomes `/`.
- **Page kinds:** `cycle`, `course`, `lab`, `people`, `space`, `programme`, `publication`, `press`, `blog`, `info`.
  - Rules on the file name set the kind.
  - `migration/page-kinds.json` holds hand overrides for pages the rules get wrong.
  - Anything the rules don't place is `course`, because 2013–2018 course pages have free-form names.
- **Upload links:**
  - These forms resolve to a file under `uploads/`: relative `uploads/…`, root `/uploads/…`, absolute `ci-las.org/uploads/…`, Wayback-wrapped, and Weebly's `published/X.ext` (the ZIP stores that as `X_orig.ext`).
  - Unresolvable links are kept, marked `missing`.
- **Committed vs. generated:** `migration/manifest.json` and `migration/page-kinds.json` are committed. Raw files never are.

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/fields/import.ts` | create | `importFields()` |
| `src/collections/*.ts` (13) | modify | add `...importFields()` |
| `seed/seed.utils.ts` | modify | the reset guard |
| `migration/lib/classify.ts` | create | `legacyUrlOf()`, `classifyPage()` |
| `migration/lib/uploads.ts` | create | `resolveUpload()` |
| `migration/page-kinds.json` | create | hand overrides |
| `migration/fetch-wayback.ts` | create | download Wayback-only pages and assets |
| `migration/ingest.ts` | create | write `migration/manifest.json` |
| `migration/manifest.json` | generate | the catalogue |
| `migration/README.md` | create | how to run the pipeline |
| `tests/unit/import-*.unit.spec.ts` | create | |
| `tests/int/import.int.spec.ts` | create | |

**Commands**
- One spec: `pnpm vitest run --config ./vitest.config.mts <path>`.
- **Scripts:** run as `npx tsx migration/<script>.ts`. They read the raw archive, so pass the paths as arguments. Never run an interpreter from inside `migration/raw`.
- **Database:** Task 2 adds columns. Until Task 8 resets the database, don't run the dev server or the int tests.
- **Baseline:** tsc clean, lint 0 errors, 193 tests pass.

---

### Task 1: Import fields

**Files:**
- Create: `src/fields/import.ts`
- Test: `tests/unit/shape-fields.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

Add `import { importFields } from '@/fields/import'` to `tests/unit/shape-fields.unit.spec.ts`, which already has `names()`:

```ts
describe('importFields', () => {
  it('adds a hidden, unique legacy URL and an import status', () => {
    const [legacy, status] = importFields()
    expect(names([legacy, status])).toEqual(['legacy_url', 'import_status'])
    expect(legacy).toMatchObject({ type: 'text', unique: true, index: true, admin: { hidden: true } })
    expect(status).toMatchObject({ type: 'select', admin: { position: 'sidebar' } })
    expect(
      (status as { options: Array<{ value: string }> }).options.map((o) => o.value),
    ).toEqual(['needs_review', 'reviewed'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/fields/import"`.

- [ ] **Step 3: Write the implementation**

```ts
import type { Field } from 'payload'

import { canSetTier } from '@/access'

/**
 * Provenance for archive imports (docs/schema.md, Archive import). The
 * importer upserts by `legacy_url`; a page that yields several documents
 * gives each a fragment, e.g. `/fall-cycle-2024.html#melancholia-in-the-city`.
 */
export const importFields = (): Field[] => [
  {
    name: 'legacy_url',
    type: 'text',
    unique: true,
    index: true,
    admin: { hidden: true },
  },
  {
    name: 'import_status',
    type: 'select',
    options: [
      { label: 'Needs review', value: 'needs_review' },
      { label: 'Reviewed', value: 'reviewed' },
    ],
    access: { create: canSetTier, update: canSetTier },
    admin: {
      position: 'sidebar',
      description: 'Imported from the old site. Mark it reviewed once checked.',
      condition: (data) => Boolean(data?.import_status),
    },
  },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts && npx tsc --noEmit`
Expected: PASS; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/fields/import.ts tests/unit/shape-fields.unit.spec.ts
git commit -m "feat(fields): legacy URL and import status for archive imports

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Add the import fields to imported collections

**Files:**
- Modify: `src/collections/{Spaces,People,Memberships,Governance,Partners,Cycles,Programmes,Courses,Articles,Publications,Press,Events,Newsletters}.ts`

- [ ] **Step 1: Spread the fields in**

In each of the 13 collections:
- import `importFields` from `@/fields/import`;
- append `...importFields()` as the last entries of `fields`.

In `Articles.ts` the field list ends inside a collapsible. Append at the top level of `fields`, not inside a group or collapsible, so the column stays `legacy_url`.

- [ ] **Step 2: Regenerate types and type-check**

Run: `pnpm generate:types && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/collections src/payload-types.ts
git commit -m "feat(collections): imported documents record their legacy URL and review status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Never wipe reviewed content

**Files:**
- Modify: `seed/seed.utils.ts`

- [ ] **Step 1: Add the guard**

In `seed/seed.utils.ts`, add above `resetContent`:

```ts
/**
 * The reset is a development convenience. Once a person has reviewed imported
 * content it must survive, so refuse to wipe anything while reviewed
 * documents exist (docs/schema.md, Archive import).
 */
export const assertNoReviewedContent = async (payload: Payload): Promise<void> => {
  const reviewed: string[] = []
  for (const collection of CONTENT_COLLECTIONS) {
    const fields = payload.collections[collection]?.config.flattenedFields ?? []
    if (!fields.some((f) => f.name === 'import_status')) continue
    const { totalDocs } = await payload.count({
      collection,
      where: { import_status: { equals: 'reviewed' } },
      overrideAccess: true,
    })
    if (totalDocs) reviewed.push(`${collection}: ${totalDocs}`)
  }
  if (reviewed.length) {
    throw new Error(
      `Refusing to reset: reviewed content would be lost (${reviewed.join(', ')}).`,
    )
  }
}
```

Make the first line of `resetContent` `await assertNoReviewedContent(payload)`.

If `flattenedFields` isn't on the collection config in this Payload version, use `payload.collections[collection].config.fields` with a recursive name search. Check `node_modules/payload/dist`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output. The int test in Task 8 covers the behaviour.

- [ ] **Step 3: Commit**

```bash
git add seed/seed.utils.ts
git commit -m "fix(seed): the reset refuses to wipe reviewed content

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Page classification and upload resolution

**Files:**
- Create: `migration/lib/classify.ts`, `migration/lib/uploads.ts`, `migration/page-kinds.json`
- Test: `tests/unit/import-classify.unit.spec.ts`, `tests/unit/import-uploads.unit.spec.ts`

- [ ] **Step 1: Write the failing tests**

`tests/unit/import-classify.unit.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { classifyPage, legacyUrlOf } from '../../migration/lib/classify'

describe('legacyUrlOf', () => {
  it('maps a file to its old path, and index to the root', () => {
    expect(legacyUrlOf('fall-cycle-2024.html')).toBe('/fall-cycle-2024.html')
    expect(legacyUrlOf('index.html')).toBe('/')
  })
})

describe('classifyPage', () => {
  it.each([
    ['fall-cycle-2024.html', 'cycle'],
    ['spring-labs-2023.html', 'cycle'],
    ['2014-2015-second-trimester.html', 'cycle'],
    ['2018-2019-cilas-alex-core-courses-2018---2019.html', 'cycle'],
    ['cilas-in-alex-2019-2020.html', 'cycle'],
    ['winter-2023-2024.html', 'cycle'],
    ['translation-lab.html', 'lab'],
    ['research-lab-post-captialism.html', 'lab'],
    ['cilasians-2015-2016.html', 'people'],
    ['advisors.html', 'people'],
    ['darb-el-labbana-current-space-in-cairo.html', 'space'],
    ['al-manshiya-cilas-in-alex.html', 'space'],
    ['bridge-programme.html', 'programme'],
    ['on-pigeon-towers.html', 'publication'],
    ['press.html', 'press'],
    ['-latest.html', 'blog'],
    ['faqs.html', 'info'],
    ['anarchist-recipes.html', 'course'],
    ['power-and-space-critical-approaches-to-the-built-environment.html', 'course'],
  ])('%s is a %s page', (file, kind) => {
    expect(classifyPage(file, {})).toBe(kind)
  })

  it('lets a hand override win', () => {
    expect(classifyPage('anarchist-recipes.html', { 'anarchist-recipes.html': 'info' })).toBe('info')
  })
})
```

`tests/unit/import-uploads.unit.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { resolveUpload } from '../../migration/lib/uploads'

const files = new Set([
  'uploads/1/9/1/0/19102967/syllabus.pdf',
  'uploads/1/9/1/0/19102967/1022666471_orig.jpg',
])

describe('resolveUpload', () => {
  it('accepts relative, rooted, absolute and Wayback-wrapped links', () => {
    for (const href of [
      'uploads/1/9/1/0/19102967/syllabus.pdf',
      '/uploads/1/9/1/0/19102967/syllabus.pdf',
      'https://www.ci-las.org/uploads/1/9/1/0/19102967/syllabus.pdf',
      'https://web.archive.org/web/2025id_/https://www.ci-las.org/uploads/1/9/1/0/19102967/syllabus.pdf',
    ]) {
      expect(resolveUpload(href, files)).toEqual({
        path: 'uploads/1/9/1/0/19102967/syllabus.pdf',
        missing: false,
      })
    }
  })

  it('maps a published image to its _orig file', () => {
    expect(resolveUpload('uploads/1/9/1/0/19102967/published/1022666471.jpg?1510668144', files)).toEqual({
      path: 'uploads/1/9/1/0/19102967/1022666471_orig.jpg',
      missing: false,
    })
  })

  it('keeps an unknown upload, marked missing', () => {
    expect(resolveUpload('/uploads/1/9/1/0/19102967/gone.pdf', files)).toEqual({
      path: 'uploads/1/9/1/0/19102967/gone.pdf',
      missing: true,
    })
  })

  it('ignores links that are not uploads', () => {
    expect(resolveUpload('https://example.org/x.pdf', files)).toBeNull()
    expect(resolveUpload('fall-cycle-2024.html', files)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/import-classify.unit.spec.ts tests/unit/import-uploads.unit.spec.ts`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Write the implementation**

`migration/lib/classify.ts`:

```ts
export const PAGE_KINDS = [
  'cycle',
  'course',
  'lab',
  'people',
  'space',
  'programme',
  'publication',
  'press',
  'blog',
  'info',
] as const
export type PageKind = (typeof PAGE_KINDS)[number]

/** A page's path on the old site. Weebly served the home page at `/`. */
export const legacyUrlOf = (file: string): string => (file === 'index.html' ? '/' : `/${file}`)

// First match wins. Cycle pages come before labs, because a cycle's labs
// page ("spring-labs-2023") is still a cycle.
const RULES: Array<[RegExp, PageKind]> = [
  [/^-latest/, 'blog'],
  [/^(cilasians-|people\.|advisors\.|trustees\.)/, 'people'],
  [/(-space-in-|^al-manshiya|^space\.)/, 'space'],
  [/^(on-pigeon-towers|translation-as-education)\./, 'publication'],
  [/^press\./, 'press'],
  [
    /(cycle|semester|trimester|^(fall|spring|summer|winter)(-labs)?-\d{4}|^\d{4}-\d{4}|^cilas-in-alex-\d{4}|^82032024|^winter-cycle)/,
    'cycle',
  ],
  [/(^|-)labs?(-|\.)/, 'lab'],
  [
    /^(bridge-programme|programme|core-curriculum|curriculum|thematic-course|non-degree|offlineonline-course-cycles)/,
    'programme',
  ],
  [
    /^(index|about1|admissions|faqs|tuition|mission|core-values|support-us|scholarship|welcome-note|at-a-glance|learning-method|method|fellowship|becoming-a-fellow|open-call|collaboration|an-invitation|files|apps|pictures|cilas-channel|media\.|news-and-events|events-documents|projects|uwc-letter|community-service)/,
    'info',
  ],
]

/**
 * What a page holds. A hand override wins; then the first matching rule;
 * free-form names left over are 2013–2018 course pages.
 */
export const classifyPage = (file: string, overrides: Record<string, PageKind>): PageKind =>
  overrides[file] ?? RULES.find(([pattern]) => pattern.test(file))?.[1] ?? 'course'
```

`migration/lib/uploads.ts`:

```ts
const UPLOADS = /(?:^|\/)(uploads\/\d+\/\d+\/\d+\/\d+\/\d+\/.+)$/

/**
 * The archive file an upload link points to. Weebly served resized images
 * from `published/X.ext`; the ZIP keeps the original as `X_orig.ext`.
 */
export const resolveUpload = (
  href: string,
  files: Set<string>,
): { path: string; missing: boolean } | null => {
  const clean = href.split(/[?#]/)[0].replace(/^https?:\/\/web\.archive\.org\/web\/[^/]+\//, '')
  const match = UPLOADS.exec(clean.replace(/^https?:\/\/(www\.)?ci-las\.org\//, ''))
  if (!match) return null

  let path = decodeURIComponent(match[1])
  const published = /^(.*)\/published\/([^/]+)\.(\w+)$/.exec(path)
  if (published) path = `${published[1]}/${published[2]}_orig.${published[3]}`

  return { path, missing: !files.has(path) }
}
```

`migration/page-kinds.json`:

```json
{}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/import-classify.unit.spec.ts tests/unit/import-uploads.unit.spec.ts && npx tsc --noEmit`
Expected: PASS (21 + 4 tests); tsc prints nothing. If `tsconfig.json` excludes `migration/`, add `"migration/**/*.ts"` to `include`, leaving out `migration/raw`.

- [ ] **Step 5: Commit**

```bash
git add migration/lib migration/page-kinds.json tests/unit/import-classify.unit.spec.ts tests/unit/import-uploads.unit.spec.ts tsconfig.json
git commit -m "feat(import): classify archive pages and resolve upload links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fetch what the ZIP lacks from Wayback

**Files:**
- Create: `migration/fetch-wayback.ts`

- [ ] **Step 1: Write the script**

```ts
/**
 * Downloads the pages the April 2025 ZIP lacks (the 2025–26 cycles), and the
 * uploads those pages link to, into migration/raw/wayback/. Already-present
 * files are skipped, so it is safe to re-run.
 *
 *   npx tsx migration/fetch-wayback.ts migration/raw
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { resolveUpload } from './lib/uploads'

const raw = process.argv[2]
if (!raw) throw new Error('Usage: npx tsx migration/fetch-wayback.ts <raw dir>')

const zip = path.join(raw, 'weebly-zip-2025-04-23')
const wayback = path.join(raw, 'wayback')

// Pages captured on Wayback but missing from the ZIP (CDX listing, Oct 2026).
const PAGES = [
  'fall-cycle-2025.html',
  'winter-cycle-2026.html',
  'spring-cycle-2026.html',
  'spring-semester-2026.html',
  'spring-semester-labs-2026.html',
  'workshopslabs.html',
  'writing-the-self.html',
]

const snapshot = (url: string) => `https://web.archive.org/web/2026id_/${url}`

const download = async (url: string, to: string): Promise<boolean> => {
  if (existsSync(to)) return false
  const res = await fetch(snapshot(url), { redirect: 'follow' })
  if (!res.ok) {
    console.warn(`skip ${url}: HTTP ${res.status}`)
    return false
  }
  mkdirSync(path.dirname(to), { recursive: true })
  writeFileSync(to, Buffer.from(await res.arrayBuffer()))
  return true
}

const zipFiles = new Set<string>()
const walk = (dir: string, rel = ''): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) walk(path.join(dir, entry.name), relPath)
    else zipFiles.add(relPath)
  }
}
walk(path.join(zip, 'uploads'), 'uploads')

const main = async () => {
  let fetched = 0
  for (const page of PAGES) {
    if (await download(`https://www.ci-las.org/${page}`, path.join(wayback, 'pages', page))) fetched++
  }

  // Uploads the Wayback pages link to that the ZIP doesn't have.
  for (const page of PAGES) {
    const file = path.join(wayback, 'pages', page)
    if (!existsSync(file)) continue
    const html = readFileSync(file, 'utf8')
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const upload = resolveUpload(href, zipFiles)
      if (!upload?.missing) continue
      const to = path.join(wayback, upload.path)
      if (await download(`https://www.ci-las.org/${upload.path}`, to)) fetched++
    }
  }
  console.log(`fetched ${fetched} file(s)`)
}

main()
```

- [ ] **Step 2: Run it**

Run: `npx tsx migration/fetch-wayback.ts migration/raw`
Expected:
- all 7 pages exist under `migration/raw/wayback/pages/`;
- uploads the ZIP lacked land under `migration/raw/wayback/uploads/…`;
- a re-run prints `fetched 0 file(s)`.

- [ ] **Step 3: Type-check, then commit**

Run: `npx tsc --noEmit`, and expect no output. Then:

```bash
git add migration/fetch-wayback.ts
git commit -m "feat(import): fetch pages and uploads the ZIP lacks from Wayback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ingest into the manifest

**Files:**
- Create: `migration/ingest.ts`
- Generate: `migration/manifest.json`

- [ ] **Step 1: Write the script**

```ts
/**
 * Stage 1 of the import (docs/schema.md, Archive import): catalogue every
 * page and upload. Later stages read migration/manifest.json, not raw files.
 *
 *   npx tsx migration/ingest.ts migration/raw
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'

import { classifyPage, legacyUrlOf, type PageKind } from './lib/classify'
import { resolveUpload } from './lib/uploads'

const raw = process.argv[2]
if (!raw) throw new Error('Usage: npx tsx migration/ingest.ts <raw dir>')

const zip = path.join(raw, 'weebly-zip-2025-04-23')
const wayback = path.join(raw, 'wayback')
const overrides = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'page-kinds.json'), 'utf8'),
) as Record<string, PageKind>

const listFiles = (dir: string, rel = ''): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const relPath = rel ? `${rel}/${e.name}` : e.name
    return e.isDirectory() ? listFiles(path.join(dir, e.name), relPath) : [relPath]
  })

const zipUploads = listFiles(path.join(zip, 'uploads'), 'uploads')
const waybackUploads = (() => {
  try {
    return listFiles(path.join(wayback, 'uploads'), 'uploads')
  } catch {
    return []
  }
})()
const allUploads = new Set([...zipUploads, ...waybackUploads])

type Page = {
  legacy_url: string
  file: string
  source: 'zip' | 'wayback'
  kind: PageKind
  title: string
  links: string[]
  uploads: Array<{ path: string; missing: boolean }>
}

const read = (source: Page['source'], dir: string): Page[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .map((file) => {
      const { document } = new JSDOM(readFileSync(path.join(dir, file), 'utf8')).window
      const hrefs = [...document.querySelectorAll('a[href], img[src]')].map(
        (el) => el.getAttribute('href') ?? el.getAttribute('src') ?? '',
      )
      const uploads = new Map<string, { path: string; missing: boolean }>()
      const links = new Set<string>()
      for (const href of hrefs) {
        const upload = resolveUpload(href, allUploads)
        if (upload) uploads.set(upload.path, upload)
        else if (/^\/?[^/:?#]+\.html/.test(href)) links.add(legacyUrlOf(href.replace(/^\//, '').split(/[?#]/)[0]))
      }
      return {
        legacy_url: legacyUrlOf(file),
        file,
        source,
        kind: classifyPage(file, overrides),
        title: document.title.replace(/\s*-\s*CILAS.*$/i, '').trim(),
        links: [...links].sort(),
        uploads: [...uploads.values()].sort((a, b) => a.path.localeCompare(b.path)),
      }
    })

const zipPages = read('zip', zip)
const known = new Set(zipPages.map((p) => p.file))
const pages = [...zipPages, ...read('wayback', path.join(wayback, 'pages')).filter((p) => !known.has(p.file))]
  .sort((a, b) => a.legacy_url.localeCompare(b.legacy_url))

const referencedBy = new Map<string, string[]>()
for (const page of pages) {
  for (const u of page.uploads) referencedBy.set(u.path, [...(referencedBy.get(u.path) ?? []), page.legacy_url])
}
const uploads = [...allUploads]
  .sort()
  .map((p) => ({
    path: p,
    source: zipUploads.includes(p) ? 'zip' : 'wayback',
    referenced_by: referencedBy.get(p) ?? [],
  }))

const manifest = { generated_from: 'weebly-zip-2025-04-23 + wayback', pages, uploads }
writeFileSync(path.join(import.meta.dirname, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

const byKind = pages.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] ?? 0) + 1 }), {})
console.log(`${pages.length} pages`, byKind)
console.log(`${uploads.length} uploads, ${uploads.filter((u) => u.referenced_by.length).length} referenced`)
console.log(`${pages.flatMap((p) => p.uploads).filter((u) => u.missing).length} upload link(s) missing`)
```

If `import.meta.dirname` isn't available under `tsx` here, use `path.dirname(fileURLToPath(import.meta.url))`.

- [ ] **Step 2: Run it and check the kinds**

Run: `npx tsx migration/ingest.ts migration/raw`
Expected: about 209 pages (202 from the ZIP plus 7 from Wayback), and every kind except `publication` and `press` has several pages.

Then review each page classified as `course`. Print legacy URL, title and the first 200 characters of body text:

```bash
node -e "const m=require('./migration/manifest.json');for(const p of m.pages.filter(p=>p.kind==='course'))console.log(p.legacy_url,'|',p.title)"
```

Every page that isn't one course's own page gets an entry in `migration/page-kinds.json`. Typical cases are overview pages, a lab's landing page, and an essay. Use the kind that fits, open the raw page if unsure, and then re-run the ingest. List every override you add in your report.

- [ ] **Step 3: Commit**

```bash
git add migration/ingest.ts migration/manifest.json migration/page-kinds.json
git commit -m "feat(import): manifest of every archived page and upload

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Pipeline README

**Files:**
- Create: `migration/README.md`

- [ ] **Step 1: Write it**

```markdown
# Archive import

Turns the old Weebly site into CILAS content (docs/schema.md, Archive import; ADR 0004).

Raw files live in `raw/`, which git and Docker ignore:
- `raw/weebly-zip-2025-04-23/`: the site export, the primary source.
- `raw/wayback/`: pages and uploads the ZIP lacks, fetched by `fetch-wayback.ts`.

## Stages

1. `npx tsx migration/fetch-wayback.ts migration/raw`: download the missing pages and uploads.
2. `npx tsx migration/ingest.ts migration/raw`: write `manifest.json`, which lists every page with its kind, links and uploads.
3. Extract and normalise per page kind: plans 6.2–6.5 add these stages.
4. Seed: upsert by `legacy_url` as drafts marked "needs review", with one redirect per legacy URL.

`page-kinds.json` corrects the kind for pages the file-name rules misjudge. Edit it, then re-run the ingest.

Reviewed content is protected: `pnpm db:seed` refuses to reset while any document is marked reviewed.
```

- [ ] **Step 2: Commit**

```bash
git add migration/README.md
git commit -m "docs(import): how to run the archive pipeline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Migrate, reset and test against the database

**Files:**
- Regenerate: `src/migrations/*`
- Create: `tests/int/import.int.spec.ts`

- [ ] **Step 1: Rebuild the baseline migration**

```bash
find src/migrations -maxdepth 1 -type f \( -name '*.json' -o -name '*.ts' \) ! -name 'index.ts' -delete
pnpm db:migrate:create
```

Check that exactly one migration pair exists and that `index.ts` lists only it.

- [ ] **Step 2: The user resets the database**

Ask the user to run `! pnpm db:reset`, then wait for `SEED COMPLETE`.

- [ ] **Step 3: Write the int test**

`tests/int/import.int.spec.ts`:

```ts
// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { assertNoReviewedContent } from '../../seed/seed.utils'

let payload: Payload
const created: number[] = []

describe('archive import foundations', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const id of created) {
      await payload.delete({ collection: 'partners', id, overrideAccess: true }).catch(() => undefined)
    }
    await payload.destroy()
  })

  it('refuses a second document with the same legacy URL', async () => {
    const first = await payload.create({
      collection: 'partners',
      data: { name: 'Legacy Probe', slug: 'legacy-probe', kind: ['other'], legacy_url: '/probe.html#a' },
      overrideAccess: true,
    })
    created.push(first.id)
    await expect(
      payload.create({
        collection: 'partners',
        data: { name: 'Legacy Probe 2', slug: 'legacy-probe-2', kind: ['other'], legacy_url: '/probe.html#a' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('lets the reset run with no reviewed content, and refuses once there is some', async () => {
    await expect(assertNoReviewedContent(payload)).resolves.toBeUndefined()

    const reviewed = await payload.create({
      collection: 'partners',
      data: { name: 'Reviewed Probe', slug: 'reviewed-probe', kind: ['other'], import_status: 'reviewed' },
      overrideAccess: true,
    })
    created.push(reviewed.id)
    await expect(assertNoReviewedContent(payload)).rejects.toThrow(/partners: 1/)
  })
})
```

- [ ] **Step 4: Run every test**

Run: `pnpm test:int`
Expected: `import.int.spec.ts` passes 2 tests; everything else still passes, 193 or more.

- [ ] **Step 5: Commit**

```bash
git add src/migrations tests/int/import.int.spec.ts
git commit -m "test(import): legacy URLs are unique and reviewed content survives resets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Update the spec

**Files:**
- Modify: `docs/schema.md`

- [ ] **Step 1: Mark what exists**

At the top of `## Archive import (seed)`, add:

```markdown
**Built (plan 6.1):**
- `legacy_url` and `import_status` on every imported collection.
- The reset guard.
- `migration/fetch-wayback.ts`, and the stage-1 `migration/ingest.ts` → `migration/manifest.json` (see `migration/README.md`).

Stages 2–4 come per content type in plans 6.2–6.5.
```

Also correct the Wayback count in "Sources". The CDX listing shows 7 pages missing from the ZIP, not 86.

- [ ] **Step 2: Commit**

```bash
git add docs/schema.md
git commit -m "docs(schema): archive import foundations are built

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
