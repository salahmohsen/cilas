# Archive Media and Redirects Implementation Plan (6.6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The imported documents get their images and PDFs from the archive, stored in R2 through the `media` collection, and every legacy ci-las.org page gets one redirect to the document that replaces it.

**Architecture:** Two importers follow the 6.2–6.5 pattern. Both are idempotent and both upsert by `legacy_url`.
- **Media:** `importMedia` uploads each archive file once. The file is keyed by its upload path, stored in `media.legacy_url`. It then sets the upload fields that point at it.
- **Redirects:** `importRedirects` writes one `redirects` doc per manifest page. Each doc references the document that replaced the page. `pathOf` (src/lib/paths.ts) turns that reference into a URL once the collection has a frontend route. Until then, the redirect is stored but resolves to nothing, and the page shows 404, as it does today.

**Tech Stack:** Payload 3.90 (local API, s3Storage → Cloudflare R2), Postgres (Neon), tsx, vitest.

---

## Roadmap

6.1–6.5 done → **6.6 Media and redirects** (this plan). After this, the archive import is complete.

## Decisions made in this plan

- **Sources:** files come from `migration/manifest.json` `uploads`. Each is resolved to a local file with `resolveUpload` (`migration/lib/uploads.ts`), from the ZIP first and then the mirror. Nothing is fetched from the web.
- **Media key:** `media` gets `importFields()` (`legacy_url`, `import_status`). `legacy_url` is the upload path without its `?query`, e.g. `uploads/1/9/1/0/19102967/1213420.jpg`. A re-run finds the existing media doc and does not upload again.
  - This is the plan's only schema change. The user runs `pnpm db:reset` once after Task 1.
  - After the reset, re-run the archive importers: `seed-people` (which also re-imports courses), `seed-flows` and `seed-content`.
- **`alt` (required):** the person's name, the outlet's name, the publication's or course's title. The Arabic title is used when there is no English one.
- **What gets a file:**
  - **People:** `photo`, from `people.json` `photo`. 104 people have one.
  - **Partners (outlets):** `logo`, from the press item's `logo`. Several press items share an outlet; the first logo wins.
  - **Publications:** `cover_image`.
    - *Translation as Education*: the cover image on its page.
    - *Pigeon Towers*: none. Its page shows only portraits.
  - **Print editions:** the three book PDFs and the newsletter PDF are uploaded to `media`. Then:
    - `print_edition_url` is set to the media file's R2 URL. The ci-las.org address will stop working when the old site goes.
    - The newsletter's "Original PDF" link moves to R2 too.
  - **Courses:** `cover_image`, but only for courses that have their own page (manifest `kind: 'course'`, one course on the page). It is the first image in the page text. Courses on cycle pages that list several courses get no cover, and are counted in the review file.
- **Never overwrite:**
  - The importer never sets an upload field that already has a value (an editor may have chosen another image).
  - It never touches a doc marked `import_status: 'reviewed'`.
- **Redirects:**
  - **`from`:** the page's legacy URL as the manifest gives it, e.g. `/fall-cycle-2024.html`. `legacyCandidates` already matches the variants without `.html` and with a trailing slash.
  - **Target:** the document whose `legacy_url` equals the page URL, searched in the collections the redirects plugin lists (courses, cycles, programmes, publications, articles, events, press, people).
    - Failing that, a page whose documents all carry a `#fragment` of it goes to the cycle or programme document for that page, if there is one.
    - Otherwise, if exactly one document carries a fragment of it, that document is the target.
    - Pages with no target (about, admissions, press list, contact…) get no redirect. They are listed in `migration/review/redirects.md`, so an editor can add a custom URL later.
  - **Type:** `301`.
  - **Upsert:** by `from`.
  - **Upload URLs:** a request for an old upload (`/uploads/…`) whose file is now in media gets a custom-URL redirect to its R2 URL. Those links are spread around the web, and the files are the most-linked part of the old site.
