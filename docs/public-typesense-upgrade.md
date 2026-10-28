# Public Typesense 30.2 upgrade

The public engine is upgraded separately from private search. Version 30.2 contains fixes for scoped-key cache behavior, search concurrency, filtering and highlighting. Its main compatibility changes concern synonyms, overrides/curations and analytics rules. The live public engine had none of those resources configured.

Sources: [30.2 release notes](https://github.com/typesense/typesense/releases/tag/v30.2), [behavior changes](https://typesense.org/docs/30.2/api/#deprecations-behavior-changes), [upgrade guidance](https://typesense.org/docs/guide/updating-typesense.html).

## Migration and verification

`deploy/upgrade-public-typesense.mjs` runs inside the Dokploy container with Docker access. It captures credentials only in memory and sends engine HTTP requests over Docker stdin. Its output contains metadata, counts and checks, never keys, queries or document text. The operator job is manual and disabled for recurring execution.

1. `prepare` pulls 30.2, verifies there are no legacy rules requiring migration, creates a native snapshot under `/data/public-upgrade-302-snapshot` on the original public volume, copies it to the new `cilas-typesense-public-302-data` volume, and starts an isolated canary with `--network none`. The original engine keeps serving traffic.
2. `sync` replays the current public document export into the canary using the actual restricted public indexer credential. Each imported row must succeed. Snapshot startup exposed one character difference in an Arabic article body; replaying the public API export preserved the existing API-visible field exactly. No original document or Payload record was changed. All 582 exported documents then matched in full.
3. `verify` compares full exported document hashes, field schemas, key metadata, aliases and 35 searches across all three collections. It covers English/Arabic queries, newest and both alphabetical sorts, course-type filters, facets and multi-search. It also checks real collection creation, import, export, deletion and alias operations with the existing restricted indexer key, and search with the existing browser key. Synthetic write fixtures are confined to the canary and removed there. Public administration/private access denial remains enforced.
4. Schema comparison explicitly supplies the documented `truncate_len: 100` default on both versions. Version 30.2 exposes that field in schema responses; 29.0 omits it. Other schema changes or document differences fail verification.
5. `release` checks that the serving source still matches the verified baseline and stops the canary so only one process will mount its volume for writes.
6. Update only the public service's image and data mount in Dokploy Compose, then deploy without fresh volumes. Both public domains still target `typesense:8108`. The private service configuration and credentials remain unchanged.
7. `postcheck` verifies the actual serving container version, new volume, full data/key/alias parity and all 35 searches again. Separately verify the externally exposed public search endpoint and public site.

Snapshot counts were 301 courses, 265 people and 16 articles. The checks exercise the current corpus and sampled searches; they are not a guarantee for every possible query or a capacity benchmark. The single-node public service briefly restarts at cutover; this is not a zero-downtime cluster upgrade.

## Persistence and rollback

- New serving volume: `cilas-typesense-public-302-data`, explicitly external in Compose so its name is independent of deployment suffixes.
- Original rollback volume: `cilas-typesense-hvbtzv_typesense-data`. It is retained intact and remains declared under `typesense-data` in Compose.
- Consistent pre-upgrade snapshot: `/data/public-upgrade-302-snapshot` inside the original volume.
- Canary: `cilas-public-typesense-302-canary`, stopped before cutover, with no network or published ports.

For rollback, change only the public service back to `typesense/typesense:29.0` and its original `typesense-data:/data` mount, then redeploy and verify public searches. Never mount the migrated 30.2 volume into 29.0 for this rollback. Keep the current private service definition and environment unchanged. Account for public edits made after cutover by reconciling from Payload after rollback; do not overwrite Payload data from an index snapshot.

No old volume, collection or source data is deleted by this upgrade. Snapshot retention and deletion require a separate reviewed maintenance decision. Private Spaces search remains disabled, and the public upgrade does not authorize its activation.

## Live result

Verified on 2026-10-28. Dokploy Compose deployment `Dj8f3E8_jzQNKjjdGvKQ3` completed with status `done`. The serving public engine reports 30.2 and mounts the verified external volume. Post-cutover operator verification `_TfGeqbD8X9S8CFBIOtkX` passed full document/key/alias parity, the 35 search comparisons and denial checks. External public search and CORS checks passed for courses, people and articles; the site returned HTTP 200. The existing private engine retained its running container and remained healthy. Private search stayed disabled. No CILAS/Payload application or SDK change was needed for this engine upgrade.
