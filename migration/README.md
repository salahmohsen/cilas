# Archive import

Turns the old Weebly site into CILAS content (docs/schema.md, Archive import; ADR 0004).

Raw files live in `raw/`, which git and Docker ignore:
- `raw/weebly-zip-2025-04-23/`: the site export, the primary source.
- `raw/mirror/`: pages and uploads the ZIP lacks, fetched from the live mirror (cilas.lkssystems.com) by `fetch-mirror.ts`. A page the ZIP has is never refetched.

## Stages

1. `npx tsx migration/fetch-mirror.ts migration/raw`: crawl the mirror and download the missing pages and uploads.
2. `npx tsx migration/ingest.ts migration/raw`: write `manifest.json`, which lists every page with its kind, links and uploads.
3. Extract and normalise per page kind: plans 6.2–6.5 add these stages.
4. Seed: upsert by `legacy_url` as drafts marked "needs review", with one redirect per legacy URL.

`page-kinds.json` corrects the kind for pages the file-name rules misjudge. Edit it, then re-run the ingest.

Reviewed content is protected: `pnpm db:seed` refuses to reset while any document is marked reviewed.

## Cycles and courses (plan 6.2)

Extraction runs page by page through Claude Code agents on a Claude subscription (no API key):
- `npx tsx migration/extract-courses.ts migration/raw --pending` lists pages that are new or changed.
- `--prompt <file>` prints a page's prompt. An agent answers it, then `--record <file> <answer.json>` checks the answer against the schema and saves it to `extracted/`.
- After a prompt change that only matters for bilingual pages, `--restamp-monolingual` re-certifies the single-language ones.
- With an `ANTHROPIC_API_KEY`, `--api` does the whole run itself instead.

Then:
1. `npx tsx migration/normalise-courses.ts` writes `../seed/data/archive/{cycles,courses}.json`, plus `review/courses.md` listing every guess or gap.
2. `npx tsx --env-file=.env migration/seed-courses.ts` upserts them as drafts marked "needs review". Running it again is safe, and reviewed documents are never overwritten.

Rules worth knowing:
- Winter cycles count by their January year.
- Cairo cycles whose page names no venue are placed by date: al-Ghuria up to 2016–17, Darb el-Labbana after.
- Name variants of one person go in `aliases.json`.

## People, cohorts, programmes and the board (plan 6.3)

1. `npx tsx migration/extract-people.ts migration/raw --pending | --prompt <file> | --record <file> <answer.json>`: the nine people pages (cohorts 2013–20, advisors, trustees), extracted by agents as in 6.2.
2. `npx tsx migration/people-candidates.ts` writes `review/people-candidates.md`, groups of names that may be one person. Confident merges go in `aliases.json` (`canonical: [variants]`); the rest are listed in `review/people.md`.
3. `npx tsx migration/normalise-people.ts` writes `../seed/data/archive/{people,programmes,memberships,governance}.json`, and flags guesses in `review/people.md`.
4. `npx tsx --env-file=.env migration/seed-people.ts` runs these steps, and is safe to re-run:
   - re-normalises courses with the aliases;
   - re-imports courses, so they point at canonical people;
   - imports people, Bridge programmes (drafts), memberships and governance;
   - prunes imported, unreviewed people that nothing references, stopping above 200.

## Course flows into syllabi (plan 6.4)

Tools: `brew install poppler tesseract-lang` (pdftotext, pdftoppm, pdfinfo, Tesseract with Arabic). Word files go through macOS `textutil`.

1. `npx tsx migration/prepare-flows.ts migration/raw` writes every flow's derived files to `raw/flows/<id>/`, and the flow list to `flows.json`. Each flow gets the cheapest reading method that works:
   - `text`: the PDF text layer.
   - `mixed`: English flows quoting Arabic; the text layer, plus page images for the Arabic words.
   - `vision`: Arabic flows; page images, with Tesseract OCR as a helper.
   - `docx`: Word files.
   - Links come from `pdfinfo -url`, because the text shows only a link's underlined words.
