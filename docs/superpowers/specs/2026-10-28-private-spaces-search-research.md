# Private Spaces search with Typesense

Date: 2026-10-28. Status: research and proposed design, not an implemented feature.

## Recommendation

Use Typesense as a private candidate index behind an authenticated CILAS endpoint. Compute authorization from Postgres on each request, filter the index, then validate and hydrate candidates through Payload before returning anything. Keep the existing public search separate at the credential and collection boundaries. A single search panel can present both kinds of results.

This recommendation assumes fewer than 1,000 community members, not 1,000 simultaneous searches. There is no measured capacity or latency result yet. No production service, database, key, or deployment was accessed during this research.

The original [Spaces specification](2026-10-21-spaces-design.md) explicitly chose Postgres `pg_trgm` and excluded Typesense. This document proposes revisiting that choice for typo-tolerant search across accessible spaces. It does not supersede the specification. Postgres remains a sensible alternative if the requirement is only search inside one space and minimizing operational complexity is more important than sharing the public search engine.

## Evidence and version boundaries

Research used Context7 library resolution and two targeted Typesense documentation queries, followed by official API pages. Payload was separately resolved and queried through Context7. Broad Context7 results omitted some important details, so they were checked against primary documentation and installed source.

The API references below describe Typesense 30.2. The running Typesense server version is not established. Installed packages are Typesense JS 3.1.1 and Payload 3.91.0. Before implementation, pin a supported server version and repeat the security contract tests against that exact server and SDK combination.

Relevant current code:

- [Spaces access](../../../src/lib/spaces.ts): membership derives from enrollments, teaching, programme membership, audience, and the Off/Trial/On switch. `readableSpaceIds`, `introGates`, and `contentWhere` are the access entry points.
- [Introduction rules](../../../src/lib/space-intro.ts): ordinary course/cohort members initially see only the introduction thread; moderators bypass the gate.
- [Post collection](../../../src/collections/SpacePosts.ts) and [comment collection](../../../src/collections/SpaceComments.ts): collection reads use `contentWhere`.
- [Read models](../../../src/lib/spaces-data.ts) and [writes](../../../src/lib/spaces-write.ts): deleted content can leave tombstones. A surviving database row is not sufficient evidence that its old text may be shown.
- [Private files decision](../../adr/0008-space-files-are-private.md): attachments are protected, unlike public media.
- [Public index plugin](../../../src/plugins/typesense/index.ts), [indexer](../../../src/plugins/typesense/indexer.ts), and [client configuration](../../../src/env.ts): current indexing covers anonymous-readable courses, articles, and people. Browser-key scope is documented in code, but deployed keys were not inspected.

## Security contracts

1. Search never grants read access. The authenticated Payload reader and current database state determine visibility.
2. A selected space narrows the user's allowed set; it never replaces the authorization predicate. Unauthenticated and empty-access states stop before querying the private index.
3. Return only items currently readable under the same rules used to display them. Preserve introduction gates and the existing administrator behavior. Do not silently treat an administrator's unrestricted space access as permission to display deleted text.
4. Public credentials cannot search private aliases or physical generations. Private search credentials remain server-side. Give indexing and rebuild workers distinct permissions from the read endpoint.
5. Do not forward arbitrary Typesense parameters, collection names, API keys, filter expressions, JOINs, presets, pinned hits, or multi-search bodies from a browser. Accept only a bounded query, a validated space selection, approved sort, and a protected pagination token.
6. Responses, errors, logs, counts, dropdowns, and suggestions must follow the same privacy boundary as result text. Never fall back to an unrestricted query after authorization or index errors.

