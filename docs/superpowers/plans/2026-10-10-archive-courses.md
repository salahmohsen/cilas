# Archive Import: Cycles and Courses Implementation Plan (6.2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import every archived cycle and course as drafts marked "needs review". The pipeline has three stages:

- **Extract:** turn each cycle, course and lab page into structured JSON with a cheap model, fed clean text only.
- **Normalise:** merge and convert that JSON into seed data.
- **Seed:** upsert it into Payload by `legacy_url`.

**Architecture:**

- **Stage 2, extract:**
  - `migration/lib/page-text.ts` strips a Weebly page to its body text and keeps links, headings and emphasis as plain markers. It is free and deterministic.
  - `migration/extract-courses.ts` sends that text to Claude Haiku 5.5 with a forced tool call whose schema is a zod schema. It validates the result and writes one committed JSON file per page to `migration/extracted/`.
  - A content hash in each file skips unchanged pages, so a re-run costs nothing.
- **Stage 3, normalise:** pure functions in `migration/lib/normalise-courses.ts` (season and year, legacy URLs, schedules, merging) feed `migration/normalise-courses.ts`. That script writes `seed/data/archive/{cycles,courses}.json` and `migration/review/courses.md`, a list of guesses for a person to check.
- **Stage 4, seed:** `migration/lib/import-courses.ts` upserts spaces, cycles, fellows (as people) and courses. The script `migration/seed-courses.ts` runs it against the database.
- **No schema change:** this plan changes no collections, so it needs no migration and no database reset.

**Tech Stack:** TypeScript (`tsx`), `jsdom`, `@anthropic-ai/sdk`, `zod` 4, Payload 3.90.2 local API, vitest.

**Spec:** `docs/schema.md` (Archive import), `migration/README.md`, ADR 0002 (schedule), ADR 0003 (cycles).

**Branch:** work directly on `main`, one commit per task. Don't push.

---

## Roadmap

6.1 Foundations (done) → **6.2 Cycles and courses** (this plan) → 6.3 People, cohorts, programmes → 6.4 Course flows (PDF to sessions) → 6.5 Articles, publications, press, events, newsletters, media, redirects.

## Decisions made in this plan

**Extraction**

- **Model:** text extraction uses `claude-haiku-5-5`, a cheap model, as the user chose: pages go in as text, never as images.
- **Committed output:** each page's extraction is committed under `migration/extracted/<file>.json`. It carries `sha256` of (prompt version + page text) and `model`, and the extract step skips a page whose hash still matches.
- **API key:** the API key is read from `ANTHROPIC_API_KEY`, and Tasks 1–3 and 5–7 need no key.
- **Pages with several cycles:** one page can hold several cycles, e.g. `2013-2014.html` or `cilas-in-alex-2018-2019.html`. So the schema returns `cycles[]`, each with its own `courses[]`. A course page returns one course with `cycles: []`.

**Cycles and spaces**

- **Season and start year:** the extracted `start_date` decides them when present. Otherwise they come from the file name:
  - trimesters map first → fall, second → winter, third → spring;
  - for an academic-year pair `A-B`, fall starts in `A`, and winter, spring and summer start in `B`.
- **Space:** from the page's own venue mention (`space_hint`: `darb el-labbana`, `al-ghuria`, `al-manshiya`, `online`). Failing that, a file name or title with `alex` means al-Manshiya. Anything left defaults to Darb el-Labbana, flagged in the review file. Online-only cycles also go to Darb el-Labbana: a cycle needs a space, and the courses' `location` says they were online.

**Courses**

- **Legacy URL:** a course with its own page (the 2013–2018 "continue reading" pages, or a single-course page) uses that page's path. Inline courses use `<cycle page>#<slugified title>`.
- **Merging:** the cycle-page summary and the course page merge into one course. The course page wins on every field it fills.
- **Course type:** the model chooses from the page's own wording:
  - CORE for the core curriculum;
  - LAB for labs;
  - WORKSHOP for workshops;
  - THEMATIC for thematic or semester courses;
  - SHORT for stand-alone short courses in offline/online cycles.
- **Fellows:**
  - They are matched to people by normalised name: accents dropped, lower case, and `migration/aliases.json` mapping variants to one canonical name.
  - A fellow with no person is created as a person with `import_status: needs_review`.
  - Plan 6.3 adds bios and cohorts. If the course page gave a bio or email, it is stored on the person; emails are never turned into accounts.
- **Schedule:**
  - Weekday, start time, end time, weeks and start date come from the extraction. A start date without its day becomes `start_precision: 'week'`.
  - Unparseable schedule text goes into `schedule.note` verbatim.
  - The importer does not invent sessions. Plan 6.4 builds sessions from the course flows.
- **Description:** the extracted text, one paragraph per blank-line block, goes through the existing `lexical()` helper, with `rtl` when the text is mostly Arabic. HTML formatting isn't kept; reviewers fix emphasis by hand where it matters.
- **Flow PDFs and register links:** the uploads a course links as its flow go into `seed/data/archive/courses.json` as `flow_uploads` for plan 6.4. They are not stored on the course (ADR 0004). Register links go into `registration.archived_registration_url`.

**Import status and access**

- **Drafts:** imported courses are Payload drafts (`_status: 'draft'`), `tier: 'public'`, `import_status: 'needs_review'`. A reviewer publishes. Cycles have no drafts and get `import_status: 'needs_review'`.
- **Never overwrite reviewed content:** the importer is idempotent, and on a re-run it never overwrites a document whose `import_status` is `reviewed`.

## File map

| File                                                                       | Change   | Responsibility                         |
| -------------------------------------------------------------------------- | -------- | -------------------------------------- |
| `migration/lib/page-text.ts`                                               | create   | `pageText(html)`                       |
| `migration/lib/extraction-schema.ts`                                       | create   | zod schema, prompt, version            |
| `migration/lib/llm.ts`                                                     | create   | cached, validated tool-call extraction |
| `migration/extract-courses.ts`                                             | create   | stage 2 runner                         |
| `migration/extracted/*.json`                                               | generate | per-page extraction, committed         |
| `migration/lib/normalise-courses.ts`                                       | create   | pure stage-3 rules                     |
| `migration/aliases.json`                                                   | create   | name variants → canonical name         |
| `migration/normalise-courses.ts`                                           | create   | stage 3 runner                         |
| `seed/data/archive/cycles.json`, `courses.json`                            | generate | normalised seed data                   |
| `migration/review/courses.md`                                              | generate | guesses for a person to check          |
| `migration/lib/import-courses.ts`                                          | create   | stage 4 upserts                        |
| `migration/seed-courses.ts`                                                | create   | stage 4 runner                         |
| `tests/unit/import-*.unit.spec.ts`, `tests/int/import-courses.int.spec.ts` | create   |                                        |

**Commands**

