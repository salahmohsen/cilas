# Private Spaces search operations

Private search is prepared behind two switches. This document does not authorize merging PR #8 or enabling production search. The live application must remain on `main` until the rollout is approved.

## Deployment choice

The CILAS Dokploy production environment already contains the web Application, its Postgres service and a Typesense Compose service. A Dokploy project groups services in the dashboard. It does not put them in one Docker Compose stack or automatically give them an exclusive network.

Keep the web Application's Dockerfile deployment and existing Postgres service. Add `typesense-private` to the existing Typesense Compose service, alongside the unchanged public `typesense` service. The reviewed configuration is [deploy/typesense.dokploy.yml](../deploy/typesense.dokploy.yml). Dokploy must set `typesense-private` to detach from `dokploy-network`; its explicit `cilas-search` network remains attached. The public service retains its existing Dokploy domain configuration.

This gives CILAS one operational project and one search Compose deployment without coupling app builds to search restarts. Separate engines are deliberate. The existing public Typesense 29 engine fails the private curation API contract exercised by the Typesense 30.2 tests. Upgrading that engine in place would add an avoidable public-search interruption and data-format rollback risk. The new private engine has its own empty volume and no public listener, host port or domain. The public engine was subsequently upgraded independently to 30.2 using a verified clone, while preserving its original 29.0 volume and snapshot. See [the public upgrade record](public-typesense-upgrade.md). The two services retain separate data volumes, networks and keys.

| Component      | Endpoint and storage                                                  | Deployment behavior                                                                   |
| -------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Web + Payload  | Existing Dokploy Application and Postgres                             | Existing Dockerfile, migration and main-branch deployment                             |
| Public search  | Typesense 30.2, `typesense-public-data`                               | Existing browser domain and collection-scoped credentials                             |
| Private search | Typesense 30.2, `cilas-private-search:8108`, `typesense-private-data` | Dedicated internal attachable overlay `cilas-search`; 1 GiB RAM, 1 CPU, 256 processes |
| Worker         | Runs inside the current web container                                 | Packaged `maintenance/run.mjs`; no source checkout, pnpm install or web listener      |

The production volume names retain Dokploy's Compose project prefix. Do not change `appName`, `COMPOSE_PROJECT_NAME`, volume names, `isolatedDeploymentsVolume` or request fresh volumes. No Postgres stack move is needed. The public engine upgrade uses a separately verified external volume; its original `typesense-data` volume remains retained for rollback.

## Credentials and release checks

The browser key must have only `documents:search` on `^(courses|articles|people)(_[0-9a-f]{8})?$`. The public indexer key is separate, with public collection/document/alias operations and the existing indexer's named legacy cleanup collections. Neither key can manage keys or operate on private collections. The bootstrap key stays in the Typesense service's private environment, never the app or a browser build.

Dokploy stores explicit build arguments separately from runtime environment. Updating only `env` leaves old `NEXT_PUBLIC_*` values embedded in browser JavaScript. Update the intended public browser and indexer key entries in both places, preserving every unrelated setting. Rebuild current main, verify the running JavaScript contains the replacement, verify public search with that replacement, then revoke the old wildcard browser key. Old open tabs need a refresh after revocation. Keeping the old wildcard key usable is not a completed rotation, even with a separate private engine.

On the private engine, provision two server keys. Read needs `documents:search` on `^spaces_search_[a-f0-9]{32}$`. Write needs `collections:*`, `documents:import`, `documents:delete`, `aliases:*` on `^spaces_search(_[a-f0-9]{32})?$`. Bootstrap uses explicit generated values already securely stored in Dokploy. [deploy/bootstrap-private-search.mjs](../deploy/bootstrap-private-search.mjs) is an idempotent operator script for the Dokploy container, which has Docker access. It sends credentials to engine-local HTTP over Docker stdin and prints only sanitized checks. Do not log raw requests, responses, engine import errors or `docker inspect` environment output.

Set these server runtime variables, with secret values in Dokploy only:

```dotenv
PRIVATE_SPACES_SEARCH=false
PRIVATE_SPACES_SEARCH_KEYS_VERIFIED=false
TYPESENSE_PRIVATE_HOST=cilas-private-search
TYPESENSE_PRIVATE_PORT=8108
TYPESENSE_PRIVATE_PROTOCOL=http
TYPESENSE_PRIVATE_SEARCH_KEY=<restricted read key>
TYPESENSE_PRIVATE_WRITE_KEY=<restricted write key>
```

`PRIVATE_SPACES_SEARCH_KEYS_VERIFIED=true` is an operator attestation that retired wildcard credentials are revoked and the credential/network audit passed. Both flags are required for the endpoint. Maintenance writes also require the attestation, a healthy private engine and explicit 401/403 denials for the active browser key against private search/export/key operations. A timeout, 404 or engine failure does not count as a denial. Use the private engine's separate server address; keep public indexing and InstantSearch on their original endpoint.