- **Uploading writes to the R2 bucket in `.env` (`R2_BUCKET=cilas`).** The user chose "Upload to R2" in 6.5. A dry run (`--dry`) prints what would be uploaded, with counts and total size, before the real run.

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/collections/Media.ts` | modify | `...importFields()` |
| `migration/lib/import-media.ts` | create | `mediaFor(payload, path, alt)` (find or upload), `importMedia(payload, data)` |
| `migration/lib/media-plan.ts` | create | pure: which file goes to which doc field (`mediaJobs`), course-cover choice (`firstImage`) |
| `migration/seed-media.ts` | create | runner with `--dry` |
| `migration/lib/import-redirects.ts` | create | pure `redirectTargets(pages, docs)` + `importRedirects(payload, …)` |
| `migration/seed-redirects.ts` | create | runner; writes `migration/review/redirects.md` |
| tests | create | unit tests for the pure parts, int tests for both importers |

**Baseline:** tsc is clean, lint has 0 errors, and all tests pass. Raw files are untrusted: pass paths as arguments, and never run anything from inside `migration/raw`.

---

### Task 1: Media gets import fields

**Files:**
- Modify: `src/collections/Media.ts`

- [ ] **Step 1:** Add `...importFields()` from `@/fields/import` to the Media fields, after `space`.
- [ ] **Step 2:** `npx tsc --noEmit` clean; `npx -y pnpm@11.8.0 generate:types` if the repo has that script (check package.json), so `Media` in payload-types has `legacy_url`.
- [ ] **Step 3:** Do not create a migration: the user's `pnpm db:reset` generates it.
- [ ] **Step 4: Commit** `feat(media): legacy_url and import status on media` plus the trailer.
- [ ] **Step 5 (controller):** Ask the user to run `pnpm db:reset`. Then re-run `seed-people`, `seed-flows` and `seed-content` (each `npx tsx --env-file=.env migration/<name>.ts`, in the background), and delete any empty migration file the reset created.

---

### Task 2: Which file goes where (pure)

**Files:**
- Create: `migration/lib/media-plan.ts`
- Test: `tests/unit/import-media-plan.unit.spec.ts`

- [ ] **Step 1: Failing tests.**
  - `stripQuery('uploads/1/2/a.jpg?263')` → `'uploads/1/2/a.jpg'`.
  - `firstImage('text\n![image](uploads/1/a_orig.jpg?1)\n![image](uploads/1/b.png)')` → `'uploads/1/a_orig.jpg'`; no image → `null`.
  - `mediaJobs({ people, press, publications, courses, pages })` returns `{ collection, legacy_url, field, path, alt }[]`:
    - one per person with a `photo`;
    - one per outlet, from the first press item with a logo;
    - one for each publication cover;
    - one per course that has its own page and an image there.
  - Two jobs on the same path share one upload: the test checks that `uniquePaths(jobs)` dedupes them.
- [ ] **Step 2: See it fail. Step 3: Implement.** Courses come from `seed/data/archive/courses.json`. Their page is the manifest page whose `legacy_url` equals the course's `legacy_url` without its fragment, and whose `kind` is `course`. The page text comes from `pageText` (`migration/lib/page-text.ts`) on the page's HTML file, which is passed in by the runner.
- [ ] **Step 4: Pass. Step 5: Commit** `feat(import): plan which archive files go to which documents` plus the trailer.

---

### Task 3: Upload and attach

**Files:**
- Create: `migration/lib/import-media.ts`, `migration/seed-media.ts`
- Test: `tests/int/import-media.int.spec.ts`

- [ ] **Step 1: `mediaFor(payload, { path, file, alt })`.**
  - It finds the `media` doc whose `legacy_url` is `path`.
  - Otherwise it creates one with `filePath: file` (the resolved local file), `alt`, `legacy_url: path` and `import_status: 'needs_review'`.
  - It returns the id.
- [ ] **Step 2: `importMedia(payload, jobs, resolve)`.** For each job, it finds the target doc by `legacy_url` (draft, overrideAccess). It skips the doc if it is reviewed, or if the field is already set. Otherwise it gets the media id and updates the one field.
  - **Print editions:** each publication's PDF, found through `docs.json` or the manifest, becomes media. `print_edition_url` is set to that media doc's `url`.
  - **Newsletter issue 1:** its body's PDF link is rewritten to the media doc's `url`.
  - **Counts returned:** uploaded, reused, attached, skipped (reviewed), skipped (already set), missing file.
- [ ] **Step 3: `seed-media.ts`** builds the jobs from the archive JSON and the manifest.
  - `--dry` prints the counts and the total bytes, and writes nothing.
  - Without `--dry` it runs `importMedia`.
- [ ] **Step 4: Int test** with a probe person and a probe course: the photo is attached; a second run reuses the media doc (one doc only); a doc with a photo already set keeps it; a reviewed doc is untouched. Use a tiny PNG fixture in `tests/fixtures/` (create one, 1×1). Clean up the media docs it creates (their R2 objects are deleted with them).
- [ ] **Step 5:** tsc clean, lint 0 errors, int test passes.
- [ ] **Step 6 (controller):** Run `--dry`, report the counts and size to the user, then run it for real twice in the background. On the second run every file must be reused and nothing uploaded. Spot-check one person's photo URL loads (`curl -sI` on the R2 URL → 200).
- [ ] **Step 7: Commit** `feat(import): archive images and PDFs into media` plus the trailer.

---

### Task 4: Redirects

**Files:**
- Create: `migration/lib/import-redirects.ts`, `migration/seed-redirects.ts`
- Test: `tests/unit/import-redirects.unit.spec.ts`, `tests/int/import-redirects.int.spec.ts`

- [ ] **Step 1: Pure `redirectTargets(pages, docs)`.**
  - **Inputs:** `pages` is `{ legacy_url, kind }[]`. `docs` is `{ collection, id, legacy_url }[]`.
  - **Output:** `{ from, target: { collection, id } | null, reason }` per page.
  - **Rules:** as in Decisions:
    1. exact match;
    2. then the page's cycle or programme doc;
    3. then a single fragment doc;
    4. else `null`.
  - **Tests:**
    - a course page with an exact course;
    - a cycle page whose courses are fragments and whose cycle doc matches exactly;
    - a cohort page with one programme;
    - an info page → `null`;
    - a page with two fragment courses and no page doc → `null`, with reason `ambiguous`.
- [ ] **Step 2: `importRedirects(payload, results, uploads)`.**
  - For each target, it upserts a `redirects` doc by `from`. Fields: `type: '301'`, and `to: { type: 'reference', reference: { relationTo, value: id } }`.
  - For each media doc with a `legacy_url`, it upserts `from: '/' + legacy_url`, `to: { type: 'custom', url: <media url> }`.
  - It never changes a redirect an admin edited: skip any redirect whose `to` differs from what the importer would write and that already existed before this run (compare and count it as "kept").
- [ ] **Step 3: `seed-redirects.ts`.** It loads the manifest pages and every imported doc's `legacy_url` from the eight collections, then runs the import. It writes `migration/review/redirects.md`: pages with no target, with their kind and title, and ambiguous pages with their candidates.
- [ ] **Step 4: Int test.** A probe course and a probe cycle are created. The test checks:
  - the redirects are created;
  - a re-run creates none;
  - `findRedirect(payload, '/probe-course')` resolves to `/study/<slug>`, with no `.html`, through `legacyCandidates`;
  - an admin-edited redirect is kept.
- [ ] **Step 5 (controller):** Run it twice in the background; the counts are equal and the second run creates nothing. Report how many pages got a redirect, and how many reach a live URL today (courses only).
- [ ] **Step 6: Commit** `feat(import): one redirect per legacy page` plus the trailer.

---

### Task 5: Documentation

- [ ] Add a "Media and redirects (plan 6.6)" section to `migration/README.md`. It holds the commands and the reset note, and says that redirects to collections without a route start working when `pathOf` learns the route.
- [ ] Add a Built line with counts to `docs/schema.md`.
- [ ] Commit `docs(import): media and redirects` plus the trailer.
