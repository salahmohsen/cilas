# Archive Import: People, Cohorts, Programmes and the Board (6.3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the archive's people. That covers:

- yearly cohorts: students and fellows, as memberships of each Bridge year;
- the Bridge programmes themselves;
- advisors and trustees, into governance.

It also merges the duplicate people 6.2 created when a fellow was named differently in different places, for example "Leon" on a cycle page and "Leon Conrad" elsewhere.

**Architecture:** Same pipeline as 6.2.

- **Extract:** agents extract each people page through `--prompt` / `--record`, on the Claude subscription with no API key, and the answers are schema-checked.
- **Name variants:** a candidate finder groups name variants across all people the archive mentions. An agent decides the merges and writes them to `migration/aliases.json`.
- **Normalise:** normalisation turns pages into people, programmes, memberships and governance JSON.
- **Seed:** the seed step upserts them, re-runs the 6.2 course import so courses point at canonical people, then prunes imported people nothing references any more.

**Tech Stack:** TypeScript (`tsx`), `jsdom`, `zod` 4, Payload 3.90.2 local API, vitest. No schema change, so no migration and no reset.

**Spec:** `docs/schema.md` (Archive import), `CONTEXT.md` (Person, CILASian, Membership, Programme, Bridge Programme, Advisor/Trustee), ADR 0001.

**Branch:** `main`, one commit per task, no push.

---

## Roadmap

6.1 Foundations ✓ → 6.2 Cycles and courses ✓ → **6.3 People** (this plan) → 6.4 Course flows → syllabus (sessions, materials, activities, verified against the PDFs) → 6.5 Articles, publications, press, events, newsletters, media, redirects.

## Decisions made in this plan

**Source pages.** These 9 pages are read as people pages:

- `cilasians-2013-2014` … `cilasians-2017-2018` (Cairo cohorts);
- `cilas-in-alex-2018-2019` and `cilas-in-alex-2019-2020` (Alexandria cohorts). The manifest calls these `cycle` pages, but they list people, and 6.2 found no courses on them;
- `advisors` and `trustees`.

**Roles come from the section heading.**

- `Students` → `student`.
- `Residential Fellows` → `residential_fellow`.
- `Visiting Fellows` → `visiting_fellow`.
- A plain `Fellows` (2013–14) or `Core Courses Fellows` (Alexandria 2019–20) → `residential_fellow`, flagged for review. Those fellows taught the core courses, which is what residential fellows did in later years.
- Team or staff sections → no membership. The person is still imported, and the case is flagged.

**Bridge programmes.**

- One per cohort page.
- Cairo: "Bridge Programme 2015–2016". Alexandria: "Bridge Programme 2018–2019 (Alexandria)".
- **Linked cycles:** the cycles imported in 6.2 whose `academic_year` matches and whose space fits the city (al-Manshiya for Alexandria; al-Ghuria or Darb el-Labbana for Cairo).
- **Components:** one per linked cycle and course-type group: "Core courses, <cycle>" → `[CORE]`, and "Thematic courses and labs, <cycle>" → `[THEMATIC, LAB]`, per ADR 0003.
- **Status:** all are drafts marked "needs review". A person publishes them.

**Unverified Bridge years.** 2020–21, 2023–24 and 2024–25 are also created, as drafts with no members (decided in the grilling, Q12). The archive has course pages for those years but no cohort pages.

**Name merges.**

- Names merge only through `migration/aliases.json` (`canonical: [variants]`). Matching is by spelling, regardless of accents, case or punctuation.
- The candidate finder groups names that:
  - fold to the same text;
  - are a single first name matching the first word of a full name;
  - or are within two letter edits of each other.
- An agent then reviews each group with its context (pages, courses, years) and writes only confident merges. Uncertain groups go to `migration/review/people.md`.
- **The canonical person** is the one the dev seed already has, if any. Otherwise it is the fullest spelling.
- **Re-pointing:** after the merges, courses are re-imported. 6.2's upsert updates the `fellows` of every course not yet reviewed, so they point at canonical people.
- **Pruning:** then any person with `import_status: needs_review` that no course, membership, governance row or article references is deleted. Reviewed or hand-made people are never deleted.

**Governance.**

- One row per advisor or trustee, upserted by person and role.
- `title` holds their position elsewhere. `advises_on` is set for advisors and `board_role` for trustees. `order` follows page order.
- No terms are recorded, because the pages give none.