2. `npx tsx migration/extract-flows.ts migration/raw --pending | --prompt <id> | --record <id> <answer.json>`: agents extract each flow on the subscription, as in 6.2.
3. `npx tsx migration/verify-flows.ts migration/raw` checks every syllabus against its source and writes `review/flows.md`:
   - every PDF link must be captured;
   - the meetings count must match the units the text numbers;
   - it also lists empty syllabi and flows it can't check automatically.
4. `npx tsx --env-file=.env migration/seed-flows.ts` writes the syllabi into courses: sessions, readings with links, and activities, in the flow's own locale. It never touches reviewed courses, and it is safe to re-run.

## Publishing content (plan 6.5)

Sources: the two *Pigeon Towers* books (English and Arabic), the *Translation as Education* booklet (Arabic), the newsletter PDF, and the press, news, blog, publication and newsletter pages.

1. `npx tsx migration/prepare-docs.ts migration/raw` writes each document's pages to `raw/docs/<id>/`: `page-N.txt`, plus `page-N.png` and Tesseract `page-N.ocr.txt` for the Arabic ones. The document list goes to `docs.json`.
2. `npx tsx migration/extract-content.ts migration/raw --pending | --prompt <unit> | --record <unit> <answer.json>`. The units are extracted in two passes, by agents on the subscription:
   - **Pass 1:** `toc:<doc>` gives each document's essays with their PDF page ranges, and its imprint. Check the ranges against the page images: printed page numbers are offset from PDF pages.
   - **Pass 2:** `essay:<doc>:<order>` units, available once their toc is recorded, plus `page:<file>` and `doc:newsletter-1`.
   - Arabic essays are read from the page images. A cheap model's first pass misreads Arabic words, so every Arabic essay is proofread against its images by a stronger model before it is committed.
3. `npx tsx migration/normalise-content.ts` writes `../seed/data/archive/{articles,publications,press,events,newsletters}.json` and `review/content.md`, which covers judgement calls, derived press outlets, Arabic names mapped to Latin spellings, and names with no person yet. An English essay and its Arabic translation become one article, paired by table-of-contents order.
4. `npx tsx --env-file=.env migration/seed-content.ts` imports the content:
   - **Articles:** published, approved and public; they keep `import_status: needs_review` until checked. Each language gets its own text only: an article with no text in a language (the Arabic-only booklet, the English-only blog) has no body in it, so the site shows its content language. The dev seed (`pnpm db:seed`) loads the same articles and publications through this importer.
   - **People:** credited by the names the sources print, with their Arabic spelling in the `ar` locale.
   - **Other content:** publications, press (matched by first link), events, newsletters, and the partners and people they need.
   - It never touches reviewed documents, sends no email, and is safe to re-run.

## Media and redirects (plan 6.6)

Media needs `legacy_url` (added in 6.6), so after pulling this run `pnpm db:reset` once, then re-run `seed-people`, `seed-flows` and `seed-content`.

1. `npx tsx --env-file=.env migration/seed-media.ts migration/raw --dry` lists what would be uploaded: people photos, outlet logos, the booklet cover, covers for courses with their own page, and the book and newsletter PDFs. It gives counts and total size, and writes nothing.
2. `npx tsx --env-file=.env migration/seed-media.ts migration/raw` uploads each archive file once to the `media` collection (R2, the bucket in `.env`), keyed by its archive path in `media.legacy_url`, and sets the fields that point at it:
   - It never overwrites a field that is already set, and never touches a reviewed document.
   - Print-edition URLs and the newsletter's PDF link move from ci-las.org to R2.
   - `review/media.md` lists files missing from the archive and jobs with no document.
3. `npx tsx --env-file=.env migration/seed-redirects.ts` writes one `redirects` doc per legacy page:
   - **Targets:** each page points at the document that replaced it, by reference. Every old upload path also gets a custom redirect to its R2 URL.
   - **Re-runs:** it is safe to re-run, and it keeps any redirect an admin changed.
   - **Review file:** `review/redirects.md` lists pages with no target, pages with several candidate targets, and space pages.
   - **Collections without a page:** a redirect to a collection with no frontend route stores fine, but resolves only once `src/lib/paths.ts` knows that route.
