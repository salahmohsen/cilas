# CILAS admin refactoring implementation plan

**Goal:** Make daily admin work easier, starting with an event's own date/time independent of agenda entries, while preserving existing production content and behavior.

**Baseline:** `origin/main` merged by fast-forward on 29 October 2026, head `d85fab55`. The merge includes preview authorization fixes, Gallery/Related Content blocks, and email editor/converter improvements. Those audit findings are superseded; retain their regression tests.

**Architecture:** Keep Payload's existing collections and operational relationships. Use native groups, unnamed tabs, conditions, defaults, and joins for organization. Add event-specific single-occurrence timing to the existing schedule shape; preserve recurring schedules and optional agendas. Migrate presentation fields only after every consumer and localized/versioned representation is accounted for.

**Tech stack:** Payload 3.91, Postgres migrations, Lexical, Next.js, Vitest, existing Cairo date/time helpers.

**Execution:** Work sequentially in this checkout. No push, deployment, production writes, or automatic production migration is part of preparing this refactor. Deliver versioned migrations and rehearse them on an isolated restored database before production rollout. Do not discard the existing audit document.

**Throughput checkpoint:** Finish event timing with migration parity first; then admin organization; then validation and workflow changes; migrate editorial content in a separate verifiable phase. Avoid combining unrelated schema changes in one migration.

## Execution status

Implemented locally: single-date event timing and migration, native navigation/forms, effective course settings, registration destination checks, Site Settings access, newsletter issue-date default, and reviewed-content duplication safety. See [migration and validation notes](../../admin-refactoring-migration.md).

Verified: the combined Node 22 run passed 898 tests across 122 files; TypeScript and scoped lint; registered migration and transactional upgrade/down/re-upgrade parity on 13 restored local events. Production export freshness and browser behavior remain unverified. Event drafts/private preview and programme highlights/testimonials conversion are also implemented. Other workflow slices and editorial fields remain pending; see the migration notes for their exact boundaries.

## 1. Event timing: first implementation slice

### Intended admin behavior

A film screening has one event title, description/movie block, date, start time, and end time. It does not require an agenda, an agenda title, a weekday selector, or a number of weeks.

Under **When**, choose:

- **One date:** date + start/end time, in Cairo time. This is the default for new events.
- **Repeating:** existing start date, weeks, and weekly slots.

Keep **Agenda** optional, labeled as named segments such as introduction, screening, discussion. Keep titles required within a deliberately added agenda segment; do not make admins create one to supply the event's primary time. An empty agenda stays empty.

Date-only or incompletely dated archive events must remain representable. Complete timing is required when staff choose to supply a timed occurrence; do not invent an end time or midnight for historical records.

### Data shape and compatibility

Extend `events.schedule` additively with:

- `mode`: `single` or `recurring`.
- `start_time` and `end_time`: Cairo wall-clock `HH:mm`, used for single occurrences.
- Reuse `start_date` and `start_precision`.
- Retain `weeks`, `slots`, `note`, and computed `end_date` for compatibility and recurrence.

Course schedules keep their existing shape and authoring interface. Missing `mode` retains the legacy recurring behavior; the single-occurrence branch must activate only for explicit `mode: single`. Stored fields from the inactive timing mode must not generate additional meetings.

`expandSchedule` remains the authoritative occurrence function. A complete single event expands to exactly one meeting. The same meeting supplies event status, public cards, detail pages, calendar entries, email cards, and event structured data. Primary timing takes precedence over agenda-derived fallback times. Date-only archive fallback must remain intact.

Files:

- Modify `src/collections/Events.ts`: use event-specific schedule fields and separate optional Agenda.
- Modify `src/fields/schedule.ts`: accept an opt-in event configuration; keep course behavior unchanged.
- Modify `src/lib/schedule.ts`: additive schedule type and single-occurrence expansion.
- Inspect/update `src/lib/events.ts`, `src/api/calendar.api.ts`, `src/lib/schema.ts`, `src/components/events/public-event-card.tsx`, `src/app/(frontend)/[locale]/events/[slug]/page.tsx`, and `src/emails/cards.ts` where necessary to consume primary timing consistently.
- Regenerate `src/payload-types.ts`; regenerate the admin import map only if new components are introduced.
- Add a timestamped migration in `src/migrations/` and register it in `src/migrations/index.ts`.

Steps:

