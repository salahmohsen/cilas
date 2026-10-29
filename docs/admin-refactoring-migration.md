# Admin refactoring: migration and validation

## Delivered in the first stage

- Single-date event timing under When, independent of the optional Agenda. A film screening needs no agenda row or second title. Repeating events remain supported; older API/import callers sending weekly slots select recurrence automatically.
- Native unnamed tabs for Courses, Events, Programmes, Articles, Publications, People, Newsletters and Site Settings. Existing field names, relationships and localized storage paths remain intact.
- Task groups in the sidebar, persistent Reviews/Subscribers links, course list columns, and an effective registration/pricing summary using the selected cycle and live course overrides.
- Registration destination checks when configuration changes or content is published/submitted, with course inheritance and incomplete draft support. Historical invalid settings do not require a destructive data rewrite.
- Admin-only Site Settings API reads/writes. Public rendering uses the existing trusted server-side settings reads.
- Newsletter issue date defaults for new issues; explicit archive dates remain valid.
- Duplicating reviewed content starts a fresh draft instead of accidentally reapproving the copy.

The next slices are also implemented: events now have drafts and an admin-only live preview, and programme highlights/testimonials move into the overview editor as native lists/quotes/person mentions. The old programme fields are hidden; their tables remain for compatibility, and original values are archived before moving. The EGP-only currency selector is hidden while its stored value/default remains intact.

Event registration operations, roster assignment, durable acceptance-email retries, and retirement of other editorial fields remain later plan stages. No claim is made that every workflow gap from the audit has been closed.

## Registered migration

`20261029_034244_event_single_timing` adds `events.schedule_mode`, `schedule_start_time`, and `schedule_end_time`.

Every existing row first receives recurring mode, preserving legacy behavior. Exact-day records with one valid weekly occurrence then receive that occurrence's actual Cairo day and time in single mode. The migration accounts for a weekday falling after the stored pattern start date. Repeating, uncertain, date-only and agenda-only records retain their legacy representations. Existing agenda and slot rows remain during upgrade; no email, Space-creation hook, or external service is invoked.

Single events require a complete valid time range if a time is entered. Both times may be absent for a date-only archive entry. Recurring course timing is unchanged.

The down migration materializes each single event as one legacy weekly slot before removing the new columns. This includes events created after upgrading. It replaces inactive legacy slots on single records with the current canonical occurrence; occurrence parity is preserved, rather than promising the same internal slot IDs. Date-only single events stay date-only.

## Rehearsal evidence

An isolated `cilas_admin_refactor` database was restored from the existing local `cilas_dev` dataset. The shared local database was read for the snapshot and was not migrated by this work.

The rehearsal script checked every one of its 13 events before/after upgrade: ordered meeting occurrences, computed event timing, event-level non-schedule data, localized event data, and agenda rows. It also inserted a new single screening, verified rollback retained its occurrence, and verified re-upgrade parity. All checks passed. Five existing events converted to single mode; eight retained recurring/legacy mode. The registered `pnpm db:migrate` command then succeeded on the disposable restore.

Run the rehearsal against a pre-upgrade isolated local restore named `cilas_admin_refactor`:

```sh
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_admin_refactor \
  NODE_OPTIONS=--conditions=production \
  pnpm exec tsx scripts/verify-event-timing-migration.ts
```

The script rejects non-local hosts and other database names. It runs upgrade, rollback and re-upgrade inside a transaction and rolls the rehearsal back. It requires a pre-upgrade schema; it is not a general-purpose down command on an already upgraded database. It does not need the application or storage credentials.

Payload's schema generator reported no additional schema changes after native tab/navigation reorganization. Those layout changes require no content migration. New UI fields are nonpersistent.

## Event drafts migration

`20261029_075239_event_drafts` adds Payload event versions and draft status. Existing events are explicitly marked published while preserving their audience tiers, so owner-only records stay private. Initial versions are backfilled through the database adapter using the complete document in all languages; document hooks, emails and Space creation are bypassed.

All 13 restored events passed a comparison of their base record against their initial version, including localized content and nested arrays. The adapter's absent localized values are normalized only between undefined and null for comparison. Each initial version is marked latest and appears in the admin. Draft edits preserve the published public event, and anonymous/member requests cannot read draft previews or version history.

The preview at `/[locale]/events/preview/[id]` checks the current request's admin account, reads with access control enforced, uses the same event renderer, refreshes on save, and sends noindex metadata. It does not add per-request authentication to the public event page or depend on a draft cookie to authorize access.

On downgrade, all event version tables are archived as JSON in `cilas_migration_archive.event_versions_20261029` before being removed. A pending edit to a published event remains in that archive. Downgrade refuses if a base event is unpublished, preventing an older application from exposing a public-tier draft. Restoring archived version history after a downgrade requires an explicit recovery procedure; re-running up creates initial versions from current base records, not a reconstruction of the archived history.

After applying the migration to an isolated restore, verify it with the app's local environment and:

