# Private Spaces search verification

Verified locally on 2026-10-28 in branch `t3/private-spaces-search`, worktree `/Users/salah/.t3/worktrees/cilas/t3-18c6e721`. Verification used only local disposable services. No deployment, production access or live credential changes were performed.

## Commands and results

- `./scripts/test-private-search.sh` passed 37 private contract/UI tests, including 18 real Postgres/Typesense integration tests, and all 63 existing Spaces core/write integration tests. Its disposable services were removed on exit.
- With `source scripts/search-test-env.sh`, focused unit suites for `private-search`, `private-search-aggregates`, `private-search-panel`, `private-space-search`, `search-filters`, `search-rows`, and `course-search` passed 53 tests. The three affected UI suites passed again after the final result markup change (20 tests).
- `pnpm exec tsc --noEmit` passed for the final implementation.
- Scoped ESLint passed with zero errors and one image-element warning in the shared result media component. The final full `pnpm lint` run also passed with zero errors and 46 warnings.
- `git diff --check` passed.

Before the filter/aggregate extension, the implementation also recorded a full unit run of 686 tests across 88 files and full lint with 46 existing warnings. Those are earlier results, not a full-suite rerun of the final change.

The final contract supports multiple spaces or none, validated per-space counts independent of selection, selected totals, empty-query browsing and global A–Z ordering when the bounded scan completes. Incomplete scans return unknown aggregates; the UI never fabricates zero counts or disables an option without a proven zero. Both tabs share filter state and result media layout. Private thumbnails come only from access-checked result attachments/event covers through authenticated file routes, with icon fallbacks. The real-engine tests additionally cover aggregate selection independence, introduction-gated counts, browsing/order, and authorized thumbnail ownership.

The integration harness uses Typesense 30.2, SDK 3.1.1, Payload 3.91.0, disposable Postgres 17 and disposable local S3 storage for existing upload tests. Containers are bound only to localhost and removed on exit. It never starts the default compose app, loads the main checkout's environment or touches the existing database on localhost:5433.

The private tests cover authentication, actual token expiry/logout, disjoint and overlapping spaces, forged selection and request parameters, intro-only posts/comments, forged comment-space relationships, introduction removal, enrollment withdrawal, Trial/Off/audience changes, current role/person changes, stale revisions, tombstones, hard deletes, live children, mismatched/deep comment parents, transaction rollback, late sequence commits, partial import failure, retry/backoff, duplicate work, delayed writes, a real database-writer connection loss, generation fencing, lost alias acknowledgement, concurrent rebuild edits/deletion, cursor resets, refill, candidate caps, highlight suppression, Arabic/English fixtures, rate limits, public-key denial on alias/physical/export/key/JOIN routes, current curation sets, and restricted server read/write credentials. Client tests cover text escaping, stale-response abortion, account changes, logout invalidation, and keeping private queries out of public search during permission refresh.

The existing vote privacy test had a false positive on a fresh database: its substring check for person ID `1,` also matched an ordinary `count:1,`. That redundant string assertion was removed. Its exact expected vote projection, including empty voter arrays and only the reader's own choice, remains enforced.

## Local observations

A recorded reproducible workload ran 25 sequential synthetic search-service requests against 42 indexed records. Median service time was 30.68 ms and p95 was 42.46 ms, with 12 Payload find calls per search. These measurements include permission construction and hydration but exclude HTTP authentication and rate-counter overhead. They are not a concurrency or capacity result.

The test process reported 396 MiB RSS, including Vitest and Payload. End-of-suite container snapshots showed Typesense 244.2 MiB, Postgres 137.4 MiB and the test-only S3 service 78.38 MiB. These are local Docker snapshots, not production RAM estimates or rebuild peak measurements. The benchmark writes no query or body to its output.

## Remaining release work

[ADR 0010](adr/0010-private-spaces-search.md) contains the operational contract and rollout sequence. The feature defaults off. Apply the migration before deploying these write hooks, audit public/server credentials and public schemas, configure separate private keys, perform the initial rebuild, schedule and monitor the worker, assign retention/pruning ownership, verify proxy/CDN/logging settings, and measure on the actual VPS before enabling it.

Fresh historical migration replay is blocked by the pre-existing `20261018_174136_drop_about_page` data migration reading current schema before `site_settings_rels` exists. The harness initializes current Payload schema, then runs this feature's real migration. It does not claim to validate the complete historical migration chain or a production deployment upgrade.

MinIO's registry refused new image pulls during verification. The harness successfully used the pinned cached image digest already available locally. Another host needs that image preloaded or an available compatible image through `SEARCH_TEST_S3_IMAGE`.

Not run: production/VPS load testing, representative Arabic relevance review, an HTTP browser walkthrough, a production build, a full application integration suite, OS process-kill testing, engine-process failure testing, or actual CDN/shared-proxy configuration tests. A real writer database connection was terminated during an in-flight import; that stronger stale-writer case was exercised, but it is not described as an OS process-kill test. Previously downloaded content cannot be recalled after revocation. Offset pagination during live mutations is best effort. Unknown engine outcomes require an explicit generation recovery rebuild.