- [x] Restore dependencies with `pnpm install --frozen-lockfile`; read the applicable Next guides under `node_modules/next/dist/docs/` before changing routes or rendering behavior.
- [x] Add failing behavior tests in `tests/unit/schedule.unit.spec.ts` and `tests/unit/events.unit.spec.ts`: single event with no agenda, exact one-meeting expansion, correct upcoming/past boundary, Cairo timezone behavior, incomplete dates, legacy recurring schedules, and course regression coverage.
- [x] Implement the additive fields, validation and canonical expansion. Label single timing plainly; hide recurrence-only controls in single mode.
- [ ] Extend `tests/unit/calendar.unit.spec.ts`, `tests/unit/public-event-card.unit.spec.tsx`, and `tests/unit/schema.unit.spec.tsx` to prove that time appears without an agenda and matches across consumers. Include Arabic rendering and DST-sensitive dates.
- [x] Generate and inspect the migration. Do not accept generated DROP statements affecting existing content.
- [ ] Run focused tests, TypeScript, scoped lint and formatting checks.

### Existing event migration rules

Classify existing events using their original schedule expansion, not their title/type or assumed age:

1. **Exactly one existing meeting:** copy its actual expanded date and times to the single fields; set mode to single. Only normalize the date if it preserves the exact occurrence; a weekly slot may occur after `start_date`.
2. **Multiple meetings:** mode recurring; preserve every date/time and slot order.
3. **No expanded meetings, date-only/incomplete schedule:** preserve the record without filling fabricated times. Keep legacy fallback behavior.
4. **Agenda-only timing:** preserve the agenda and its localized titles. Do not infer that multiple named agenda segments constitute one simple screening. Report these separately; any conversion must be explicit and provably preserve start/end semantics.

Retain existing slots and agenda data during the first release. Migration execution must not send emails, create Spaces, or invoke unrelated hooks. SQL/data backfills must run transactionally and be safe to retry after a rollback. Document down-migration behavior for newly created single events: materialize their equivalent one-week/one-slot legacy schedule before dropping new columns, or declare and enforce a snapshot-based rollback. Do not supply a `down` that silently loses newly authored timing.

## 2. Admin organization without changing content storage

Files: `src/plugins/role-nav.ts`, `src/payload.config.ts`, primary collection configurations under `src/collections/`, `src/globals/SiteSettings.ts`, and existing admin views under `src/components/admin/`.

- [x] Group the sidebar by Admissions, Teaching, Publishing, Communications, Community, People, and Site. Keep super-admin Governance restrictions and existing hidden system collections.
- [x] Give Reviews and Subscribers persistent native navigation links. Keep collection API slugs stable.
- [x] Split Courses into Overview / Course flow / Schedule / Applications and pricing / Participants / Publishing. Apply equivalent focused tabs to Programmes, Events, Articles, Publications, and People.
- [ ] Use unnamed tabs and layout groups so existing data paths do not move. Add useful array labels and collapse completed rows.
- [ ] Add explicit course list columns: title, cycle, course type, review status, audience and publication state; use filters rather than oversized tables where space is limited.
- [ ] Show effective inherited registration/pricing values and links to the source cycle. Do not store duplicate effective values.
- [ ] Verify that the sanitized database schema is unchanged for this phase. Exercise each role's list and edit permissions through existing API tests; source review alone does not prove usability.

## 3. Requirements and publication readiness

Files: `src/fields/registration.ts`, `src/lib/registration.ts`, `src/globals/SiteSettings.ts`, `src/collections/Courses.ts`, `src/fields/pricing.ts`, `src/fields/bibliography.ts`, and affected collection hooks.

- [x] Restrict Site Settings updates explicitly to admins; define intentional read access. Add an API regression test for member/fellow writes.
- [x] Validate the effective form or external URL when its registration mode is selected, including course inheritance. Conditions in the admin are presentation only.
- [x] Verify existing draft behavior before relaxing `required`; add a publication/submission-readiness test proving that incomplete writing can be saved while operationally invalid content cannot be approved.
- [ ] Permit unassigned course proposals only after updating nullable cycle consumers and shipping the required database migration. Publication still needs a valid cycle/type.
- [ ] Default low-value classifications where safe; generate display labels for payment plans and programme components without rewriting meaningful existing labels.
- [ ] Keep ownership, tiers, roles, participation relationships, and valid configured timing rows protected. Keep content warnings discoverable.
- [ ] Treat decorative media as a separate accessibility change requiring rendering support, not a blanket removal of alt requirements.

## 4. Complete workflows in separate slices