**Photos.** Each person's photo upload path is kept in `seed/data/archive/people.json` for plan 6.5, which uploads media. Nothing is uploaded here.

## File map

| File                                                                             | Change   | Responsibility                                                                             |
| -------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `migration/lib/agent-extract.ts`                                                 | create   | shared `--pending` / `--prompt` / `--record` CLI                                           |
| `migration/extract-courses.ts`                                                   | modify   | use the shared CLI; keep `--restamp-monolingual` and `--api`                               |
| `migration/lib/people-schema.ts`                                                 | create   | zod schema, prompt, version                                                                |
| `migration/extract-people.ts`                                                    | create   | stage 2 for people pages                                                                   |
| `migration/extracted/people/*.json`                                              | generate | committed                                                                                  |
| `migration/lib/name-candidates.ts`                                               | create   | variant groups                                                                             |
| `migration/people-candidates.ts`                                                 | create   | writes `review/people-candidates.md` for the alias agent                                   |
| `migration/lib/normalise-people.ts`                                              | create   | pure rules                                                                                 |
| `migration/normalise-people.ts`                                                  | create   | → `seed/data/archive/{people,programmes,memberships,governance}.json` + `review/people.md` |
| `migration/lib/import-people.ts`                                                 | create   | upserts + prune                                                                            |
| `migration/seed-people.ts`                                                       | create   | runner                                                                                     |
| `tests/unit/import-people-*.unit.spec.ts`, `tests/int/import-people.int.spec.ts` | create   |                                                                                            |

**Commands:**

- One spec: `pnpm vitest run --config ./vitest.config.mts <path>`.
- Installs: none.
- Raw files are untrusted. Scripts take their path as an argument, and nothing is ever run from inside `migration/raw`.

**Baseline:** tsc clean, lint 0 errors, all unit tests pass.

---

### Task 1: Shared agent-extraction CLI

**Files:**

- Create: `migration/lib/agent-extract.ts`
- Modify: `migration/extract-courses.ts`
- Test: `tests/unit/import-agent-extract.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as z from 'zod'
import { describe, expect, it } from 'vitest'

import { isCurrent, recordAnswer, AGENT_MODEL } from '../../migration/lib/agent-extract'

const Schema = z.object({ n: z.number() })

describe('agent extraction cache', () => {
  it('records a valid answer stamped with the prompt hash, and sees it as current', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'agent-'))
    const answer = path.join(dir, 'a.json')
    writeFileSync(answer, JSON.stringify({ n: 3 }))
    recordAnswer({
      outDir: dir,
      name: 'page.html',
      prompt: 'P',
      version: '1',
      schema: Schema,
      answerFile: answer,
    })
    const saved = JSON.parse(readFileSync(path.join(dir, 'page.html.json'), 'utf8'))
    expect(saved).toMatchObject({ model: AGENT_MODEL, version: '1', data: { n: 3 } })
    expect(isCurrent({ outDir: dir, name: 'page.html', prompt: 'P', version: '1' })).toBe(true)
    expect(isCurrent({ outDir: dir, name: 'page.html', prompt: 'changed', version: '1' })).toBe(
      false,
    )
  })

  it('refuses an answer that does not match the schema', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'agent-'))
    const answer = path.join(dir, 'a.json')
    writeFileSync(answer, JSON.stringify({ n: 'x' }))
    expect(() =>
      recordAnswer({
        outDir: dir,
        name: 'p',
        prompt: 'P',
        version: '1',
        schema: Schema,
        answerFile: answer,
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run it to see it fail** (unresolved import).

- [ ] **Step 3: Implement**

`migration/lib/agent-extract.ts`:

```ts
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as z from 'zod'

/** Recorded on answers written by a Claude Code agent (subscription), not the API. */
export const AGENT_MODEL = 'claude-code:haiku'

export const shaOf = (version: string, model: string, prompt: string): string =>
  createHash('sha256').update(`${version}\n${model}\n${prompt}`).digest('hex')

type Key = { outDir: string; name: string; prompt: string; version: string }