- One spec: `pnpm vitest run --config ./vitest.config.mts <path>`.
- **pnpm:** installs use the repo's pnpm, `npx -y pnpm@11.8.0 add …`.
- **Raw files:** the raw archive is untrusted input, so scripts take its path as an argument. Never run anything from inside `migration/raw`.
- **Baseline:** tsc clean, lint 0 errors, 222 tests pass.

---

### Task 1: Page text

**Files:**

- Create: `migration/lib/page-text.ts`
- Test: `tests/unit/import-page-text.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { pageText } from '../../migration/lib/page-text'

const page = `<html><head><title>x</title><style>.a{}</style></head><body>
<div id="nav"><a href="about1.html">About</a></div>
<div id="wsite-content">
  <h2>Fall cycle 2024</h2>
  <div class="paragraph"><strong>Date: Sundays, 5:30-8 pm</strong><br/>Why does story exist?</div>
  <p>For the flow see <a href="uploads/1/9/1/0/19102967/flow.pdf">here</a>.</p>
  <img src="uploads/1/9/1/0/19102967/cover_orig.png"/>
  <script>track()</script>
</div></body></html>`

describe('pageText', () => {
  it('keeps the body with headings, emphasis, links and images as markers', () => {
    expect(pageText(page)).toBe(
      [
        '## Fall cycle 2024',
        '**Date: Sundays, 5:30-8 pm**',
        'Why does story exist?',
        'For the flow see [here](uploads/1/9/1/0/19102967/flow.pdf).',
        '![image](uploads/1/9/1/0/19102967/cover_orig.png)',
      ].join('\n'),
    )
  })

  it('drops the site navigation outside the content area', () => {
    expect(pageText(page)).not.toContain('About')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/import-page-text.unit.spec.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Write the implementation**

```ts
import { JSDOM } from 'jsdom'

const BLOCK = new Set([
  'P',
  'DIV',
  'LI',
  'UL',
  'OL',
  'H1',
  'H2',
  'H3',
  'H4',
  'TABLE',
  'TR',
  'BLOCKQUOTE',
])

/**
 * A Weebly page's content as plain text the extractor can read: headings as
 * `##`, bold as `**`, links as `[text](href)`, images as `![image](src)`, one
 * block per line. Navigation, scripts and styles are dropped.
 */
export const pageText = (html: string): string => {
  const { document, Node } = new JSDOM(html).window
  const root = document.querySelector('#wsite-content') ?? document.body
  root.querySelectorAll('script, style, noscript').forEach((el) => el.remove())

  const out: string[] = []
  let line = ''
  const flush = () => {
    const text = line.replace(/[ \t ​]+/g, ' ').trim()
    if (text) out.push(text)
    line = ''
  }

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      line += node.textContent ?? ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const tag = el.tagName
    if (tag === 'BR') return flush()
    if (tag === 'IMG') {
      flush()
      out.push(`![image](${el.getAttribute('src') ?? ''})`)
      return
    }
    const block = BLOCK.has(tag)
    if (block) flush()
    if (/^H[1-4]$/.test(tag)) line += '## '
    const strong = tag === 'STRONG' || tag === 'B'
    const href = tag === 'A' ? el.getAttribute('href') : null
    if (strong) line += '**'
    if (href) line += '['
    el.childNodes.forEach(walk)
    if (href) line += `](${href})`
    if (strong) line += '**'
    if (block) flush()
  }

  walk(root)
  flush()
  return out.join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/import-page-text.unit.spec.ts`
Expected: PASS, 2 tests. If the exact output differs only in whitespace placement (for example a space before `**`), fix the implementation rather than the expectation. The text is fed to a model, so stable and tidy matters.

- [ ] **Step 5: Commit**

```bash
git add migration/lib/page-text.ts tests/unit/import-page-text.unit.spec.ts
git commit -m "feat(import): reduce archived pages to marked-up text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Extraction schema and prompt

**Files:**

- Create: `migration/lib/extraction-schema.ts`
- Test: `tests/unit/import-extraction-schema.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { CoursePage, PROMPT_VERSION, coursePrompt } from '../../migration/lib/extraction-schema'

const sample = {
  cycles: [
    {
      label: 'Fall cycle 2024',
      season: 'fall',
      start_year: 2024,
      start_date: '2024-09-21',
      deadline: '2024-09-06',
      space_hint: 'darb el-labbana',
      courses: [
        {
          title: 'Story as participative enquiry',
          title_ar: null,
          subtitle: null,
          course_type: 'SHORT',
          fellows: [{ name: 'Leon Conrad', email: 'leon@leonconrad.com', bio: 'Founder of…' }],
          schedule_text: 'Sundays, 5:30-8 pm, start date is September the 21st.',
          weekdays: ['sun'],
          start_time: '17:30',
          end_time: '20:00',
          weeks: 8,
          start_date: '2024-09-21',
          location: ['HYBRID'],
          description: 'Why does story as a phenomenon exist?',
          flow_links: ['uploads/1/9/1/0/19102967/story.pdf'],
          register_url: 'https://forms.gle/AV541BDfrrTwxxJBA',
          own_page: null,
        },
      ],
    },
  ],
  course: null,
}

describe('CoursePage', () => {
  it('accepts a cycle page extraction', () => {
    expect(CoursePage.parse(sample).cycles[0].courses[0].title).toBe(
      'Story as participative enquiry',
    )
  })

  it('rejects times that are not 24-hour HH:MM', () => {
    const bad = structuredClone(sample)
    bad.cycles[0].courses[0].start_time = '5:30pm'
    expect(() => CoursePage.parse(bad)).toThrow()
  })
})

describe('coursePrompt', () => {
  it('names the page and carries its text', () => {
    const prompt = coursePrompt({
      file: 'fall-cycle-2024.html',
      kind: 'cycle',
      title: 'Fall cycle 2024',
      text: 'BODY',
    })
    expect(prompt).toContain('fall-cycle-2024.html')
    expect(prompt).toContain('BODY')
    expect(PROMPT_VERSION).toMatch(/^\d+$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/import-extraction-schema.unit.spec.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Write the implementation**

```ts
import * as z from 'zod'

/** Bump when the prompt or schema changes, so cached extractions re-run. */
export const PROMPT_VERSION = '1'

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()

export const ExtractedCourse = z.object({
  title: z.string().min(1),
  title_ar: z.string().nullable(),
  subtitle: z.string().nullable(),
  course_type: z.enum(['CORE', 'THEMATIC', 'LAB', 'WORKSHOP', 'SHORT']),
  fellows: z.array(
    z.object({ name: z.string().min(1), email: z.string().nullable(), bio: z.string().nullable() }),
  ),
  schedule_text: z.string().nullable(),
  weekdays: z.array(z.enum(['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'])),
  start_time: time,
  end_time: time,
  weeks: z.number().int().positive().nullable(),
  start_date: day,
  location: z.array(z.enum(['OFFLINE', 'ONLINE', 'HYBRID'])),
  description: z.string(),
  flow_links: z.array(z.string()),
  register_url: z.string().nullable(),
  /** The course's own page, e.g. a "continue reading" link, as given in the text. */
  own_page: z.string().nullable(),
})
export type ExtractedCourse = z.infer<typeof ExtractedCourse>

