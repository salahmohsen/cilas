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
