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