/** A committed answer exists for this exact prompt (under whichever model wrote it). */
export const isCurrent = ({ outDir, name, prompt, version }: Key): boolean => {
  const file = path.join(outDir, `${name}.json`)
  if (!existsSync(file)) return false
  const cached = JSON.parse(readFileSync(file, 'utf8')) as { sha256: string; model: string }
  return cached.sha256 === shaOf(version, cached.model, prompt)
}

/** Validates an agent's answer and commits it, stamped with the prompt's hash. */
export const recordAnswer = <T>({
  schema,
  answerFile,
  ...key
}: Key & { schema: z.ZodType<T>; answerFile: string }): T => {
  const data = schema.parse(JSON.parse(readFileSync(answerFile, 'utf8')))
  mkdirSync(key.outDir, { recursive: true })
  writeFileSync(
    path.join(key.outDir, `${key.name}.json`),
    `${JSON.stringify({ sha256: shaOf(key.version, AGENT_MODEL, key.prompt), model: AGENT_MODEL, version: key.version, data }, null, 2)}\n`,
  )
  return data
}

/** The prompt plus the answer's JSON Schema, as an agent sees it. */
export const agentPrompt = (prompt: string, schema: z.ZodType): string => {
  const { $schema: _draft, ...json } = z.toJSONSchema(schema) as Record<string, unknown>
  return `${prompt.replace(/\n\nCall the record_page tool with the result\.$/, '')}\n\nAnswer with one JSON object matching this JSON Schema, and nothing else:\n\n${JSON.stringify(json)}`
}
```

Then refactor `migration/extract-courses.ts` to use `shaOf`, `isCurrent`, `recordAnswer` and `agentPrompt` from this module. Delete its local copies and keep its behaviour and CLI unchanged.

- [ ] **Step 4: Verify.** Run the new test, `npx tsc --noEmit`, and `npx tsx migration/extract-courses.ts migration/raw --pending`, which must still report `0 of 157 page(s) pending`. If any page shows pending, the hash changed: stop and report.

- [ ] **Step 5: Commit** `refactor(import): share the agent extraction CLI` plus the trailer.

---

### Task 2: People-page schema and prompt

**Files:**

- Create: `migration/lib/people-schema.ts`
- Test: `tests/unit/import-people-schema.unit.spec.ts`

- [ ] **Step 1: Failing test.** `PeoplePage.parse` accepts this sample, and rejects a group outside the enum:

```ts
{
  year: '2015-2016',
  place: 'cairo',
  people: [
    { name: 'Eman Maarek', name_ar: null, group: 'student', title: null, bio: 'My name is Eman Maarek…', email: null, photo: 'uploads/1/9/1/0/19102967/4190580_1_orig.jpg', board_role: null, advises_on: null },
    { name: 'Michael Brint', name_ar: null, group: 'advisor', title: 'Professor of Political Science, California Lutheran University', bio: '…', email: null, photo: null, board_role: null, advises_on: 'curriculum design and university partnerships in the US and the UK' },
  ],
}
```

`peoplePrompt({ file, title, text })` contains the file name and the text. `PEOPLE_PROMPT_VERSION` matches `^\d+$`.

- [ ] **Step 2: See it fail.**

- [ ] **Step 3: Implement**

```ts
import * as z from 'zod'

export const PEOPLE_PROMPT_VERSION = '1'

export const ExtractedPerson = z.object({
  name: z.string().min(1),
  name_ar: z.string().nullable(),
  group: z.enum([
    'student',
    'residential_fellow',
    'visiting_fellow',
    'fellow',
    'team',
    'advisor',
    'trustee',
  ]),
  title: z.string().nullable(),
  bio: z.string(),
  email: z.string().nullable(),
  photo: z.string().nullable(),
  board_role: z.string().nullable(),
  advises_on: z.string().nullable(),
})
export type ExtractedPerson = z.infer<typeof ExtractedPerson>

export const PeoplePage = z.object({
  year: z
    .string()
    .regex(/^\d{4}-\d{4}$/)
    .nullable(),
  place: z.enum(['cairo', 'alexandria']).nullable(),
  people: z.array(ExtractedPerson),
})
export type PeoplePage = z.infer<typeof PeoplePage>