export const ExtractedCycle = z.object({
  label: z.string(),
  season: z.enum(['fall', 'winter', 'spring', 'summer']).nullable(),
  start_year: z.number().int().min(2012).max(2100).nullable(),
  start_date: day,
  deadline: day,
  space_hint: z.enum(['darb el-labbana', 'al-ghuria', 'al-manshiya', 'online']).nullable(),
  courses: z.array(ExtractedCourse),
})
export type ExtractedCycle = z.infer<typeof ExtractedCycle>

/** A cycle page yields cycles; a course page yields one course. */
export const CoursePage = z.object({
  cycles: z.array(ExtractedCycle),
  course: ExtractedCourse.nullable(),
})
export type CoursePage = z.infer<typeof CoursePage>

/** Instructions for the extractor. Facts only from the page; null when absent. */
export const coursePrompt = ({
  file,
  kind,
  title,
  text,
}: {
  file: string
  kind: string
  title: string
  text: string
}): string => `You are extracting structured data from one archived page of CILAS, the Cairo Institute for Liberal Arts and Sciences (2013–2026). Pages are in English, Arabic or both.

Page file: ${file}
Page kind: ${kind} (cycle = an intake listing several courses; course or lab = one course's own page)
Page title: ${title}

Rules:
- Use only facts stated on the page. Use null or [] when something is not stated. Never guess emails, dates or times.
- A "cycle" is one intake: a season (fall, winter, spring, summer) and start year. Trimesters map: first → fall, second → winter, third → spring. A page may describe several cycles (e.g. a whole academic year); return each separately with its own courses.
- For a course or lab page, return its one course in "course" and leave "cycles" empty.
- course_type: CORE for core-curriculum courses; LAB for labs; WORKSHOP for workshops; THEMATIC for thematic or semester courses; SHORT for stand-alone short courses in offline/online cycles.
- Times are 24-hour "HH:MM" in Cairo time ("5:30-8 pm" → 17:30 and 20:00). Weekdays as sat, sun, mon, tue, wed, thu, fri. Dates as YYYY-MM-DD.
- location: OFFLINE (in person), ONLINE, HYBRID; several if the course mixes them.
- description: the course's own description, copied verbatim (keep the original language), paragraphs separated by a blank line. Exclude fellow bios, schedules and registration text.
- fellows: who teaches or coordinates the course, with their bio text and email if the page gives them.
- flow_links: links to the course's flow, syllabus or outline document (uploads/… paths), as written.
- own_page: the link to the course's own page (often "continue reading"), as written; null if none.
- space_hint: the venue if named: "darb el-labbana", "al-ghuria", "al-manshiya" (Alexandria), or "online" if the whole cycle is online.

Page text (links as [text](href), images as ![image](src), headings as ##):
"""
${text}
"""

Call the record_page tool with the result.`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/import-extraction-schema.unit.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add migration/lib/extraction-schema.ts tests/unit/import-extraction-schema.unit.spec.ts
git commit -m "feat(import): extraction schema and prompt for cycle and course pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cached, validated extraction

**Files:**

- Create: `migration/lib/llm.ts`
- Modify: `package.json`, `pnpm-lock.yaml`
- Test: `tests/unit/import-llm.unit.spec.ts`

- [ ] **Step 1: Install the SDK**

Run: `npx -y pnpm@11.8.0 add -D @anthropic-ai/sdk`

- [ ] **Step 2: Write the failing test**

```ts
// @vitest-environment node
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as z from 'zod'
import { describe, expect, it, vi } from 'vitest'

import { extractCached } from '../../migration/lib/llm'

const Schema = z.object({ answer: z.number() })

describe('extractCached', () => {
  it('calls the model once, then reads the cache while the input is unchanged', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'extract-'))
    const call = vi.fn().mockResolvedValue({ answer: 42 })
    const args = {
      dir,
      name: 'page.html',
      prompt: 'P',
      version: '1',
      model: 'm',
      schema: Schema,
      call,
    }

    expect(await extractCached(args)).toEqual({ answer: 42 })
    expect(await extractCached(args)).toEqual({ answer: 42 })
    expect(call).toHaveBeenCalledTimes(1)
    expect(JSON.parse(readFileSync(path.join(dir, 'page.html.json'), 'utf8'))).toMatchObject({
      model: 'm',
      data: { answer: 42 },
    })
  })

  it('re-runs when the prompt changes', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'extract-'))
    const call = vi.fn().mockResolvedValue({ answer: 1 })
    await extractCached({
      dir,
      name: 'p',
      prompt: 'A',
      version: '1',
      model: 'm',
      schema: Schema,
      call,
    })
    await extractCached({
      dir,
      name: 'p',
      prompt: 'B',
      version: '1',
      model: 'm',
      schema: Schema,
      call,
    })
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('rejects output that does not match the schema, and caches nothing', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'extract-'))
    const call = vi.fn().mockResolvedValue({ answer: 'no' })
    await expect(
      extractCached({
        dir,
        name: 'p',
        prompt: 'A',
        version: '1',
        model: 'm',
        schema: Schema,
        call,
      }),
    ).rejects.toThrow()
    await expect(
      extractCached({
        dir,
        name: 'p',
        prompt: 'A',
        version: '1',
        model: 'm',
        schema: Schema,
        call,
      }),
    ).rejects.toThrow()
    expect(call).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/import-llm.unit.spec.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 4: Write the implementation**

```ts
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import * as z from 'zod'

export const EXTRACT_MODEL = 'claude-haiku-5-5'

type Cached = { sha256: string; model: string; version: string; data: unknown }

/**
 * Runs `call` only when this page's prompt (or the version or model) changed
 * since the committed result in `dir/<name>.json`; validates every result.
 */
export const extractCached = async <T>({
  dir,
  name,
  prompt,
  version,
  model,
  schema,
  call,
}: {
  dir: string
  name: string
  prompt: string
  version: string
  model: string
  schema: z.ZodType<T>
  call: (prompt: string) => Promise<unknown>
}): Promise<T> => {
  const sha256 = createHash('sha256').update(`${version}\n${model}\n${prompt}`).digest('hex')
  const file = path.join(dir, `${name}.json`)
  if (existsSync(file)) {
    const cached = JSON.parse(readFileSync(file, 'utf8')) as Cached
    if (cached.sha256 === sha256) return schema.parse(cached.data)
  }
  const data = schema.parse(await call(prompt))
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    file,
    `${JSON.stringify({ sha256, model, version, data } satisfies Cached, null, 2)}\n`,
  )
  return data
}