Typesense supports collection/action restrictions and scoped filters that clients cannot override. Parent-key revocation invalidates derived scoped keys; scoped expiration is supported. Its API-key documentation also warns that JOINs can expose referenced collections. These are engine mechanisms, not an implementation of CILAS membership rules. [API keys](https://typesense.org/docs/30.2/api/api-keys.html)

### A search-default trap

Curated hits are not filtered by default. For private queries, set `filter_curated_hits: true`, disable curations, and reject browser-supplied promotions. Query fields can produce highlights unless disabled; return candidate metadata only and turn off both snippet and full-field highlighting. Use a response allowlist rather than forwarding Typesense JSON. [Search API](https://typesense.org/docs/30.2/api/search.html)

The public collections should have no schema references to private collections. Test public credentials against private physical names, aliases, and crafted JOIN queries, not just the normal public UI.

## Proposed data shape

Use one private alias, `spaces_search`, containing one record per post or comment. This avoids duplicating content per member and gives one private ranking/pagination stream. Keep it outside public `SEARCH_COLLECTIONS`.

| Field | Proposed shape | Purpose |
| --- | --- | --- |
| `id` | `post:42` or `comment:83` | Collision-free index identity |
| `sourceId` | indexed `int64` | Payload row lookup |
| `kind` | indexed string enum | Post/comment discriminator |
| `spaceId` | indexed `int64` | Authorization and space selection |
| `postId` | indexed `int64`, also on posts | Introduction-thread filtering |
| `title` | optional indexed string | The item's own title, if any |
| `body` | indexed string | Normalized searchable text |
| `updatedAt` | sortable numeric timestamp | Newest ordering |
| `sourceRevision` | stored string, unindexed | Compare indexed text with current source |

Use an explicit schema. Enable facets only for actual product requirements, and avoid indexing author identities, membership arrays, email, phone, voter identities, attachment contents, or attachment URLs. Filtering requires indexed fields; faceting and indexing are distinct settings. Language tokenization is configurable. [Collections API](https://typesense.org/docs/30.2/api/collections.html)

Search body text in its written language, including mixed Arabic/English. Do not invent translations or duplicate a comment's entire parent post. Display labels and author names should come from current authorized Payload reads. Adding searchable author names later needs a separate identity-visibility review.

`sourceRevision` should fingerprint the canonical searchable projection and its transformation version. A strict persisted revision incremented on every relevant mutation is another option, but `updatedAt` alone is not a sufficient content identity contract. Include all text and metadata that affects search visibility or matching. A revision proves equality with the current projection; it does not replace live authorization.

## Proposed request behavior

1. Authenticate through the existing `currentReader` path. Check session/account validity and fresh role behavior against the installed Payload version, especially demotion of an administrator. Do not assume a long-lived token refreshes every authorization field.
2. Compute the permission envelope once for the request. Keep membership memoization request-scoped. React render caching is not evidence of cross-call memoization inside every API handler.
3. Load dropdown choices from authorized Spaces data. Validate any selected numeric ID against the current allowed set. Return a consistent inaccessible response for nonexistent and unauthorized spaces.
4. Compile an explicit Typesense predicate from server-owned numeric IDs. Conceptually, allow fully opened spaces OR the specific introduction thread in each gated space. Bind intro post IDs to their own space IDs. AND the entire predicate with the selected space, if present. Empty sets must produce denial, never an omitted filter.
5. Request only candidate IDs, routing metadata, and revision. No browser-provided collection, filters, JOINs, or per-search credentials are accepted.
6. Batch-load candidate posts and comments through Payload with the authenticated user and explicit `overrideAccess: false`. Also validate current parent/space relationships and live display state. Build response content and snippets from current database text only.
7. Drop candidates whose indexed revision differs from the current projection. This prevents an edited-away phrase from continuing to surface an item merely because the old index matches it. False negatives during synchronization are preferable to stale disclosure.
8. Return only approved result fields and server-built local links. Render snippets as escaped text/token spans. Send `Cache-Control: private, no-store`; exclude the route from CDN, service-worker, browser search-adapter, and shared application caches. Clear client private results on logout, account switch, and permission errors.

Payload requires explicit access enforcement for user-facing Local API calls. Context7 returned conflicting statements about defaults; installed Payload 3.91.0 `dist/collections/operations/local/find.js` defaults `overrideAccess` to `true`. Therefore the design explicitly sets it to `false` and passes the authenticated user. [Payload Local API access](https://payloadcms.com/docs/local-api/access-control)

The authorization guarantee is evaluated at server validation time. A request already in flight can overlap a permission change, and previously downloaded content cannot be recalled. If stronger concurrent-revocation semantics are required, add an authorization-version check immediately before responding and define that boundary in tests. Do not claim instantaneous revocation of already disclosed content.

### Tombstones and comments

The feed excludes deleted posts, while comment rendering preserves some reply structures. Initially exclude deleted items. Do not return an old deleted post body as a comment's title/snippet. Decide explicitly whether live replies under a deleted post remain searchable; the conservative initial choice is to exclude that thread until its search/display semantics are specified. A deleted parent comment should not automatically hide a live child reply if the normal thread still permits reading it.

Future reply-first, hidden-content, anonymity, or moderation features described in the older spec must be distinguished from implemented rules. Add them to the common read policy before allowing search to expose their fields. Files remain outside full-text extraction in the first version.

### Pagination and metadata

Do not expose raw `found`, `out_of`, facets, timings, or suggestion data as authoritative private results. Post-validation can remove stale candidates, so raw totals describe a different set. Start with no exact totals or per-space match counts. Populate the dropdown from permissions, not unvalidated facets.

Fetch candidates in bounded batches, validate in bulk, and refill until a page plus one validated result is available or a work budget is exhausted. Set `hasMore` only after finding an additional validated result. Preserve scan state in a server-held or authenticated opaque cursor bound to user, query, selected space, sort, generation, and permission fingerprint. Permission/generation changes restart pagination. Offset pagination under concurrent indexing is best effort, not a stable database snapshot.

If a budget is exhausted, report incomplete search rather than a definitive empty result. Do not scan the whole private corpus to compute a total. This design limits content and metadata disclosure; it is not a proof against every timing or corpus-level inference side channel.

## Index synchronization and rebuilds

Use a durable database-backed indexing queue/outbox. Enqueue identifiers in the same transaction as the content mutation, passing the hook request through nested database work. Perform Typesense writes only after commit, by a worker that re-reads current source state. Rollback should leave no externally indexed document. Payload's queue is a possible implementation, not a verified delivery guarantee for this feature. Its installed `queues/localAPI.js` accepts and forwards `req`; transactional behavior, retries, worker claims, and crash recovery still need integration tests. [Transactions](https://payloadcms.com/docs/database/transactions), [Jobs Queue](https://payloadcms.com/docs/jobs-queue/overview)

Serialize writes per item, or initially through one coordinated writer, including across restarts/deployments. Merely re-reading before each write does not stop an older delayed write from overwriting a newer one. Full-document upserts, idempotent deletion, retry backoff, failure inspection, and reconciliation are required. Parent changes/deletion must also enqueue affected descendants when their search projection or visibility depends on that parent.

The bulk import endpoint can report HTTP 200 with per-document failures. Installed Typesense JS 3.1.1 array imports already throw `ImportError` by default for failed rows; the existing indexer uses this path. Do not incorrectly describe the current SDK call as silently accepting every partial failure. The remaining gap is durable retry/reconciliation and safe logging. Import errors can contain document content, so sanitize errors before logging. [Documents API](https://typesense.org/docs/30.2/api/documents.html)

Aliases route search and writes to a physical collection and support generation switching. They do not constitute a transaction spanning source data and both indexes. [Aliases API](https://typesense.org/docs/30.2/api/collection-alias.html)

For private rebuilds, use a unique generation per run, an exclusive rebuild/writer lease, and a durable change backlog retained from before scanning starts. Build the new generation, replay committed changes through a captured barrier, swap the alias under writer coordination, then direct remaining events to the new generation. Do not pause user writes; pause/coordinate the indexing consumer. Failed rebuilds must leave the current alias intact. Keep old generations only as long as required, with the same private ACLs. Prove concurrent edit/delete and crash recovery before enabling this path.

The current public indexer uses schema-hash generations and background startup rebuilds. Reusing that code unchanged would not prove these private consistency guarantees, especially when two servers rebuild or writes arrive during a schema change.

## Efficiency and operating envelope

Proposed initial controls, all subject to measurement:

- 20 visible results per page; candidate batches of 40; an overall scan cap of 200 candidates and a request deadline. These are engineering starting points, not capacity claims.
- Debounce typing by about 250 ms and cancel superseded requests. Reject oversized queries and unsupported sorts. Rate-limit by authenticated user with a secondary abuse limit.
- Batch hydration by collection, then batch parent/space checks. Avoid one database request per hit and unrestricted relationship expansion.
- Start without private Typesense query caching, match-count facets, wildcard browse, embeddings, attachment extraction, analytics, and query-history persistence.
- Keep Typesense on a private Docker network where practical; the public browser may still need a tightly scoped HTTPS search route for existing public search. Prevent access to administration/export routes with public credentials. CORS is not authorization.
- Tune Arabic diacritics, spelling variants, mixed-script names, prefix matching, and typo tolerance on representative consented or synthetic text. Compare quality with current public search without assuming its configuration is optimal for discussion content.
- Measure request p50/p95, database queries, candidate discard rate, queue age, failed jobs, RAM, and rebuild peaks. Record aggregates without logging private queries or bodies. Rebuilds need room for two index generations.

Typesense multi-search batches requests and also permits per-search keys. Keep any composition server-owned; do not create an unrestricted multi-search proxy. Initial public/private result groups can remain separately paginated. [Multi-search API](https://typesense.org/docs/30.2/api/federated-multi-search.html)

## Verification required before release

Use the exact pinned server and installed SDK, plus realistic Payload/Postgres integration. UI-only tests are insufficient.

| Scenario | Required observation |
| --- | --- |
| Signed out, expired session, account switch | No private result or retained client result |
| Two users with disjoint spaces | No cross-space content, labels, counts, or suggestions |
| Forged selected space or injected filter/multi-search body | Denied or rejected; no engine passthrough |
| Introduction gate, including comments | Only the introduction thread is searchable until the gate opens |
| Enrollment withdrawal, audience/Trial switch change, intro comment deletion | Next validated request follows current rules without waiting for reindex |
| Administrator role removal and linked-person change | Current authorization wins over stale token assumptions |
| Soft delete, hard delete, parent tombstone, live child reply | Same display semantics as the specified search policy; old text never returned |
| Edit while worker is unavailable | Revision mismatch suppresses stale matches, not merely stale snippets |
| Empty permission set and authorization errors | No query without its mandatory filter |
| Public key against alias, physical generation, JOIN, export, key APIs | All private access denied |
| Curated/pinned inaccessible hit and stored highlights | No bypass of filter or response allowlist |
| Partial bulk failure and malicious document content in errors | Correct retry; no private content in logs |
| Transaction rollback and worker crash | No uncommitted item indexed; committed work eventually reconciles |
| Delayed older write, duplicate job, concurrent rebuild and delete | Latest committed state converges without resurrection |
| Unauthorized/stale hits fill candidate pages | Correct refill; no false exact totals or unvalidated next-page flag |
| Shared caches, logout, CDN and reverse proxy | Private responses never served to another session |
| Arabic/English, empty input, long queries, repeated requests | Useful matching within bounded work and observed resource limits |

## Implementation sequence

1. Agree on the change from Postgres-only search, deleted-thread behavior, and the initial scope of posts/comments. Establish fixtures from the existing access rules.
2. Extract a shared read-policy representation with request-scoped reuse. Prove equivalence with current Payload access, including administrator and intro behavior.
3. Add private schema, key boundaries, durable indexing, and reconciliation. Verify rollback, failures, and ordering before exposing results.
4. Add the authenticated endpoint with candidate-only search, access/revision validation, safe pagination, rate limits, and cache controls.
5. Connect All my spaces and selected-space controls. Keep private API inputs narrow and result rendering escaped.
6. Run the matrix above, measure on the chosen VPS, then enable behind a feature switch. Do not estimate an exact user capacity from the member count alone.

No application code, credentials, runtime configuration, or existing design document was changed by this research.
