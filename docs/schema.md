# Target schema

The Payload schema CILAS is moving to. It replaces the old `CILAS.md` / `CILAS-schema.md` plan. Terms are defined in [CONTEXT.md](../CONTEXT.md), and the reasoning behind the big choices is in [docs/adr](./adr).

The code in `src/collections` is what exists today. This file is what it should become. Delete each section once the code matches it.

Conventions:
- Text that people read is `localized` (en, ar).
- Arabic falls back to English and English falls back to Arabic, and the page says "available in X only" when it shows the fallback.
- Every imported document has a hidden `legacy_url` and an `import_status`.

## Shared shapes

`schedule`, `registration` and `pricing` are built as field builders in `src/fields/`, with their logic in `src/lib/` (ADR 0002). Courses, cycles, programmes and events use them. `credits[]` (`src/fields/credits.ts`) is shared by articles and publications.

## Time and place, programmes, teaching

Spaces, cycles, programmes, courses and enrollments match the code (ADR 0002, ADR 0003). Still to do:
- **Admin:** show a course session's computed dates as placeholders in its `dates[]` (needs a custom field component).
- **Archive import (plan 6):** `legacy_url` and `import_status` on imported documents; unverified Bridge years (2020–21, 2023–24, 2024–25) as draft programmes; legacy trimesters mapped onto fall, winter and spring.

## Partners and publishing

People, users, governance and memberships match the code (ADR 0001). Partners, articles (with review), publications, press, events and newsletters match the code (ADR 0005). Still to do:
- **Newsletter sign-up:** a public form that posts to the Resend Audience API (frontend work).
- **Press links:** a periodic check that marks dead links so the page falls back to `archived_url`.
- **Article submission UI:** authors submit by choosing Submitted and using the main save button; a dedicated Submit button belongs with the frontend.

## Plugins

`plugin-redirects` and `plugin-seo` match the code, pinned to the other `@payloadcms` packages' version. Still to do:
- **Pages:** `src/lib/paths.ts` knows only `/study/<slug>`. Each new frontend route adds its collection there, which also makes redirects and SEO preview URLs reach it.
- **Archive import (plan 6):** one redirect per legacy URL (`from` is unique, so one row per old path).
- **Search:** `plugin-search` is postponed until the frontend has a search page.

## Removed
- `fields-of-study` and every reference to it.
- Stored course-flow PDFs, which are never kept in media or R2.

## Archive import (seed)

**Built (plan 6.1):**
- `legacy_url` and `import_status` on every imported collection.
- The reset guard.
- `migration/fetch-mirror.ts`, and the stage-1 `migration/ingest.ts` → `migration/manifest.json` (see `migration/README.md`).

- Cycles and courses (plan 6.2): 34 cycles and 290 courses imported as drafts for review. Course-flow uploads are kept as `flow_uploads` in `seed/data/archive/courses.json` for plan 6.4.

- People (plan 6.3): 10 Bridge programmes (7 cohort years plus 3 unverified drafts), 110 memberships, 8 governance rows. Name variants are merged through `migration/aliases.json`, and 68 duplicate people were pruned.

Stages 2–4 for course flows and publishing come in plans 6.4–6.5.

- **Sources:**
  - The Weebly "Archive Site" ZIP (202 pages and their uploads, snapshot of 23 Apr 2025) is the primary source.
  - The live mirror https://cilas.lkssystems.com/ fills in only what the ZIP lacks: 7 pages (the 2025–26 cycles, workshops/labs, Writing the Self) and 50 uploads. Redirects are for the real site, https://www.ci-las.org/.
  - An image linked as `published/X.ext` is found in the ZIP as `X_orig.ext`.
  - Raw files live in `migration/raw/`, which is in `.gitignore` and `.dockerignore`. The ZIP is at `migration/raw/weebly-zip-2025-04-23/`, and the mirror's pages and uploads go to `migration/raw/mirror/`. Only the manifest and the normalised JSON are committed.
- **Stages:**
  1. ingest → `migration/manifest.json`
  2. extract to per-page JSON
  3. normalise to `seed/data/archive/*.json`, with people deduplicated through `aliases.json`
  4. seed
- **Seeding:**
  - Updates or creates each document by `legacy_url`.
  - Rich text goes through `convertHTMLToLexical`.
  - Only images that some page links to are uploaded to media.
  - Each legacy URL gets a redirect.
  - Imported documents land as drafts marked needs review.
- The development-only `resetContent()` wipe must never run against reviewed content.

## Open
- **SiteSettings:** `social_links` platform `twitter` → `x`, to match people.