export const peoplePrompt = ({
  file,
  title,
  text,
}: {
  file: string
  title: string
  text: string
}): string => `You are extracting people from one archived page of CILAS, the Cairo Institute for Liberal Arts and Sciences. The page lists a year's community (students, fellows, team) or its board (advisors, trustees). Pages are in English, Arabic or both.

Page file: ${file}
Page title: ${title}

Rules:
- Use only facts stated on the page; null when absent. Never guess emails or names.
- year: the academic year the page covers, as "YYYY-YYYY" (e.g. "2015-2016"); null for advisors/trustees pages.
- place: "alexandria" if the page is about CILAS in Alexandria, "cairo" for Cairo cohorts; null for advisors/trustees.
- One entry per person, in page order. name: as written in English (fix only spacing; keep capitalisation of particles as written, but write the surname in normal case, e.g. "Michael BRINT" → "Michael Brint"). name_ar: their Arabic name if the page gives it.
- group from the section heading the person is under: "Students" → student; "Residential Fellows" → residential_fellow; "Visiting Fellows" → visiting_fellow; a plain "Fellows" or "Core Courses Fellows" → fellow; team, staff, coordinators, administration → team; advisors page → advisor; trustees page → trustee.
- title: their role or position as stated, e.g. "Teaching Fellow in the Humanities and Arts", "coordinates the field of Social Sciences", "Associate Professor of Political Philosophy, University College Maastricht"; null if none.
- bio: their text, verbatim; if given in both Arabic and English, both, each in its own paragraphs; paragraphs separated by a blank line.
- email: only from the page (mailto links). photo: the uploads/… path of the image directly before their name, as written; null if none.
- board_role (trustees only): e.g. "Chairman", "Treasurer". advises_on (advisors only): what they advise on, e.g. "curriculum design and university partnerships in the US and the UK".

Page text (links as [text](href), images as ![image](src), headings as ##):
"""
${text}
"""`
```

- [ ] **Step 4: Pass, tsc clean.** **Step 5: Commit** `feat(import): people-page extraction schema and prompt` plus the trailer.

---

### Task 3: People-page runner

**Files:**

- Create: `migration/extract-people.ts`

- [ ] **Step 1: Write the runner.**
  - It has the same CLI shape as `extract-courses.ts`: `--pending`, `--prompt <file>`, `--record <file> <answer.json>`. It uses `agent-extract.ts`.
  - Pages are a fixed list: the 9 people pages named in Decisions.
  - It writes to `migration/extracted/people/`.
  - The prompt is `peoplePrompt({ file, title, text: pageText(html) })`.

- [ ] **Step 2: Verify.** Run `npx tsx migration/extract-people.ts migration/raw --pending`; it should print 9 pages pending. Then run `--prompt cilasians-2015-2016.html` and check that the output holds the rules, the text and the schema.

- [ ] **Step 3: Commit** `feat(import): people-page extraction runner` plus the trailer.

---

### Task 4: Extract the people pages (agents)

This task is done by the controller, not an implementer subagent. Dispatch Haiku agents with the same instructions as 6.2: one page at a time, `--prompt`, write the answer, `--record`. Use three agents of three pages each. Cohort pages run to about 20k characters.

- [ ] Spot-check `cilasians-2015-2016` and `advisors` against the page text. Check the group per section heading, the bios verbatim with both languages, and the photo paths.
- [ ] Commit `feat(import): extract the archive's people pages` plus the trailer.

---

### Task 5: Name candidates

**Files:**

- Create: `migration/lib/name-candidates.ts`, `migration/people-candidates.ts`
- Test: `tests/unit/import-name-candidates.unit.spec.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'

import { candidateGroups } from '../../migration/lib/name-candidates'

const n = (name: string, where = 'x') => ({ name, where })

describe('candidateGroups', () => {
  it('groups spellings that fold alike', () => {
    expect(candidateGroups([n('Michael BRINT'), n('Michael Brint'), n('Teun Dekker')])).toEqual([
      ['Michael BRINT', 'Michael Brint'],
    ])
  })

  it('groups a lone first name with full names starting with it', () => {
    expect(candidateGroups([n('Leon'), n('Leon Conrad'), n('Sara Salem')])).toEqual([
      ['Leon', 'Leon Conrad'],
    ])
  })

  it('groups names a couple of letters apart', () => {
    expect(candidateGroups([n('Manar Hazza'), n('Manar Hazzaa')])).toEqual([
      ['Manar Hazza', 'Manar Hazzaa'],
    ])
    expect(candidateGroups([n('Omar El-Rakhawi'), n('Omar El-Rakhawy')])).toEqual([
      ['Omar El-Rakhawi', 'Omar El-Rakhawy'],
    ])
  })

  it('leaves different people apart', () => {
    expect(candidateGroups([n('Sara Salem'), n('Sara Allam'), n('Mariam Boctor')])).toEqual([])
  })
})
```

