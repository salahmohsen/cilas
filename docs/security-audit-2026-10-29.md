# Security review, 29 October 2026

This review covered the repository's open Dependabot alerts, installed dependency audit, draft previews, sign-in return URLs, public API routes, Payload access rules, uploads, server-side link fetching, and private search boundaries. It is a targeted source and local integration review, not a penetration test or a guarantee that the application has no other vulnerabilities. Production was not changed.

## Fixed findings

- **High. Draft previews bypassed document authorization.** `/api/preview` treated a returned ownership query as a boolean permission and discarded the query. Article and course preview reads bypassed access control, while programme preview reads also trusted draft mode. A retained draft cookie could therefore expose drafts after logout or when navigating to another author's work. Preview requests now authenticate the current reader, apply the collection's update constraint to the requested document, enforce read and field access, and omit article/course joins. Integration tests reproduced unauthorized reads before the fix and verify denial for anonymous readers and other authors, plus successful owner and administrator previews.
- **Medium. Sign-in return URLs accepted control characters.** A path such as `/\t/evil.example` passed `safeNext`, but browser URL parsing removes the tab and interprets the path as an external destination. Control characters are now refused. Tests cover tabs, carriage returns, newlines, null characters, ordinary local paths, protocol-relative URLs, and backslashes.
- **Low. `deepmerge` could poison a merged object's prototype.** Both copying an existing `__proto__` property and merging into a null-prototype target reproduced inherited attacker properties. There is no published patched release for [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). A pnpm package patch blocks prototype-related keys in both inputs, in the source and shipped CommonJS/UMD artifacts. Regression tests exercise Payload's installed copy. Docker copies the patch before its frozen dependency install.

## Dependency updates

GitHub reported 26 open alerts across 11 packages at the start. The npm audit also reported newer advisories affecting `qs`, `graphql-scalars`, and `deepmerge`, plus additional Undici and Happy DOM advisories. The initial audit reported 42 vulnerability findings across dependency paths.

Direct updates cover Undici, Zod, shadcn, and Vite. Transitive overrides cover vulnerable versions of PostCSS selector parser, fast-uri, csv-parse, esbuild, Happy DOM, ip-address, qs, graphql-scalars, and Undici. Updating shadcn removes the affected MCP SDK and body-parser dependency chain and its legacy Zod dependency, without forcing Zod 4 into Zod 3 consumers.

The resulting audit reports zero critical, high, or moderate findings. It still reports the low-severity `deepmerge` advisory because registry audits identify the version rather than evaluating local patches. The advisory is not ignored or dismissed. Revisit and remove the patch when upstream publishes a verified fix. Dependabot alerts on the default branch will remain open until the dependency changes reach that branch.

## Verified protections and limits

- Existing Payload upload validation refuses malicious HTML and SVG content. Integration tests verify those refusals and successful PNG/PDF uploads. No upload implementation change was needed.
- The link preview fetcher checks redirect destinations and DNS answers again at connection time. Private search hydrates engine candidates through Payload access checks. These were inspected, not subjected to a live production attack simulation.
- GitHub code-scanning alerts could not be read because code scanning is disabled. Secret scanning is also disabled. No repository security settings were changed.
- The broader publishing/plugin integration suites depend on seeded fixtures that the disposable schema does not provide. An exploratory run also found an approved-article duplication assertion failing. Those suites are not claimed as passing or included in the security CI job. That publishing behavior needs a separate investigation.

## Validation

- Production build against disposable local services.
- TypeScript and ESLint.
- All unit tests, including the installed dependency patch and return-URL regressions.
- Preview, upload, and CSV import integration tests against disposable PostgreSQL and S3-compatible storage.
- `pnpm audit --audit-level moderate`, with the remaining patched low advisory visible.
- GitHub Actions repeats dependency audit, typecheck, lint, and unit tests on pull requests and main. Actions are pinned to commit SHAs, use read-only repository permissions, and require no production secrets. Integration tests were run locally. The repository's cached MinIO image cannot currently be pulled from its registry, so the CI job does not depend on that image.

Node 22 matches the Docker runtime. A stale movie test assertion referred to removed `<details>` markup; that obsolete assertion was removed while keeping the source-link and attribution interaction checks.
