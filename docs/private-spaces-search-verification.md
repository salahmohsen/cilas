# Private Spaces search verification

Parent follow-up verification independently passed the 53 focused unit tests, 18 real private integration tests, 63 existing Spaces integration tests, typecheck, and diff checks. The parent also passed request context into the file collection's existing read rule, matching posts and comments, and reran the isolated integration harness successfully. This reuses permission computation during thumbnail reads while retaining the separate final permission refresh. The synthetic workload confirmed fewer Payload lookups; this does not establish production capacity.

Initial implementation verification on 2026-10-28 in branch `t3/private-spaces-search`, worktree `/Users/salah/.t3/worktrees/cilas/t3-18c6e721`. Verification used only local disposable services. That earlier verification did not perform deployment, production access or credential changes. The production preparation below supersedes that operational snapshot.

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

## Production preparation on 2026-10-28

A fresh implementation owner preserved the existing verification notes and the `SpaceFiles` request-context change, reviewed it, and reran the disposable integration harness with it included. All project work stayed in the assigned worktree. No nested agents were used.

Code now supports a dedicated private engine endpoint, requires both the feature switch and an explicit retired-key audit attestation, checks active browser-key denial before maintenance writes, packages the maintenance CLI independently of Next's standalone trace, and adds sanitized queue health plus nonzero worker failure exits. The disposable test environment explicitly blanks optional external credentials so `process.loadEnvFile` cannot refill them from a local `.env`.

Final local checks passed:

- 57 focused unit tests across eight files, including four new credential/release-boundary tests.
- Relocated maintenance artifact imports from its own dependency tree, connects to the disposable Postgres database, reports uninitialized state with a nonzero exit, and refuses an unapproved rebuild. A real database test additionally proves that an active advisory-locked writer is healthy while an abandoned durable token requires recovery. The temporary runtime directory is removed afterward.
- 38 private contract/UI tests, including 19 real Postgres/Typesense integrations, and 63 existing Spaces integration tests. Final harness uses Typesense 30.2 and removes its explicitly disposable services.
- `pnpm exec tsc --noEmit`, `pnpm lint` (zero errors, 46 warnings) and `git diff --check`.

Live preparation completed:

- Inspected the existing CILAS Application, Postgres service and Typesense Compose deployment. They were already grouped in the CILAS production project. The local development Compose file does not deploy this Application.
- Preserved public Typesense 29 and its original volume/container. A real-engine run against 29 failed the private curation contract, so added an isolated private Typesense 30.2 service to the existing search Compose deployment rather than upgrading/replacing the public engine. That comparison failure is not included in the passing final test count.
- The new engine is healthy, has only the dedicated internal `cilas-search` overlay, no public ports/domain, a separate persistent volume, explicit disabled access/search/slow-query logs, rotating container logs, 1 GiB RAM and one CPU. The running web container is on that overlay and its existing Dokploy network. Postgres was not moved.
- Provisioned distinct restricted private read/write keys. The private bootstrap key remains outside the Application. The bootstrap job was run twice to verify idempotency.
- Created collection-scoped public browser and public indexer keys. Safely updated the intended runtime and explicit build-argument entries while preserving unrelated values. Rebuilt unchanged `main` at `68f98539f04c8593ad84bfa27b3888202e50fb75`, deployment `Yu63HMM8w_zvAAzM0GS3L`, status `done`. The initial env-only rebuild still contained the old compiled key; inspection caught the explicit build-argument mismatch before revocation.
- Verified the replacement in running browser JavaScript and externally served same-origin chunks, and a successful external homepage response. Then revoked the old wildcard browser key. Restricted public search still succeeds; public browser/indexer keys cannot administer keys.
- Final read-only release audit `DmSwedWFzfITho3zcRPXE` passed every check, including private search/export/key/JOIN-route denial for the active browser key, valid private read/write credentials, isolated public schemas, active replacement bundle, networking, persistence, health, limits and logging configuration. The private engine had **zero collections**. No member text was indexed.
- Saved `PRIVATE_SPACES_SEARCH_KEYS_VERIFIED=true` after that audit. `PRIVATE_SPACES_SEARCH=false` remains saved. The attestation will enter the runtime on the next approved deployment; this does not enable the old main code or create private indexes.
- Prepared disabled worker (every minute), health (every five minutes) and generation-retention (Sunday 03:30 UTC) application schedules. Manual bootstrap/network/release audit schedules are disabled and have no recurring effect.

The [operations runbook](private-spaces-search-operations.md) contains the reviewed Compose configuration, commands, rollback and exact rollout sequence. PR #8 is unmerged. This feature's production migration, initial rebuild, live private HTTP/session acceptance, VPS load measurements and activation were **not** performed. The passing main deployment is the public credential cutover, not deployment of the private-search PR. The private endpoint still returns 404 on main, as expected.

Release gates remain concrete. Merge/deploy authority is required for PR #8, followed by migration verification, initial rebuild, worker activation and on-host acceptance before enabling private reads. Exhaustive counts and global A–Z beyond the 200-candidate scan remain unsupported; unknown aggregates and incomplete A–Z are honestly reported. Keep the feature off if unrestricted parity is required. Inspection also found no Dokploy Postgres backup schedules or destinations. Private index snapshots are intentionally absent because the index is reconstructable, but off-host Postgres backup/restore and external paging remain operational gaps. This preparation does not claim host-loss recovery or full production readiness.

## Historical release notes

[ADR 0010](adr/0010-private-spaces-search.md) contains the operational contract and rollout sequence. The feature defaults off. Apply the migration before deploying these write hooks, audit public/server credentials and public schemas, configure separate private keys, perform the initial rebuild, schedule and monitor the worker, assign retention/pruning ownership, verify proxy/CDN/logging settings, and measure on the actual VPS before enabling it.

Fresh historical migration replay is blocked by the pre-existing `20261018_174136_drop_about_page` data migration reading current schema before `site_settings_rels` exists. The harness initializes current Payload schema, then runs this feature's real migration. It does not claim to validate the complete historical migration chain or a production deployment upgrade.

MinIO's registry refused new image pulls during verification. The harness successfully used the pinned cached image digest already available locally. Another host needs that image preloaded or an available compatible image through `SEARCH_TEST_S3_IMAGE`.

Not run: production/VPS load testing, representative Arabic relevance review, an HTTP browser walkthrough, a production build, a full application integration suite, OS process-kill testing, engine-process failure testing, or actual CDN/shared-proxy configuration tests. A real writer database connection was terminated during an in-flight import; that stronger stale-writer case was exercised, but it is not described as an OS process-kill test. Previously downloaded content cannot be recalled after revocation. Offset pagination during live mutations is best effort. Unknown engine outcomes require an explicit generation recovery rebuild.