- [ ] **Step 2: See it fail.**

- [ ] **Step 3: Implement**

```ts
const fold = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const distance = (a: string, b: string): number => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
  return dp[a.length][b.length]
}

const related = (a: string, b: string): boolean => {
  const fa = fold(a)
  const fb = fold(b)
  if (fa === fb) return true
  const [wa, wb] = [fa.split(' '), fb.split(' ')]
  if ((wa.length === 1 && wb[0] === wa[0]) || (wb.length === 1 && wa[0] === wb[0])) return true
  return wa.length > 1 && wb.length > 1 && wa[0] === wb[0] && distance(fa, fb) <= 2
}

/**
 * Names that may be one person, for an agent or a person to decide; distinct
 * spellings only, each group sorted, groups sorted by their first name.
 */
export const candidateGroups = (mentions: Array<{ name: string; where: string }>): string[][] => {
  // Code-point order, so the output is the same on every machine.
  const names = [...new Set(mentions.map((m) => m.name.trim()))].sort()
  const parent = new Map(names.map((n) => [n, n]))
  const find = (n: string): string => (parent.get(n) === n ? n : find(parent.get(n) as string))
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++)
      if (related(names[i], names[j])) parent.set(find(names[j]), find(names[i]))
  const groups = new Map<string, string[]>()
  for (const n of names) groups.set(find(n), [...(groups.get(find(n)) ?? []), n])
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
}
```

`migration/people-candidates.ts`:

- It gathers every name mentioned anywhere:
  - course fellows from `seed/data/archive/courses.json`, with their course title and cycle;
  - people from `migration/extracted/people/*.json`, with page and group;
  - the dev seed people, by reading `name` fields from `seed/collections/users.seed.ts` with a regex.
- It writes `migration/review/people-candidates.md`. That file has one section per group, listing each spelling with every place it appears.
- Run it, and report the number of groups.

- [ ] **Step 4: Pass, tsc clean.** **Step 5: Commit** `feat(import): find name variants that may be one person` plus the trailer, including the generated md.

---

### Task 6: Decide merges (agent)

This task is done by the controller. Dispatch one Sonnet agent; this is judgement work. Give it `migration/review/people-candidates.md` and this brief:

- for each group, merge only when the context makes it clear they are one person: same courses, same years, a first name used on a page where the full name also appears;
- write `migration/aliases.json` as `{ "<canonical>": ["<variant>", …] }`. The canonical name is the dev seed's spelling when one is present, otherwise the fullest correctly-cased spelling;
- list every group it did not merge, with a one-line reason, in `migration/review/people.md` under "Not merged".

- [ ] Spot-check five merges and five non-merges.
- [ ] Commit `feat(import): merge name variants of the same person` plus the trailer.

---

### Task 7: Normalise people, programmes, memberships and governance

**Files:**

- Create: `migration/lib/normalise-people.ts`, `migration/normalise-people.ts`
- Test: `tests/unit/import-people-normalise.unit.spec.ts`

- [ ] **Step 1: Failing tests** for these pure functions:
  - `programmeTitle('2015-2016', 'cairo')` → `'Bridge Programme 2015–2016'`, and `programmeTitle('2018-2019', 'alexandria')` → `'Bridge Programme 2018–2019 (Alexandria)'`;
  - `membershipRole('fellow')` → `{ role: 'residential_fellow', flagged: true }`, `membershipRole('visiting_fellow')` → `{ role: 'visiting_fellow', flagged: false }`, and `membershipRole('team')` → `null`;
  - `UNVERIFIED_YEARS` equals `['2020-2021', '2023-2024', '2024-2025']`.

- [ ] **Step 2: See them fail.**