## Approved rollout sequence

1. Review and merge PR #8 only with rollout authority. Keep the feature off. Dokploy continues deploying `main`. The Dockerfile runs `pnpm db:migrate` before `next build`, with the existing `--conditions=production` loader workaround. Confirm `20261028_120000_private_search` applied and the exact merged SHA successfully deployed. The outbox hooks need these tables even with the feature disabled. Do not run the migration against a fresh/reset production database.
2. Confirm private engine health, persistence, network isolation, disabled search/access/slow-query logging, resource limits and separate credentials. Confirm the old browser wildcard key is revoked. The server's public schemas must contain no references to private collections.
3. Set the key attestation true, preserving the environment and build settings. Refresh the runtime environment through a deployment of the approved main head. Do not add either private key to build arguments or `NEXT_PUBLIC_*`.
4. In that deployed web container, run `node --conditions=production /app/maintenance/run.mjs rebuild`. Require a zero exit and a published generation. Then run `status` and `work`. These commands use the packaged dependencies built in Linux by the Dockerfile, not the developer's node_modules.
5. Enable the prepared Dokploy application worker and health schedules. Worker runs every minute, processes at most 100 events and refuses overlapping writers. Health runs every five minutes and reports only pending count, maximum attempts, oldest age, initialization and recovery state. It exits nonzero for no generation, an abandoned writer token without its advisory lock, at least five attempts or queue age over five minutes. Worker exits nonzero on failed events or uncertain writes. Dokploy retains scheduled execution status/logs; external paging is not configured by these jobs.
6. Verify an authenticated request across disjoint accounts and intro gates on the actual deployment, an unauthenticated 401, permission changes, no-store headers, and absence of query/body logging or shared caching through the actual proxy/CDN. Measure queue drain and request latency on the VPS with synthetic/consented fixtures. The existing global shared rate bucket intentionally permits at most 180 requests/minute until a trusted proxy address contract is installed.
7. Enable `PRIVATE_SPACES_SEARCH=true` only when those checks pass and the operating limits below are accepted. Confirm the final deployment head, status, runtime flags and worker run. Saving an environment setting is not proof it reached the running container.

Prepared schedules are `Private Spaces search worker`, `Private Spaces search health` and `Private Spaces search generation retention`. All remain disabled before rollout. Retention is staged for Sunday 03:30 UTC; it removes every superseded private generation under writer coordination and keeps the active one. Enable it only after approving that retention behavior. Never prune the public indexes. Manual credential/bootstrap/network audit jobs are also disabled and have no recurring production effect.

## Persistence, recovery and retention

The private engine has a separate durable Docker volume. It is a derived index; Postgres content, transactional outbox and generation state are authoritative. Loss of the private volume requires a new-generation rebuild. Do not restore an old engine snapshot over current state or manually erase a writer token. A retained token/unknown write outcome requires stopping superseded maintenance processes and explicitly rebuilding into a unique generation. Verify status and catch-up, then prune superseded generations under approved retention.

Private engine snapshots/backups are deliberately not scheduled. They would retain additional copies of deleted member text; the index can be reconstructed from Postgres. Its Docker logs rotate at 10 MiB × 3 and query/access/slow-request logging stays off. Superseded indexes retain private text until pruned. Do not enable analytics rules or shared query caches for this engine.

The live inspection found no Dokploy database backup schedules or destinations. A durable local volume is not an off-host backup. Establish and test the project's private Postgres backup/restore policy separately before claiming host-loss recovery. Do not repurpose the public media bucket for full database backups. This run did not create an external destination, copy database contents, reset a database or move the database service.

Rollback before activation is disabling the two feature flags and worker/health/retention schedules. Leave volumes, source data, migration tables and queued events intact. Public search remains on its original engine. After activation, disabling private reads does not stop outbox hooks; preserve the migration and queue for recovery. Do not switch the private server back to the public engine or reuse its bootstrap key in the app.

## Specific remaining product limits

Safety budgets remain 200 candidates per row-page and aggregate pass, 20 returned rows, a 3-second work deadline and a 10,000 cursor-offset ceiling. Exact aggregates appear only when the entire validated scan completes. A query or browse matching more than the aggregate budget has unknown counts. Global A–Z returns an incomplete state, with no misleading partially sorted rows, when the whole match set cannot be scanned within budget. Sparse selected-space results can also exhaust the row scan before finding a complete page.

These limits do **not** provide unrestricted 100% public-search parity. Raising/removing the bounds would expose unbounded Payload work on every keystroke. If exhaustive large-corpus counts and A–Z are a release requirement, keep the feature off and implement a separately measured strategy, such as a permission-bound asynchronous scan with live validation, or an indexed global sort plus a bounded independently validated aggregate workflow. That work must define mutation/cursor consistency and count freshness. This preparation does not label incomplete metadata as zero or claim those requirements are solved.