- [ ] Event registration: preserve the event target in submissions and provide its own operational queue/attendance handling; do not turn it into a course enrollment. Review the event attendance component introduced by main before designing duplicate functionality.
- [x] Event drafts/preview: add versions and draft-aware access in a separate migration. Backfill existing event publication state explicitly; preserve existing public/community exposure and keep owner-only content private.
- [ ] Admissions email: persist delivery state and provide safe resend without repeating account, membership or enrollment creation.
- [ ] Programme participation: add intentional course assignment/roster actions and show resulting Space access. Do not automatically enroll everyone in every component.
- [ ] Split admissions, publishing reviews, and contact messages; bound and paginate queue reads and store true submission timestamps.

These require their own schema/test specifications before implementation. Existing programme kinds without public routes must not be presented as fully supported preview flows.

## 5. Editorial blocks and field retirement

Programme highlights and testimonials are now migrated into the overview editor, including saved versions, with retained source backups and rollback guards. Other fields in this section remain candidates; do not infer they were retired.

Files: relevant `src/blocks/` definitions, `src/lexical/default-features.ts`, `src/lexical/article-body.ts`, `src/blocks/columns.ts`, `src/components/RichTextField.tsx`, programme/course/place renderers, text/export converters, and timestamped migrations.

- [ ] Inventory live documents, drafts/versions, localized text and all consumers for programme highlights/testimonials/requirements, course participant notes, and place galleries.
- [ ] Reuse Gallery and existing block infrastructure from main. Use ordinary lists/headings where a special block adds no value.
- [ ] Specify deterministic insertion order and anchors for every field moved into rich text. Preserve both EN/AR content and intentional fallback/missing-language behavior.
- [ ] Backfill new content before switching reads. Prevent duplicate insertion on retries with stable migration markers/IDs; verify block references and media remain resolvable.
- [ ] Reconcile programme `cycles` against `components` before deriving it. Report disagreement instead of dropping intentional order or silently selecting one representation.
- [ ] Verify website, preview, email, search and text-export behavior. Main already added email palettes/converters: retain that compatibility and its preservation tests.
- [ ] Retire old fields only after full parity checks and a recoverable snapshot. Schedule destructive cleanup separately from the first compatible deployment.

## 6. Production migration proof and rollout requirements

- [ ] Inspect the actual deployed migration ledger and schema before choosing a starting point. Do not assume an empty-database migration replay is equivalent to production upgrade.
- [ ] Create an isolated restore of production data with appropriate private handling. Use an explicitly local `DATABASE_URL` pointing at the disposable database; never source production credentials into test commands.
- [ ] Record baseline IDs/counts, localized content presence, relationship references, event occurrences, tiers/statuses and publication state. Counts alone are insufficient.
- [ ] Run the exact registered production migration command: `pnpm db:migrate`, with the disposable database URL supplied explicitly. Confirm its migration ledger and resulting schema.
- [ ] Compare every migrated event's ordered occurrence tuples `(date, start_time, end_time)` before/after; compare date precision, agenda order/titles, and fallback status. Produce a failure report for every mismatch, not a sampled claim.
- [ ] Compare all migrated editorial text and media references by ID/language, including version/draft data where storage changes affect them. No silent truncation, empty replacement, or array reorder.
- [ ] Rehearse rollback, including content created after migration. Verify retries and failure recovery; keep backup columns/tables until cleanup is authorized and proven safe.
- [x] Run focused tests against the new schema, then `pnpm exec tsc --noEmit`, scoped ESLint/Prettier, `pnpm build`, and `git diff --check`. Run the appropriate integration tests on the disposable restore.
- [x] Prepare the deployment order and migration verification report with expected ledger entries, parity results, unresolved records, rollback instructions, and required revalidation/index updates.

Do not call production data migrated until the production migration actually runs and its verification succeeds. Preparing and rehearsing migrations does not authorize deployment. A historical migration replay failure must be reported separately from the current upgrade result and investigated before claiming fresh-install support.

## Completion criteria for the first slice

- Film screening entered as one date/time range with no agenda rows and no extra title.
- Time agrees on the event card, event page, calendar, upcoming/past ordering, email card and structured data.
- Repeating events and course schedules retain their behavior.
- Existing production-shaped records pass occurrence/content parity on an isolated restore.
- New single events survive the documented rollback procedure.
- Native admin fields remain keyboard accessible and usable in both languages; runtime/browser verification is reported separately from source/test evidence.