```sh
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_admin_refactor \
  NODE_OPTIONS=--conditions=production \
  pnpm exec tsx scripts/verify-event-draft-migration.ts
```

The rollback rehearsal is transactional and does not retain its test edit or archive. `--apply-to-checks` is restricted to the separate schema-only `cilas_admin_checks` database and applies only this migration for the test harness; it is not a replacement for the production migration ledger.

## Programme editorial migration

`20261029_081500_programme_editorial` moves programme highlights and every testimonial into `overview`, for both current documents and saved versions. Existing overview nodes remain in order; highlights become a list before them and testimonials become quotes after them. Person references use existing inline mentions. An association without a public attribution is retained on the quote wording rather than inventing a person's public name. Only visible-person names may supply a missing public credit.

The migration preserves missing Arabic content when the complete section previously fell back to English. If an Arabic section already has its own content, the old per-field fallback text is included so collapsing several fields into one does not silently drop what readers previously saw. Original locale-specific values remain in the backup for recovery; this is not a claim that fallback English has been translated.

Before writing, it stores each full source document/version and the converted overview in `cilas_migration_archive.programme_editorial_20261029`. It then clears the old highlight/testimonial arrays, so the old frontend does not render duplicate sections during cutover. The old tables remain and the arrays can be restored by down. Raw adapter writes include every localized field and preserve version timestamps/flags; they do not run application hooks. Base/version tables are locked against writes while conversion runs.

Retries recognize the archived original and migrated states. Rollback restores the original overview and rows only when the migrated editorial fields have not changed; it refuses to overwrite newer work. Re-upgrade after rollback is supported. Backups remain retained outside Payload's public schema.

The local restored dataset contained 11 programmes and 70 saved versions, with no legacy highlight/testimonial content requiring conversion. Therefore, real content conversion was exercised with synthetic English/Arabic documents and multiple published/draft versions, rather than claiming the empty local fields proved migration correctness. The integration test compares all other document and version fields, tests repeated up, down and re-upgrade, and verifies the newer-edit guard. Renderer tests verify the migrated list and every quote/citation appear using the existing rich-text renderer.

Before production cutover, pause programme editorial edits through migration, build and traffic switch: an older admin form can otherwise write new legacy-array values after the migration finishes. Inspect the archived source/current state before any retry after concurrent edits. No production write freeze has been enabled by this work.

## Production rollout

This branch has not been deployed. These checks used a local snapshot whose freshness relative to production is unknown. A current production export has not been inspected or migrated.

Before rollout:

1. Check the production migration ledger against the expected predecessor, `20261028_120000_private_search`, and inspect for schema drift. Back up the database and retain the matching application artifact.
2. Restore a current production export into an isolated local database and run the rehearsal above. Investigate any mismatch before release. Run both event verification scripts and the editorial migration regression tests; inspect any real legacy programme rows in that fresh export before rollout.
3. Deploy through the normal Docker build, which already runs `pnpm db:migrate` before `next build` because prerendering requires the new schema. This changes the database before traffic switches: the additive migration keeps legacy slots usable by the previous application during that interval. Use the deployment's existing environment; do not run migrations from a mismatched checkout.
4. Confirm the new migration ledger entry, unchanged event IDs/content, converted schedule counts, sample single/recurring/agenda-only records, EN/AR output, calendars, structured data, registration destinations, and Site Settings access.
5. Verify application health and invalidate cached event/calendar output as needed. The schema migration does not fire document revalidation hooks.

For rollback, run the registered down migrations in reverse order while this code's migration files are still available, then restore the prior application artifact. Respect the editorial newer-edit guard and the unpublished-event guard; resolve those states or recover from a validated snapshot rather than bypassing them. Verify occurrence parity and calendar output. If the down migration fails, retain the database state and use the validated snapshot/artifact recovery procedure; do not drop timing columns manually.

The historical fresh-database migration chain is separate from this upgrade test. This work does not establish fresh-install replay correctness.

## Build result and remaining content warnings

The production build succeeded on Node 22 against the isolated migrated dataset, including all 693 generated pages and the protected event-preview route. It logged Lexical registered-node errors for `block`/`inlineBlock` while processing some restored content. The same messages appeared in the earlier build before the event-draft/editorial slices; no document-by-document rendering claim is made. Investigating those content/export warnings and browser verification remain separate from passing migration parity and automated tests.

## Verification boundary

Integration tests run against a separate empty copy of the migrated schema, `cilas_admin_checks`, so test fixtures do not alter the restored snapshot. They cover event time without agenda, partial-time rejection, legacy API recurrence, registration validation, settings access, unassigned draft proposals, publication readiness, application acceptance, and existing publishing flows.

Validation: the combined Node 22 run passed 898 tests across 122 files, including nine admin/API tests, six application-flow tests, 17 publishing tests and the editorial migration integration test. TypeScript, scoped ESLint and diff whitespace checks passed. The Node 26 unit run had six composer failures caused by its different global localStorage behavior; those tests passed on Node 22 without application changes.

No browser verification, production migration, public deployment, commit, or push was performed.
