# Archive Import: Publishing Content (6.5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the archive's publishing content as drafts awaiting review:

- the essays of _On the Emergence of Pigeon Towers_ (English and Arabic) and the _Translation as Education_ booklet, as full-text articles inside their publications;
- the press page;
- the 2013 news posts and open day, as events;
- the three 2015 blog posts, as articles;
- the newsletter issues.

**Architecture:** Same pipeline as 6.2–6.4: prepare → agent extraction on the subscription (`--prompt` / `--record`) → normalise → upsert. Two new pieces:

- **Long PDFs** are extracted per essay. A first pass reads each document's table of contents into page ranges. A second pass extracts each essay from only its pages, so no agent sees a whole 65-page book.
- **Article bodies** come back as typed blocks (heading, paragraph, quote, list item, note). They are converted to Lexical with real headings and quotes, not just paragraphs.

**Tech Stack:** poppler, Tesseract (`ara`), TypeScript (`tsx`), zod 4, Payload 3.90.2, vitest. No schema change.

**Spec:** `docs/schema.md` (Publishing; Archive import), ADR 0004, CONTEXT.md (Article, Publication, Credit, Press item, Event, Newsletter).

**Branch:** `main`, one commit per task, no push.

---

## Roadmap

6.1–6.4 done → **6.5 Publishing content** (this plan) → 6.6 Media upload to R2 and one redirect per legacy URL.

## Decisions made in this plan

- **Sources**
  - _Pigeon Towers_: `on_the_emergence_of_pigeon_towers_-_english.pdf` (65 pp.) and `…_-_ِarabic.pdf`.
  - _Translation as Education_: `translation_lab_works.pdf` (38 pp., Arabic).
  - Pages: `on-pigeon-towers`, `translation-as-education`, `press`, `news-and-events`, `events-documents`, `-latest`.
  - Newsletters: `cilas_newsletter_issue_no._1.pdf`, plus the Mailchimp campaign-archive links on the site.
- **Reading method:** the English book uses its text layer. The Arabic book and the booklet are read from page images, with OCR as a helper (the 6.4 benchmark: Arabic text layers are broken).
- **One article per essay, in two locales.** An English essay and its Arabic translation are the same article. Essays are matched across the two books by order in each table of contents. The English text is the `en` locale, the Arabic the `ar` locale.
  - The translator goes into `credits` with role `translator`.
  - Translated booklet articles also fill the `translation` group: original title and authors, as the booklet credits them.
- **Matching to existing articles:** the dev seed already holds these articles, with digests. An imported article is matched first by `legacy_url`, then by its English title. On a match, its `body` is replaced with the full text and `legacy_url` / `import_status` are set.
- **Review status:** imported articles get `review.status: 'submitted'` and stay drafts (`_status: 'draft'`), so an editor publishes each by approving it. Server writes send no email.
  - Existing tiers are kept.
  - New articles get `requested_tier: 'public'`.