- [ ] **Step 3: Implement the rules**, then the runner. The runner reads `extracted/people/*.json` and `aliases.json`, and writes `seed/data/archive/`:
  - `people.json`: one entry per canonical name, merged across pages. Each entry has `name`, `name_ar`, `bio` (the longest), `email`, `photo`, and `legacy_url`, set to `<first page>#<slug>`.
  - `programmes.json`:
    - Fields: `title`, `year` (as written, with an en dash), `place`, `verified`, `legacy_url`.
    - `legacy_url` is the cohort page path for verified years, and `null` for unverified ones.
  - `memberships.json`: `person` (canonical name), `programme` (title), `role`, `title`, `legacy_url` set to `<page>#<slug>`.
  - `governance.json`: `person`, `role` (`advisor`/`trustee`), `title`, `advises_on`, `board_role`, `order`, `legacy_url`.

  It also writes `migration/review/people.md` (appending under "Flagged"): every flagged role, and every team member with no membership.

- [ ] **Step 4: Run** `npx tsx migration/normalise-people.ts` and report the counts.

- [ ] **Step 5: Commit** `feat(import): normalise people, programmes, memberships and the board` plus the trailer.

---

### Task 8: Import into Payload, with merge and prune

**Files:**

- Create: `migration/lib/import-people.ts`, `migration/seed-people.ts`
- Test: `tests/int/import-people.int.spec.ts`

- [ ] **Step 1: Implement `importPeople(payload, data)`.** Reuse 6.2's `upsert` and `freeSlug`, exported from `import-courses.ts` (export them). Steps, in order:

  1. **People.**
     - Find by exact name in the default locale, which also finds the dev seed's people.
     - Otherwise create with `import_status: needs_review`.
     - On an imported, not-yet-reviewed person, fill in only the fields that are empty: `bio`, `social.website` (none here) and photo (deferred). Never overwrite.
     - Arabic name: write `name_ar` as a `locale: 'ar'` update.
  2. **Programmes.** Upsert by title as drafts (`_status: 'draft'`, `import_status: 'needs_review'`, `kind: 'bridge'`).
     - `cycles` are the cycles whose `academic_year` equals the programme's year and whose space fits its place. Look the cycles up via `payload.find` with `depth: 0`.
     - `components`, per cycle: `{ label: 'Core courses, <cycle title>', cycle, course_types: ['CORE'] }` and `{ label: 'Thematic courses and labs, <cycle title>', cycle, course_types: ['THEMATIC', 'LAB'] }`.
     - Unverified years get no components and the note "Unverified year: no cohort page in the archive" in `schedule_note`.
  3. **Memberships.** Upsert where `person` and `programme` are equal. That combination is the unique index.
  4. **Governance.** Upsert where `person` and `role` are equal.
  5. **Re-point courses.** Call `importCourses` again with `seed/data/archive/{cycles,courses}.json`. It must be re-normalised first with the new aliases (the runner does this; see Step 2).
  6. **Prune.** Delete people with `import_status: needs_review` that nothing references: no course `fellows` (check drafts too), membership, governance row, article `authors`, `credits.people`, enrollment, or user `person`. Return the pruned names.

  Return `{ people, programmes, memberships, governance, pruned }`.

- [ ] **Step 2: Runner** `migration/seed-people.ts`. It runs `normalise-courses.ts` (as a child process, `npx tsx migration/normalise-courses.ts`) so courses use the new aliases. Then it calls `importPeople` and prints the counts and the pruned names.

- [ ] **Step 3: Int test** with probe fixtures (names prefixed `Probe People`, programme year `2031-2032`). Cover:
  - a person is created with `needs_review`, and a second run creates nothing new;
  - a programme is created as a draft with its probe cycle linked and two components per cycle;
  - a membership is unique per person and programme;
  - a governance row is created for an advisor;
  - prune deletes an unreferenced `needs_review` person, and keeps a reviewed one and a referenced one.

  Clean up everything by probe name or legacy URL prefix.

- [ ] **Step 4: Run** the int test, then `npx tsx --env-file=.env migration/seed-people.ts` twice. The second run must create nothing. Report the counts, including how many duplicate people were pruned.

- [ ] **Step 5: Commit** `feat(import): people, cohorts, programmes and the board, with duplicates merged` plus the trailer.

---

### Task 9: Documentation

- [ ] In `migration/README.md`, add "People (plan 6.3)" with the commands, in the style of the 6.2 section. In `docs/schema.md`, under Built, add the 6.3 line with the counts.
- [ ] Commit `docs(import): running the people import` plus the trailer.