/**
 * One forced tool call whose input schema is the zod schema, so the model
 * must answer in that shape. Reads ANTHROPIC_API_KEY.
 */
export const anthropicCall =
  (schema: z.ZodType, model = EXTRACT_MODEL) =>
  async (prompt: string): Promise<unknown> => {
    const client = new Anthropic()
    const res = await client.messages.create({
      model,
      max_tokens: 16000,
      tools: [
        {
          name: 'record_page',
          description: 'Record the structured data extracted from the page.',
          input_schema: z.toJSONSchema(schema) as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'record_page' },
      messages: [{ role: 'user', content: prompt }],
    })
    const tool = res.content.find((b) => b.type === 'tool_use')
    if (!tool || tool.type !== 'tool_use')
      throw new Error(`No tool call (stop: ${res.stop_reason})`)
    return tool.input
  }
```

Check `z.toJSONSchema` in the installed zod 4. If its output includes keys the Anthropic API rejects (for example `$schema`), strip them in `anthropicCall`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/import-llm.unit.spec.ts && npx tsc --noEmit`
Expected: PASS, 3 tests; tsc prints nothing.

- [ ] **Step 6: Commit**

```bash
git add migration/lib/llm.ts tests/unit/import-llm.unit.spec.ts package.json pnpm-lock.yaml
git commit -m "feat(import): cached, schema-checked model extraction

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Extract every cycle, course and lab page

**Files:**

- Create: `migration/extract-courses.ts`
- Generate: `migration/extracted/*.json`

**Prerequisite:** `ANTHROPIC_API_KEY` must be set in `.env`. If it isn't, stop here and ask the user to add it. Do Tasks 5–7 first if they are waiting.

- [ ] **Step 1: Write the runner**

```ts
/**
 * Stage 2: each cycle, course and lab page → migration/extracted/<file>.json.
 * Unchanged pages are skipped, so re-runs only pay for what changed.
 *
 *   npx tsx --env-file=.env migration/extract-courses.ts migration/raw [--only a.html,b.html]
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { CoursePage, PROMPT_VERSION, coursePrompt } from './lib/extraction-schema'
import { EXTRACT_MODEL, anthropicCall, extractCached } from './lib/llm'
import { pageText } from './lib/page-text'

const raw = process.argv[2]
if (!raw) throw new Error('Usage: extract-courses.ts <raw dir> [--only a.html,b.html]')
const only = process.argv.includes('--only')
  ? new Set(process.argv[process.argv.indexOf('--only') + 1].split(','))
  : null

type ManifestPage = { file: string; source: 'zip' | 'mirror'; kind: string; title: string }
const here = import.meta.dirname
const { pages } = JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf8')) as {
  pages: ManifestPage[]
}

const todo = pages.filter(
  (p) => ['cycle', 'course', 'lab'].includes(p.kind) && (!only || only.has(p.file)),
)
const dirOf = (source: ManifestPage['source']) =>
  source === 'zip' ? path.join(raw, 'weebly-zip-2025-04-23') : path.join(raw, 'mirror', 'pages')

const call = anthropicCall(CoursePage)

const main = async () => {
  let failed = 0
  // Three at a time keeps well under rate limits.
  for (let i = 0; i < todo.length; i += 3) {
    await Promise.all(
      todo.slice(i, i + 3).map(async (page) => {
        const text = pageText(readFileSync(path.join(dirOf(page.source), page.file), 'utf8'))
        try {
          const data = await extractCached({
            dir: path.join(here, 'extracted'),
            name: page.file,
            prompt: coursePrompt({ file: page.file, kind: page.kind, title: page.title, text }),
            version: PROMPT_VERSION,
            model: EXTRACT_MODEL,
            schema: CoursePage,
            call,
          })
          const n = data.course ? 1 : data.cycles.reduce((s, c) => s + c.courses.length, 0)
          console.log(`${page.file}: ${n} course(s)`)
        } catch (error) {
          failed++
          console.error(`${page.file}: FAILED ${(error as Error).message}`)
        }
      }),
    )
  }
  console.log(`${todo.length} page(s), ${failed} failed`)
  if (failed) process.exitCode = 1
}

main()
```

- [ ] **Step 2: Trial on three pages, one from each era, and check by hand**

Run: `npx tsx --env-file=.env migration/extract-courses.ts migration/raw --only 2014-2015-second-trimester.html,spring-cycle-2023.html,fall-cycle-2024.html`

Open the three JSON files and compare them with the page text, from `pageText` or the raw HTML read as text. Check:

- every course on the page is present, and none is invented;
- times, weekdays and dates match the page;
- descriptions are verbatim and exclude bios;
- `own_page` is set for the 2014 continue-reading courses.

If the prompt needs fixing:

- change it;
- bump `PROMPT_VERSION`;
- re-run the trial;
- report what you changed and why.

- [ ] **Step 3: Run all pages**

Run: `npx tsx --env-file=.env migration/extract-courses.ts migration/raw`
Expected: about 157 pages and 0 failures. Re-run once for any transient failures; cached pages are skipped. Report the total course count and any page that still fails.

- [ ] **Step 4: Commit**

```bash
git add migration/extract-courses.ts migration/extracted migration/lib/extraction-schema.ts
git commit -m "feat(import): extract cycles and courses from every archived page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Normalisation rules

**Files:**

- Create: `migration/lib/normalise-courses.ts`, `migration/aliases.json`
- Test: `tests/unit/import-normalise.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import {
  canonicalName,
  courseLegacyUrl,
  cycleFromFile,
  isMostlyArabic,
  scheduleOf,
  spaceOf,
} from '../../migration/lib/normalise-courses'
import type { ExtractedCourse } from '../../migration/lib/extraction-schema'

const course = (over: Partial<ExtractedCourse> = {}): ExtractedCourse => ({
  title: 'Story as participative enquiry',
  title_ar: null,
  subtitle: null,
  course_type: 'SHORT',
  fellows: [],
  schedule_text: 'Sundays, 5:30-8 pm',
  weekdays: ['sun'],
  start_time: '17:30',
  end_time: '20:00',
  weeks: 8,
  start_date: '2024-09-21',
  location: ['HYBRID'],
  description: '',
  flow_links: [],
  register_url: null,
  own_page: null,
  ...over,
})

describe('cycleFromFile', () => {
  it.each([
    ['fall-cycle-2024.html', { season: 'fall', start_year: 2024 }],
    ['spring-2021.html', { season: 'spring', start_year: 2021 }],
    ['spring-cycle-20221.html', { season: 'spring', start_year: 2022 }],
    ['2014-2015-second-trimester.html', { season: 'winter', start_year: 2015 }],
    ['2015-2016-third-trimester.html', { season: 'spring', start_year: 2016 }],
    ['winter-cycle-2024-2025.html', { season: 'winter', start_year: 2025 }],
    ['spring-cycle-2024-2025.html', { season: 'spring', start_year: 2025 }],
    ['fall-labs-2022.html', { season: 'fall', start_year: 2022 }],
  ])('%s', (file, expected) => {
    expect(cycleFromFile(file)).toEqual(expected)
  })

  it('is null when the name says nothing usable', () => {
    expect(cycleFromFile('cilas-in-alex-2018-2019.html')).toBeNull()
  })
})

describe('spaceOf', () => {
  it('trusts the page, then Alexandria in the name, then defaults with a flag', () => {
    expect(spaceOf('al-ghuria', 'x.html', '')).toEqual({ space: 'al-Ghuria', guessed: false })
    expect(spaceOf(null, 'cilas-in-alex-2019-2020.html', '')).toEqual({
      space: 'al-Manshiya',
      guessed: false,
    })
    expect(spaceOf(null, 'spring-2021.html', '')).toEqual({
      space: 'Darb el-Labbana',
      guessed: true,
    })
    expect(spaceOf('online', 'summer-2021.html', '')).toEqual({
      space: 'Darb el-Labbana',
      guessed: true,
    })
  })
})

describe('courseLegacyUrl', () => {
  it("uses the course's own page when it has one, else a fragment of the cycle page", () => {
    expect(
      courseLegacyUrl(
        '/2014-2015-second-trimester.html',
        course({ own_page: 'art-and-the-city.html' }),
      ),
    ).toBe('/art-and-the-city.html')
    expect(courseLegacyUrl('/fall-cycle-2024.html', course())).toBe(
      '/fall-cycle-2024.html#story-as-participative-enquiry',
    )
  })

  it('ignores own_page links that are not pages on the site', () => {
    expect(
      courseLegacyUrl('/fall-cycle-2024.html', course({ own_page: 'https://forms.gle/x' })),
    ).toBe('/fall-cycle-2024.html#story-as-participative-enquiry')
  })
})

describe('scheduleOf', () => {
  it('builds the schedule pattern from the extraction', () => {
    expect(scheduleOf(course())).toEqual({
      start_date: '2024-09-21',
      start_precision: 'day',
      weeks: 8,
      slots: [{ weekday: 'sun', start_time: '17:30', end_time: '20:00' }],
      note: 'Sundays, 5:30-8 pm',
    })
  })

  it('keeps only the note when times are unknown', () => {
    expect(
      scheduleOf(
        course({ weekdays: [], start_time: null, end_time: null, weeks: null, start_date: null }),
      ),
    ).toEqual({
      start_precision: 'day',
      slots: [],
      note: 'Sundays, 5:30-8 pm',
    })
  })
})

describe('names and script', () => {
  it('matches names regardless of accents, case and aliases', () => {
    const aliases = { 'Karim-Yassin Goessinger': ['Karim-Yassin', 'Karim Yassin Goessinger'] }
    expect(canonicalName('karim yassin goessinger', aliases)).toBe('Karim-Yassin Goessinger')
    expect(canonicalName('Hussein  El-Hajj', {})).toBe('Hussein El-Hajj')
  })

  it('detects mostly-Arabic text', () => {
    expect(isMostlyArabic('تفكك أوديب: تجوالات الأسطورة')).toBe(true)
    expect(isMostlyArabic('Unravelling Oedipus')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/import-normalise.unit.spec.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Write the implementation**

```ts
import { slugify } from '../../src/lib/slugify'
import type { ExtractedCourse } from './extraction-schema'

type Season = 'fall' | 'winter' | 'spring' | 'summer'
const TRIMESTER: Record<string, Season> = { first: 'fall', second: 'winter', third: 'spring' }

/** Season and start year from an old file name, or null if it says nothing usable. */
export const cycleFromFile = (file: string): { season: Season; start_year: number } | null => {
  const name = file.replace(/\.html$/, '').replace(/(\d{4})1$/, '$1') // "20221" duplicates
  const trimester = /^(\d{4})-(\d{4})-(first|second|third)-trimester/.exec(name)
  if (trimester) {
    const season = TRIMESTER[trimester[3]]
    return { season, start_year: Number(season === 'fall' ? trimester[1] : trimester[2]) }
  }
  const named = /(fall|winter|spring|summer)\D*?(\d{4})(?:-(\d{4}))?$/.exec(name)
  if (!named) return null
  const season = named[1] as Season
  const year = Number(named[3] && season !== 'fall' ? named[3] : named[2])
  return { season, start_year: year }
}

const SPACES = {
  'darb el-labbana': 'Darb el-Labbana',
  'al-ghuria': 'al-Ghuria',
  'al-manshiya': 'al-Manshiya',
} as const

/** The space a cycle met in: as the page says, else Alexandria by name, else a flagged default. */
export const spaceOf = (
  hint: string | null,
  file: string,
  title: string,
): { space: string; guessed: boolean } => {
  if (hint && hint in SPACES) return { space: SPACES[hint as keyof typeof SPACES], guessed: false }
  if (/alex/i.test(file) || /alex/i.test(title)) return { space: 'al-Manshiya', guessed: false }
  return { space: 'Darb el-Labbana', guessed: true }
}

/** The course's own old page if it had one, else a fragment of the page that listed it. */
export const courseLegacyUrl = (pageUrl: string, course: ExtractedCourse): string => {
  const own = course.own_page?.replace(/^https?:\/\/(www\.)?ci-las\.org\//, '').replace(/^\//, '')
  if (own && /^[^/:?#]+\.html$/.test(own)) return `/${own}`
  return `${pageUrl.split('#')[0]}#${slugify(course.title)}`
}

/** The schedule pattern (ADR 0002) from an extraction; unknowns stay out. */
export const scheduleOf = (course: ExtractedCourse) => {
  const timed = course.start_time && course.end_time
  return {
    ...(course.start_date ? { start_date: course.start_date } : {}),
    start_precision: 'day' as const,
    ...(course.weeks ? { weeks: course.weeks } : {}),
    slots: timed
      ? course.weekdays.map((weekday) => ({
          weekday,
          start_time: course.start_time as string,
          end_time: course.end_time as string,
        }))
      : [],
    ...(course.schedule_text ? { note: course.schedule_text } : {}),
  }
}

const fold = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** One spelling per person: aliases first, then a tidy form of the name as written. */
export const canonicalName = (name: string, aliases: Record<string, string[]>): string => {
  const key = fold(name)
  for (const [canonical, variants] of Object.entries(aliases)) {
    if ([canonical, ...variants].some((v) => fold(v) === key)) return canonical
  }
  return name.replace(/\s+/g, ' ').trim()
}

/** True when more than half the letters are Arabic. */
export const isMostlyArabic = (text: string): boolean => {
  const letters = text.match(/\p{L}/gu) ?? []
  const arabic = letters.filter((c) => /\p{Script=Arabic}/u.test(c)).length
  return letters.length > 0 && arabic / letters.length > 0.5
}
```

`migration/aliases.json`:

```json
{}
```

The `scheduleOf` test for "times unknown" expects `start_precision: 'day'` even without a date. That keeps the shape uniform; `isOnCalendar` already ignores schedules with no meetings.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/import-normalise.unit.spec.ts && npx tsc --noEmit`
Expected: PASS. If `src/lib/slugify` can't be imported from `migration/`, use the `@/lib/slugify` alias instead.

- [ ] **Step 5: Commit**

```bash
git add migration/lib/normalise-courses.ts migration/aliases.json tests/unit/import-normalise.unit.spec.ts
git commit -m "feat(import): rules for seasons, spaces, legacy URLs, schedules and names

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Normalise into seed data

**Files:**

- Create: `migration/normalise-courses.ts`
- Generate: `seed/data/archive/cycles.json`, `seed/data/archive/courses.json`, `migration/review/courses.md`

- [ ] **Step 1: Write the runner**

```ts
/**
 * Stage 3: migration/extracted/*.json → seed/data/archive/{cycles,courses}.json
 * and migration/review/courses.md (every guess, for a person to check).
 *
 *   npx tsx migration/normalise-courses.ts
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { CoursePage, type ExtractedCourse } from './lib/extraction-schema'
import {
  canonicalName,
  courseLegacyUrl,
  cycleFromFile,
  scheduleOf,
  spaceOf,
} from './lib/normalise-courses'

const here = import.meta.dirname
const root = path.join(here, '..')
const aliases = JSON.parse(readFileSync(path.join(here, 'aliases.json'), 'utf8')) as Record<
  string,
  string[]
>
const { pages } = JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf8')) as {
  pages: Array<{ file: string; legacy_url: string; title: string }>
}
const pageOf = new Map(pages.map((p) => [p.file, p]))

type Cycle = {
  key: string
  season: string
  start_year: number
  start_date?: string
  deadline?: string
  space: string
  legacy_url: string
}
type Course = {
  legacy_url: string
  cycle: string | null
  title: string
  title_ar: string | null
  subtitle: string | null
  course_type: ExtractedCourse['course_type']
  fellows: Array<{ name: string; email: string | null; bio: string | null }>
  location: ExtractedCourse['location']
  schedule: ReturnType<typeof scheduleOf>
  description: string
  flow_uploads: string[]
  register_url: string | null
}

const cycles = new Map<string, Cycle>()
const courses = new Map<string, Course>()
const review: string[] = []

const toCourse = (pageUrl: string, c: ExtractedCourse, cycle: string | null): Course => ({
  legacy_url: courseLegacyUrl(pageUrl, c),
  cycle,
  title: c.title.trim(),
  title_ar: c.title_ar,
  subtitle: c.subtitle,
  course_type: c.course_type,
  fellows: c.fellows.map((f) => ({ ...f, name: canonicalName(f.name, aliases) })),
  location: c.location,
  schedule: scheduleOf(c),
  description: c.description.trim(),
  flow_uploads: c.flow_links.filter((l) => /uploads\//.test(l)),
  register_url: c.register_url,
})

// Fill gaps in `base` from `extra` without overwriting what base has.
const merge = (base: Course, extra: Course): Course => {
  const out = { ...base }
  for (const [k, v] of Object.entries(extra) as Array<[keyof Course, Course[keyof Course]]>) {
    const empty =
      out[k] == null ||
      out[k] === '' ||
      (Array.isArray(out[k]) && (out[k] as unknown[]).length === 0)
    if (empty) (out as Record<string, unknown>)[k] = v
  }
  return out
}

const files = readdirSync(path.join(here, 'extracted')).filter((f) => f.endsWith('.json'))

// Cycle pages first, so course pages merge into the cycle they were listed under.
const parsed = files
  .map((f) => {
    const file = f.replace(/\.json$/, '')
    const data = CoursePage.parse(
      JSON.parse(readFileSync(path.join(here, 'extracted', f), 'utf8')).data,
    )
    return { file, page: pageOf.get(file), data }
  })
  .sort((a, b) => Number(Boolean(a.data.course)) - Number(Boolean(b.data.course)))

for (const { file, page, data } of parsed) {
  const pageUrl = page?.legacy_url ?? `/${file}`
  for (const c of data.cycles) {
    const fromName = cycleFromFile(file)
    const season = c.season ?? fromName?.season
    const start_year = c.start_date
      ? Number(c.start_date.slice(0, 4))
      : (c.start_year ?? fromName?.start_year)
    if (!season || !start_year) {
      review.push(
        `- ${pageUrl}: cycle "${c.label}" has no season or year; its ${c.courses.length} course(s) were skipped`,
      )
      continue
    }
    const { space, guessed } = spaceOf(c.space_hint, file, page?.title ?? '')
    if (guessed)
      review.push(`- ${pageUrl}: ${season} ${start_year} placed at ${space} (no venue on the page)`)
    const key = `${season}-${start_year}-${space}`
    if (!cycles.has(key)) {
      cycles.set(key, {
        key,
        season,
        start_year,
        ...(c.start_date ? { start_date: c.start_date } : {}),
        ...(c.deadline ? { deadline: c.deadline } : {}),
        space,
        legacy_url: data.cycles.length > 1 ? `${pageUrl}#${season}-${start_year}` : pageUrl,
      })
    }
    for (const ec of c.courses) {
      const course = toCourse(pageUrl, ec, key)
      const existing = courses.get(course.legacy_url)
      courses.set(course.legacy_url, existing ? merge(existing, course) : course)
    }
  }
  if (data.course) {
    const course = toCourse(pageUrl, { ...data.course, own_page: page?.file ?? null }, null)
    const listed = courses.get(course.legacy_url)
    if (listed) {
      courses.set(course.legacy_url, merge(course, listed)) // the course page wins
    } else {
      review.push(
        `- ${pageUrl}: course "${course.title}" is not listed on any cycle page; it has no cycle`,
      )
      courses.set(course.legacy_url, course)
    }
  }
}

const orphans = [...courses.values()].filter((c) => !c.cycle)
const outDir = path.join(root, 'seed', 'data', 'archive')
mkdirSync(outDir, { recursive: true })
const sorted = <T extends { legacy_url: string }>(xs: T[]) =>
  xs.sort((a, b) => a.legacy_url.localeCompare(b.legacy_url))
writeFileSync(
  path.join(outDir, 'cycles.json'),
  `${JSON.stringify(sorted([...cycles.values()]), null, 2)}\n`,
)
writeFileSync(
  path.join(outDir, 'courses.json'),
  `${JSON.stringify(sorted([...courses.values()]), null, 2)}\n`,
)
mkdirSync(path.join(here, 'review'), { recursive: true })
writeFileSync(
  path.join(here, 'review', 'courses.md'),
  `# Cycles and courses: to check\n\nGenerated by \`normalise-courses.ts\`. Each line is a guess or a gap.\n\n${review.sort().join('\n')}\n`,
)
console.log(
  `${cycles.size} cycles, ${courses.size} courses (${orphans.length} without a cycle), ${review.length} review note(s)`,
)
```

- [ ] **Step 2: Run it and inspect**

Run: `npx tsx migration/normalise-courses.ts`

Inspect the output:

- Read `migration/review/courses.md`.
- Spot-check five courses in `courses.json`. Include one 2014 course merged from a cycle page and its own page, and one 2025–26 course from the mirror.
- If the same person appears under two spellings, add an entry to `migration/aliases.json` and re-run. Find candidates with `node -e "const c=require('./seed/data/archive/courses.json');const n=new Map();for(const x of c)for(const f of x.fellows)n.set(f.name,(n.get(f.name)||0)+1);console.log([...n].sort())"`.
- Report the counts and the alias entries you added.
- Every course without a cycle can't be seeded, because `cycle` is required. List them all in the report; plan 6.3 or the user will place them.

- [ ] **Step 3: Commit**

```bash
git add migration/normalise-courses.ts migration/aliases.json seed/data/archive migration/review
git commit -m "feat(import): normalise extracted cycles and courses into seed data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Import into Payload

**Files:**

- Create: `migration/lib/import-courses.ts`, `migration/seed-courses.ts`
- Test: `tests/int/import-courses.int.spec.ts`

- [ ] **Step 1: Write the importer**

`migration/lib/import-courses.ts`:

```ts
import type { CollectionSlug, Payload, Where } from 'payload'

import { slugify } from '../../src/lib/slugify'
import { lexical } from '../../seed/seed.utils'
import { isMostlyArabic } from './normalise-courses'

export type ArchiveCycle = {
  key: string
  season: 'fall' | 'winter' | 'spring' | 'summer'
  start_year: number
  start_date?: string
  deadline?: string
  space: string
  legacy_url: string
}

export type ArchiveCourse = {
  legacy_url: string
  cycle: string | null
  title: string
  title_ar: string | null
  subtitle: string | null
  course_type: 'CORE' | 'THEMATIC' | 'LAB' | 'WORKSHOP' | 'SHORT'
  fellows: Array<{ name: string; email: string | null; bio: string | null }>
  location: Array<'OFFLINE' | 'ONLINE' | 'HYBRID'>
  schedule: {
    start_date?: string
    start_precision: 'day' | 'week'
    weeks?: number
    slots: Array<{
      weekday: 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri'
      start_time: string
      end_time: string
    }>
    note?: string
  }
  description: string
  flow_uploads: string[]
  register_url: string | null
}

const paragraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
const rich = (text: string) =>
  text.trim() ? lexical(paragraphs(text), isMostlyArabic(text) ? 'rtl' : 'ltr') : null

/**
 * Creates the document, or updates it when the import made it and nobody has
 * reviewed it since. Reviewed documents are never touched again.
 */
const upsert = async (
  payload: Payload,
  collection: CollectionSlug,
  where: Where,
  data: Record<string, unknown>,
  options: { draft?: boolean } = {},
): Promise<number> => {
  const { docs } = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
    draft: options.draft,
  })
  const existing = docs[0] as { id: number; import_status?: string | null } | undefined
  if (existing?.import_status === 'reviewed') return existing.id
  if (existing) {
    await payload.update({
      collection,
      id: existing.id,
      data,
      overrideAccess: true,
      draft: options.draft,
    })
    return existing.id
  }
  const doc = await payload.create({
    collection,
    data,
    overrideAccess: true,
    draft: options.draft,
  } as Parameters<Payload['create']>[0])
  return doc.id as number
}

/** Imports archived cycles and courses as drafts marked "needs review". */
export const importCourses = async (
  payload: Payload,
  { cycles, courses }: { cycles: ArchiveCycle[]; courses: ArchiveCourse[] },
): Promise<{ cycles: number; courses: number; people: number; skipped: string[] }> => {
  const spaces = new Map<string, number>()
  for (const name of new Set(cycles.map((c) => c.space))) {
    spaces.set(
      name,
      await upsert(payload, 'spaces', { name: { equals: name } }, { name, slug: slugify(name) }),
    )
  }

  const cycleIds = new Map<string, number>()
  for (const c of cycles) {
    cycleIds.set(
      c.key,
      // One cycle per season, year and space (unique index), so match an
      // existing one, e.g. from the dev seed, as well as an earlier import.
      await upsert(
        payload,
        'cycles',
        {
          or: [
            { legacy_url: { equals: c.legacy_url } },
            {
              and: [
                { season: { equals: c.season } },
                { start_year: { equals: c.start_year } },
                { space: { equals: spaces.get(c.space) } },
              ],
            },
          ],
        },
        {
          season: c.season,
          start_year: c.start_year,
          space: spaces.get(c.space),
          ...(c.start_date ? { start_date: c.start_date } : {}),
          ...(c.deadline ? { registration: { deadline: c.deadline } } : {}),
          legacy_url: c.legacy_url,
          import_status: 'needs_review',
        },
      ),
    )
  }

  const people = new Map<string, number>()
  const personFor = async (f: ArchiveCourse['fellows'][number], from: string): Promise<number> => {
    const known = people.get(f.name)
    if (known) return known
    const { docs } = await payload.find({
      collection: 'people',
      where: { name: { equals: f.name } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const id =
      docs[0]?.id ??
      (
        await payload.create({
          collection: 'people',
          data: {
            name: f.name,
            slug: slugify(f.name),
            ...(f.bio ? { bio: rich(f.bio) } : {}),
            legacy_url: `${from}#${slugify(f.name)}`,
            import_status: 'needs_review',
          },
          overrideAccess: true,
        })
      ).id
    people.set(f.name, id)
    return id
  }

  const skipped: string[] = []
  let imported = 0
  for (const c of courses) {
    const cycle = c.cycle ? cycleIds.get(c.cycle) : undefined
    if (!cycle) {
      skipped.push(c.legacy_url)
      continue
    }
    const fellows = []
    for (const f of c.fellows) fellows.push(await personFor(f, c.legacy_url.split('#')[0]))
    await upsert(
      payload,
      'courses',
      { legacy_url: { equals: c.legacy_url } },
      {
        title: c.title,
        slug: slugify(c.title) || slugify(c.legacy_url),
        subtitle: c.subtitle,
        course_type: c.course_type,
        cycle,
        tier: 'public',
        session_unit: 'session',
        location: c.location,
        fellows,
        schedule: c.schedule,
        description: rich(c.description),
        ...(c.register_url ? { registration: { archived_registration_url: c.register_url } } : {}),
        legacy_url: c.legacy_url,
        import_status: 'needs_review',
        _status: 'draft',
      },
      { draft: true },
    )
    imported++
  }

  return { cycles: cycleIds.size, courses: imported, people: people.size, skipped }
}
```

**Slug collisions.** Two archived courses can share a title, e.g. a course repeated across years. When the slug unique index rejects a create, retry once with the slug `<title>-<start_year>`, using the course's cycle year. Add this in `upsert`'s create branch for `courses`, and cover it in the int test.

**Arabic titles.** Write `title_ar` as a follow-up `locale: 'ar'` update after the course create or update, as `seed/collections/courses.seed.ts` does.

`migration/seed-courses.ts`:

```ts
/**
 * Stage 4 for cycles and courses: upsert seed/data/archive into the database.
 *
 *   npx tsx --env-file=.env migration/seed-courses.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import { importCourses } from './lib/import-courses'

const dir = path.join(import.meta.dirname, '..', 'seed', 'data', 'archive')
const read = (f: string) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'))

const main = async () => {
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config: await config })
  const result = await importCourses(payload, {
    cycles: read('cycles.json'),
    courses: read('courses.json'),
  })
  console.log(`cycles ${result.cycles}, courses ${result.courses}, new people ${result.people}`)
  if (result.skipped.length) console.log(`skipped (no cycle): ${result.skipped.join(', ')}`)
  await payload.destroy()
  process.exit(0)
}

main()
```

- [ ] **Step 2: Write the int test**

`tests/int/import-courses.int.spec.ts`:

```ts
// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import {
  importCourses,
  type ArchiveCourse,
  type ArchiveCycle,
} from '../../migration/lib/import-courses'

let payload: Payload

const cycles: ArchiveCycle[] = [
  {
    key: 'fall-2031-Darb el-Labbana',
    season: 'fall',
    start_year: 2031,
    space: 'Darb el-Labbana',
    legacy_url: '/probe-fall-2031.html',
  },
]
const course = (over: Partial<ArchiveCourse> = {}): ArchiveCourse => ({
  legacy_url: '/probe-fall-2031.html#probe-course',
  cycle: 'fall-2031-Darb el-Labbana',
  title: 'Probe Import Course',
  title_ar: null,
  subtitle: null,
  course_type: 'SHORT',
  fellows: [{ name: 'Probe Import Fellow', email: null, bio: 'A fellow.' }],
  location: ['ONLINE'],
  schedule: { start_precision: 'day', slots: [], note: 'Tuesdays' },
  description: 'First paragraph.\n\nSecond paragraph.',
  flow_uploads: [],
  register_url: 'https://forms.gle/probe',
  ...over,
})

const cleanup = async () => {
  for (const [collection, where] of [
    ['courses', { legacy_url: { like: '/probe-' } }],
    ['cycles', { legacy_url: { like: '/probe-' } }],
    ['people', { name: { like: 'Probe Import' } }],
  ] as const) {
    await payload.delete({ collection, where, overrideAccess: true }).catch(() => undefined)
  }
}

describe('archive course import', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
  })
  afterAll(async () => {
    await cleanup()
    await payload.destroy()
  })

  it('imports a course as a draft needing review, with its cycle and fellow', async () => {
    const result = await importCourses(payload, { cycles, courses: [course()] })
    expect(result).toMatchObject({ cycles: 1, courses: 1, people: 1, skipped: [] })

    const { docs } = await payload.find({
      collection: 'courses',
      where: { legacy_url: { equals: '/probe-fall-2031.html#probe-course' } },
      draft: true,
      overrideAccess: true,
      depth: 1,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      _status: 'draft',
      import_status: 'needs_review',
      tier: 'public',
    })
    expect(docs[0].registration?.archived_registration_url).toBe('https://forms.gle/probe')
    expect((docs[0].fellows as Array<{ name: string }>).map((f) => f.name)).toEqual([
      'Probe Import Fellow',
    ])
  })

  it('is idempotent', async () => {
    await importCourses(payload, { cycles, courses: [course()] })
    const { totalDocs } = await payload.count({
      collection: 'courses',
      where: { legacy_url: { like: '/probe-' } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(1)
  })

  it('never overwrites a reviewed course', async () => {
    const { docs } = await payload.find({
      collection: 'courses',
      where: { legacy_url: { equals: '/probe-fall-2031.html#probe-course' } },
      draft: true,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'courses',
      id: docs[0].id,
      data: { title: 'Edited by a reviewer', import_status: 'reviewed' },
      overrideAccess: true,
      draft: true,
    })
    await importCourses(payload, { cycles, courses: [course()] })
    const after = await payload.findByID({
      collection: 'courses',
      id: docs[0].id,
      draft: true,
      overrideAccess: true,
    })
    expect(after.title).toBe('Edited by a reviewer')
  })

  it('skips a course with no cycle, and reports it', async () => {
    const result = await importCourses(payload, {
      cycles,
      courses: [course({ legacy_url: '/probe-orphan.html', cycle: null })],
    })
    expect(result.skipped).toEqual(['/probe-orphan.html'])
  })
})
```

Add one more case for the slug-collision retry: two courses with the same title in one import both land.

- [ ] **Step 3: Run the int test against the dev database**

This plan has no schema change, so the database is already current. Run: `pnpm vitest run --config ./vitest.config.mts tests/int/import-courses.int.spec.ts`
Expected: PASS. If Payload behaves differently from what the plan assumes, report it. Examples: `like` semantics, the draft read after `update` with `draft: true`, or the create overload typing.

- [ ] **Step 4: Import the real data into the dev database**

Run: `npx tsx --env-file=.env migration/seed-courses.ts`
Expected: counts printed that match `courses.json` minus the cycle-less courses. Run it a second time: the counts must stay the same, and no duplicates may appear. Report the counts.

- [ ] **Step 5: Commit**

```bash
git add migration/lib/import-courses.ts migration/seed-courses.ts tests/int/import-courses.int.spec.ts
git commit -m "feat(import): upsert archived cycles and courses as drafts for review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Documentation

**Files:**

- Modify: `migration/README.md`, `docs/schema.md`

- [ ] **Step 1: Document the stages**

In `migration/README.md`, replace stage 3's placeholder line with the cycles-and-courses commands:

```markdown
3. Cycles and courses (needs `ANTHROPIC_API_KEY`):
   - `npx tsx --env-file=.env migration/extract-courses.ts migration/raw`: page text → `extracted/*.json` with Claude Haiku. It is cached by content hash, so re-runs are free.
   - `npx tsx migration/normalise-courses.ts`: writes `../seed/data/archive/{cycles,courses}.json`, plus `review/courses.md` for a person to check.
   - `npx tsx --env-file=.env migration/seed-courses.ts`: upserts them as drafts marked "needs review". Reviewed documents are never overwritten.

   Name variants of one person go in `aliases.json`.
```

In `docs/schema.md`, under "Built", add: `Cycles and courses (plan 6.2): extract → normalise → seed, with flows kept as \`flow_uploads\` for plan 6.4.`

- [ ] **Step 2: Commit**

```bash
git add migration/README.md docs/schema.md
git commit -m "docs(import): running the cycles and courses import

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