- **Article bodies:** blocks are `heading` (level 2–4), `paragraph`, `quote`, `list_item` and `note` (footnotes and endnotes, kept at the end under a "Notes" heading). Arabic blocks get `rtl`.
- **Publications:** these fields come from their pages and the books' imprints:
  - `intro`, `credits` (role per credit line: editor, translator, copy_editor, proofreader, supervisor, coordinator, art_director, cover_designer);
  - `funders` (ACSS and the Ford Foundation for Pigeon Towers);
  - `license` (CC BY-NC-SA, per the imprint);
  - `foreword` (the foreword essay), `articles` in table-of-contents order;
  - `produced_by` (the Translation Lab courses, matched by legacy URL);
  - `print_edition_url` (the old site's PDF URL on `https://www.ci-las.org/uploads/…`).
- **Press:** each item on the press page becomes a press doc.
  - Its `outlet` partner is matched by name and created when missing (`kind: ['outlet']`).
  - Bylines become `authors` rows: a person if one exists by canonical name, otherwise a free-text name.
  - `date_precision` follows what the page states.
- **Events:** news posts announcing a gathering (open day, talk, workshop, screening) become events, with `schedule.start_date` set to their date and `once` semantics: 1 week, 1 slot, with times when stated. News posts that announce no gathering (calls for applications) are listed in the review file and not imported.
- **Blog:** each of the three 2015 posts becomes an article. Authors are matched to people by canonical name. A post without a named author gets the person "Karim-Yassin Goessinger", the founder, who wrote the blog, and is flagged.
- **Newsletters:**
  - Issue 1 (PDF) gets its text as `body`.
  - Each Mailchimp link becomes an issue whose `body` is one paragraph linking to the campaign archive. The archive itself is not fetched, because the sources are the backup and the mirror only.
  - `issue_date` comes from the link text or the archive URL's date. Undated issues are flagged.
- **Upload links:** a link to an upload whose file name holds Arabic often arrives mis-decoded as Latin-1 (`Ù…Ù‚Ø§Ù„`). `resolveUpload` retries such paths decoded as UTF-8, so these files resolve.

## File map

| File                                                           | Change   | Responsibility                                                                                                 |
| -------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `migration/lib/uploads.ts`                                     | modify   | mojibake retry                                                                                                 |
| `migration/lib/blocks.ts`                                      | create   | blocks → Lexical                                                                                               |
| `migration/lib/content-schemas.ts`                             | create   | zod schemas + prompts: `Toc`, `Essay`, `PressPage`, `NewsPage`, `BlogPage`, `PublicationPage`, `NewsletterDoc` |
| `migration/prepare-docs.ts`                                    | create   | per-page text, images, OCR for the 4 documents → `migration/raw/docs/<id>/`                                    |
| `migration/extract-content.ts`                                 | create   | `--pending` / `--prompt` / `--record` over every extraction unit                                               |
| `migration/extracted/content/*.json`                           | generate | committed                                                                                                      |
| `migration/normalise-content.ts`                               | create   | → `seed/data/archive/{articles,publications,press,events,newsletters}.json` + `review/content.md`              |
| `migration/lib/import-content.ts`, `migration/seed-content.ts` | create   | upserts                                                                                                        |
| tests                                                          | create   | unit tests for the pure parts, an int test for the import                                                      |

**Baseline:** tsc is clean, lint has 0 errors, and all tests pass. Raw files are untrusted: pass paths as arguments, and never run anything from inside `migration/raw`.

---

### Task 1: Upload links with mis-decoded Arabic names

**Files:**

- Modify: `migration/lib/uploads.ts`
- Test: `tests/unit/import-uploads.unit.spec.ts`

- [ ] **Step 1: Failing test.** The files set holds `uploads/1/9/1/0/19102967/مقال_فريدة_مقار.pdf`. `resolveUpload('uploads/1/9/1/0/19102967/' + Buffer.from('مقال_فريدة_مقار.pdf', 'utf8').toString('latin1'), files)` resolves to it with `missing: false`.
- [ ] **Step 2: See it fail. Step 3: Implement.** When the decoded path isn't in `files` and contains characters in `\u0080-ÿ`, try `Buffer.from(path, 'latin1').toString('utf8')`. If that variant is in `files`, use it.
- [ ] **Step 4:** Run the test, then `npx tsx migration/ingest.ts migration/raw`. Confirm the two Pigeon Towers / press PDFs are no longer missing, and report the new missing count.
- [ ] **Step 5: Commit** `fix(import): resolve upload links whose Arabic names were mis-decoded` plus the trailer, with the regenerated manifest.

---

### Task 2: Blocks to Lexical

**Files:**

- Create: `migration/lib/blocks.ts`
- Test: `tests/unit/import-blocks.unit.spec.ts`

- [ ] **Step 1: Failing test.** `blocksToLexical(blocks, 'ltr')` turns these blocks:

  ```
  [{type:'heading',level:2,text:'Introduction'},{type:'paragraph',text:'First.'},{type:'quote',text:'Said.'},{type:'list_item',text:'One'},{type:'list_item',text:'Two'},{type:'note',text:'1. A source.'}]
  ```

  into a Lexical root whose children are, in order:
  - a `heading` with `tag: 'h2'`;
  - a `paragraph`;
  - a `quote`;
  - one `list` (`listType: 'bullet'`) with two `listitem` children;
  - a `heading` "Notes" with `tag: 'h3'`;
  - a paragraph `1. A source.`.

  Every text node carries the given direction on its block. `blocksToLexical([], 'rtl')` returns `null`.

- [ ] **Step 2: See it fail. Step 3: Implement.**
  - Follow the node shapes in `seed/seed.utils.ts` `lexical()`: `version: 1`, `format: ''`, `indent: 0`, `direction`.
  - Headings: `{ type: 'heading', tag: 'h2'|'h3'|'h4', children: [text] }`.
  - Quote: `{ type: 'quote', children: [text] }`.
  - Consecutive `list_item`s are grouped into `{ type: 'list', listType: 'bullet', tag: 'ul', start: 1, children: [{ type: 'listitem', value: n, children: [text] }] }`.
  - Notes go last, under one `h3` "Notes", or "ملاحظات" when the direction is `rtl`.
  - Check the node fields Payload's lexical editor expects in `node_modules/@payloadcms/richtext-lexical` (`HeadingNode`, `QuoteNode`, `ListNode`), and match them.
- [ ] **Step 4: Pass, tsc clean. Step 5: Commit** `feat(import): typed article blocks to Lexical` plus the trailer.

---

### Task 3: Content schemas and prompts

**Files:**

- Create: `migration/lib/content-schemas.ts`
- Test: `tests/unit/import-content-schemas.unit.spec.ts`

- [ ] **Step 1: Failing tests.** Each schema accepts a minimal sample and rejects one bad field. Each prompt contains its source id and its text. Schemas, exported with `CONTENT_PROMPT_VERSION = '1'`:

```ts
const Block = z.object({
  type: z.enum(['heading', 'paragraph', 'quote', 'list_item', 'note']),
  level: z.number().int().min(2).max(4).nullable(),
  text: z.string().min(1),
})

// Pass 1: what a long document contains, and where.
export const Toc = z.object({
  front_matter_pages: z.array(z.number().int().positive()), // imprint/credits pages
  essays: z.array(
    z.object({
      order: z.number().int().positive(),
      title: z.string().min(1),
      authors: z.array(z.string()),
      first_page: z.number().int().positive(),
      last_page: z.number().int().positive(),
      is_foreword: z.boolean(),
    }),
  ),
  imprint: z.object({
    credits: z.array(z.object({ role: z.string(), names: z.array(z.string()) })),
    license: z.string().nullable(),
    year: z.number().int().nullable(),
  }),
})

// Pass 2: one essay in full.
export const Essay = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullable(),
  authors: z.array(z.string()),
  translators: z.array(z.string()),
  original: z
    .object({
      title: z.string().nullable(),
      authors: z.array(z.string()),
      source: z.string().nullable(),
    })
    .nullable(),
  blocks: z.array(Block).min(1),
})

export const PressPage = z.object({
  items: z.array(
    z.object({
      title: z.string().min(1),
      outlet: z.string().nullable(),
      authors: z.array(z.string()),
      kind: z.enum(['coverage', 'interview', 'talk', 'op_ed']),
      date: z
        .string()
        .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
        .nullable(),
      links: z.array(
        z.object({
          language: z.enum(['ar', 'en', 'de', 'fr', 'other']).nullable(),
          url: z.string(),
        }),
      ),
      excerpt: z.string().nullable(),
      logo: z.string().nullable(),
    }),
  ),
})

export const NewsPage = z.object({
  posts: z.array(
    z.object({
      title: z.string().min(1),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      is_gathering: z.boolean(),
      event_type: z
        .enum([
          'talk',
          'panel',
          'book_discussion',
          'reading_group',
          'screening',
          'performance',
          'music',
          'exhibition',
          'open_day',
          'workshop',
          'residency',
          'visit',
          'other',
        ])
        .nullable(),
      start_time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .nullable(),
      end_time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .nullable(),
      speakers: z.array(z.string()),
      blocks: z.array(Block),
    }),
  ),
})

export const BlogPage = z.object({
  posts: z.array(
    z.object({
      title: z.string().min(1),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      authors: z.array(z.string()),
      blocks: z.array(Block).min(1),
    }),
  ),
})

export const PublicationPage = z.object({
  title: z.string(),
  subtitle: z.string().nullable(),
  intro: z.array(Block),
  credits: z.array(z.object({ role: z.string(), names: z.array(z.string()) })),
  funders: z.array(z.string()),
  license: z.string().nullable(),
})

export const NewsletterSources = z.object({
  issues: z.array(
    z.object({
      title: z.string().min(1),
      date: z
        .string()
        .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
        .nullable(),
      archive_url: z.string().nullable(),
      blocks: z.array(Block),
    }),
  ),
})
```

Prompts follow the 6.4 style (`flowPrompt`):

- **Verbatim only**: never translate or summarise.
- **Documents read from images**: read every listed page image.
- **Links**: every link the source gives is kept.
- **Essays**: every paragraph of the essay, in order, with headings as `heading` and footnotes as `note`. No page numbers or running heads.
- **Press, news and blog**: as the page states; null when absent.

- [ ] **Step 2: See it fail. Step 3: Implement. Step 4: Pass. Step 5: Commit** `feat(import): schemas and prompts for publishing content` plus the trailer.

---

### Task 4: Prepare the documents and the extraction runner

**Files:**

- Create: `migration/prepare-docs.ts`, `migration/extract-content.ts`

- [ ] **Step 1: `prepare-docs.ts`.** It follows `migration/prepare-flows.ts`: `execFileSync` with argument arrays, idempotent. For each of the 4 documents it writes `migration/raw/docs/<id>/`:
  - `page-N.txt` per page (`pdftotext -layout -f N -l N`);
  - for Arabic documents, `page-N.png` (`pdftoppm -r 150`) and `page-N.ocr.txt` (Tesseract `ara+eng`);
  - `links.json` (`pdfinfo -url`).

  It also writes `migration/docs.json` (`[{ id, file, pages, method }]`).

- [ ] **Step 2: `extract-content.ts`.** Built on `migration/lib/agent-extract.ts`. Its units, by id:
  - `toc:<doc>`: the first 6 pages' text or images and the last 2 pages. Schema `Toc`.
  - `essay:<doc>:<order>`: only pages `first_page..last_page` from that document's recorded `Toc`, as text, or as images plus OCR. Schema `Essay`. These units become available only once the doc's `Toc` is recorded, so `--pending` lists them after pass 1.
  - `page:<file>`: the page text of `press.html`, `news-and-events.html`, `-latest.html`, `on-pigeon-towers.html`, `translation-as-education.html` and `events-documents.html`. The schema is chosen per page: `PressPage`, `NewsPage`, `BlogPage`, `PublicationPage` ×2, and `NewsletterSources` (which also gets the Mailchimp links from every archive page, as a list).
  - `doc:newsletter-1`: the newsletter PDF's text. Schema `NewsletterSources`.

  Output goes to `migration/extracted/content/<unit id with : replaced by __>.json`.

- [ ] **Step 3: Verify.**
  - Run `prepare-docs`.
  - Check `--pending` lists the 3 toc units, 6 page units and the newsletter doc.
  - Check `--prompt` for `toc:on_the_emergence_of_pigeon_towers_-_english` and for one `page:` unit.
- [ ] **Step 4: Commit** `feat(import): prepare documents and the publishing-content extraction runner` plus the trailer.

---

### Task 5: Extract (agents; controller)

- **Pass 1:** one Haiku agent records the 3 `toc:` units, reading images for the Arabic documents. The controller checks the page ranges against the PDFs' page counts.
- **Pass 2:**
  - **English essays:** Haiku agents, 2 essays each.
  - **Arabic essays:** Haiku agents, 1 essay each, because they are image-heavy.
  - **Page units and the newsletter:** one Haiku agent.
  - **Agent brief:** the 6.4 rules: verbatim, read every listed image, keep every link, never guess.
- **Check:**
  - Every essay has blocks.
  - English and Arabic essay counts per book match, or the mismatch is explained.
  - Spot-check one English and one Arabic essay's first and last paragraphs against the page images.
- **Commit** `feat(import): extract the archive's essays, press, news, blog and newsletters` plus the trailer.

---

### Task 6: Normalise

**Files:**

- Create: `migration/normalise-content.ts`
- Test: `tests/unit/import-content-normalise.unit.spec.ts`, for the pure helpers
- Output: `seed/data/archive/{articles,publications,press,events,newsletters}.json` and `migration/review/content.md`

- [ ] **Step 1: Pure helpers with tests:**
  - `pairEssays(enToc, arToc)`: pairs essays by `order`, and reports unequal counts.
  - `creditRole(label)`: maps imprint labels to credit roles. Examples: "Editor" / "تحرير" → `editor`, "Translation" / "ترجمة" → `translator`, "Copy-editor" → `copy_editor`, "Proofreading" / "تدقيق" → `proofreader`, "Supervision & coordination" → `supervisor`, "Art direction" → `art_director`, "Cover design" → `cover_designer`. Anything else → `other`, with the label kept.
  - `pressDate('2015')` → `{ date: '2015-01-01', precision: 'year' }`, and likewise month and day.
  - `licenseOf('CC BY-NC-SA')` → `'cc_by_nc_sa'`.
- [ ] **Step 2: The runner** writes the five JSON files.
  - **Article:** `legacy_url` is `<page or pdf url>#<slug>`. It has `title_en`, `title_ar`, `blocks_en`, `blocks_ar`, `authors` (canonical names via `aliases.json`), `credits`, `translation` and `publication`.
  - **Publication:** has its articles in table-of-contents order, its foreword, its credits and its `print_edition_url`.
  - **Review file:** lists every flag:
    - unpaired essays;
    - blog posts without an author;
    - undated newsletters;
    - news posts that were not imported.
- [ ] **Step 3: Run and report counts. Step 4: Commit** `feat(import): normalise publishing content` plus the trailer.

---

### Task 7: Import, test, run

**Files:**

- Create: `migration/lib/import-content.ts`, `migration/seed-content.ts`
- Test: `tests/int/import-content.int.spec.ts`

- [ ] **Step 1: Implement `importContent(payload, data)`.** Reuse `upsert` / `freeSlug` from `import-courses.ts`. Never touch a reviewed document. The steps:
  - **People:** authors and credit names resolve to people by exact name. A missing name is created with `needs_review`, as 6.2 did.
  - **Articles:**
    - Match by `legacy_url`, else by English title (the dev seed's articles). Write `en` with `blocksToLexical(blocks_en, 'ltr')`, then `locale: 'ar'` with `blocks_ar` (`rtl`) when present.
    - Set `authors`, `credits`, `translation`, `review: { status: 'submitted' }`, `_status: 'draft'`, `import_status: 'needs_review'` and `legacy_url`.
    - `requested_tier` is `public` for new articles. A matched article keeps its tier.
  - **Publications:** match by `legacy_url`, else by English title. Write credits, funders, license, foreword, articles, produced_by and print_edition_url.
  - **Partners:** found by name, or created as `kind: ['outlet']` or `['funder']`.
  - **Press:** upsert by the first link's URL, checked with a `where` on `links.url`.
  - **Events:** upsert by `legacy_url`. Fields: tier `public`, the schedule via `once()` semantics, and speakers resolved by name.
  - **Newsletters:** upsert by `legacy_url`. Drafts.
- [ ] **Step 2: Runner, and Step 3: int test** with probe data:
  - an English and Arabic article pair: both locales carry their bodies, with a heading node and a quote node present;
  - an existing seed-like article matched by title gets its body replaced and keeps its tier;
  - a press item is created once across two runs;
  - a reviewed article is untouched.
- [ ] **Step 4: Run** the int test, then run `npx tsx --env-file=.env migration/seed-content.ts` twice in the background, polling its output. The counts must be equal on both runs. Spot-check one essay in both locales against the PDF.
- [ ] **Step 5: Commit** `feat(import): publishing content as drafts for review` plus the trailer.

---

### Task 8: Documentation

- [ ] Add a "Publishing content (plan 6.5)" section to `migration/README.md` with the commands, and a Built line with counts to `docs/schema.md`.
- [ ] Commit `docs(import): running the publishing-content import` plus the trailer.
