# CILAS admin audit

Date: 29 October 2026. Scope: this checkout's configuration, collections, shared fields, editor features, admin components, and the public flows that consume them. This is a source audit and proposed organization, not a browser usability test or a production data audit. `package.json` pins Payload 3.91.0; this checkout has no `node_modules`, so version-specific APIs still need validation against the installed package before implementation.

## Refresh after merging main

On 29 October 2026, this branch fast-forwarded to `origin/main` at `d85fab55`. The original findings below are retained with corrections: preview authorization now enforces document constraints, Gallery/Related Content blocks are available, and email editor/converter support has been added. Retain their regression coverage rather than implementing duplicate fixes.

The user clarified that a film screening needs its own date and time without an agenda title. Primary event timing will be independent from the optional named Agenda segments. The implementation and production-data migration requirements are in [the refactoring plan](superpowers/plans/2026-10-29-admin-refactoring.md).

Implementation has started. See [the delivered first stage and migration notes](admin-refactoring-migration.md) for current status; the findings below describe the audit baseline.

## Recommendation

Organize the admin around the jobs CILAS staff do: run admissions, prepare teaching, publish community work, communicate, and maintain the site. Keep operational data structured; move optional page composition into a small, purpose-specific editor block palette. Most friction comes from navigation, long forms, hidden dependencies, and incomplete transitions, rather than too many required fields alone.

Already useful: role-specific navigation, a combined review queue, owner review controls, drafts and autosave for courses/articles/newsletters, previews, relationship drawers, reverse joins, SEO defaults, redirects, application acceptance, private uploads, and mailing-list synchronization. Build on these.

## 1. Proposed admin organization

Keep the dashboard as the first destination. Order its content by urgency:

1. **Needs a decision:** separate Admissions and Publishing queues, with age, target, author/applicant, and a direct action link.
2. **Upcoming:** registration deadlines, upcoming courses/events, and items missing a working application destination or calendar details.
3. **Needs attention:** acceptance emails that failed, newsletter/list-sync failures, incomplete public content, and missing translations. These require durable state or explicit completeness checks; do not invent counts from logs or incomplete result sets.
4. **Quick actions:** new course, new event, new article, new newsletter, add a person. Defaults should minimize input without guessing a cycle or audience.
5. **Browse records:** grouped collection links below the operational widgets.

Suggested sidebar:

| Group | Destinations |
| --- | --- |
| Admissions | Applications, Enrollments, Memberships, Forms |
| Teaching | Courses, Cycles, Programmes, Places |
| Publishing | Articles, Publications, Press |
| Communications | Newsletters, Mailing lists, Subscribers |
| Community | Spaces, Posts, Comments, Introduction template, Privacy and rules |
| People | People, User accounts, Governance for super admins |
| Site | Media, Redirects, Site settings, Email settings |

Applications should be a filtered view of form submissions with a target; general messages need their own inbox. Preserve the underlying plugin collection slug and API. Subscribers and Reviews are already custom views; give them persistent navigation links instead of relying on a list-page link or a dashboard widget.

Keep internal notifications, visits, votes, reactions, consent, preferences, RSVP records, and private file collections hidden as they already are. Hiding a destination is not an authorization rule.

Evidence: [role navigation](../src/plugins/role-nav.ts), [config](../src/payload.config.ts), [queue query](../src/lib/review-queue.ts), [queue UI](../src/components/admin/review-queue.tsx). `roleNav` currently prioritizes Users and otherwise preserves collection order. Most main collections have no group. The dashboard adds a five-row review widget above Payload's default collection cards.

## 2. Shorter edit forms

Use **unnamed tabs** so presentational changes preserve existing data paths. Keep title and a compact publication summary visible; avoid placing most course settings in the sidebar.

| Collection | Proposed tabs |
| --- | --- |
| Courses | Overview · Course flow · Schedule · Applications and pricing · Participants · Publishing |
| Programmes | Overview · Structure · Applications and pricing · Community · Publishing |
| Events | Content · When and where · Registration and pricing · Publishing |
| Articles | Writing · Credits and relationships · Publishing |
| Publications | Introduction · Reading order · Credits and provenance · Publishing |
| People | Profile · Teaching · Memberships and enrollments · Governance |
| Newsletters | Compose · Audience and test · Delivery |
| Site settings | Contact · Navigation · Home content · Spaces rollout |

Use meaningful array row titles: session number/title, material title, programme component label, speaker name, and payment-plan label. Collapse completed rows. Show date overrides only when explicitly requested; show online details for online/hybrid delivery and external venue fields only when needed.

Surface **effective values** beside overrides: “Applications inherited from Spring 2027, Cairo,” its form and deadline, and the effective cycle price. The inheritance already works in code, but staff must mentally resolve it from several records. A blank override should visibly mean “inherit,” with an intentional “closed” choice retained.

Publishing should explain three distinct concepts together: review decision, published/draft state, and audience tier. A course can be approved and published yet remain owner-only. Warn about that combination and require an explicit audience choice when approving; never silently make it public.

Evidence: [Courses](../src/collections/Courses.ts), [Programmes](../src/collections/Programmes.ts), [registration fields](../src/fields/registration.ts), [pricing](../src/fields/pricing.ts), [review fields](../src/fields/review.ts).

## 3. Required-field decisions

“Required while writing,” “required before publishing,” and “required when a particular row or mode is used” are different rules. Payload drafts skip validation by default; courses, articles, publications, programmes, and newsletters already have drafts enabled. Do not assume a schema `required: true` currently prevents autosave. Confirm actual Save draft, Submit for review, and Publish behavior before changing schema constraints.

| Field | Decision | Reason / boundary |
| --- | --- | --- |
| `courses.cycle` | Allow an unassigned proposal; require a cycle before approval/publication | A fellow may propose teaching before scheduling an intake. Audit all cycle consumers and use a nullable migration; keep published courses attached to a cycle. |
| `courses.course_type` | Require at submission/approval, not at first composition | It drives programme selection and pricing, so it must exist before operational use. Draft support may already provide the needed flexibility. |
| `events.event_type` | Offer a deliberate default such as Other; permit incomplete drafting once event drafts exist | An admin should be able to start with a title and description. Keep a type for filtering public events. |
| `newsletters.issue_date` | Default to the intended issue date; require before sending/archiving | Staff should not have to set it just to compose. Do not silently replace a deliberately backdated archive issue. |
| `courses.sessions.activities[].kind` | Default to Other or move prose-only activities into session text | Classification should not be busywork. Keep structured activity types where syllabus filtering uses them. |
| `bibliography[].type` | Default to Other, with an easy Reading choice | Keep the type because material filters use it; make classification cheap. |
| `programmes.components[].label` | Generate a useful display fallback where possible | The cycle and course types determine the operational component. A custom heading is presentation, not its identity. |
| `pricing.payment_plans[].label` | Allow a generated label, with optional override | “Three payments” can come from installment count. Installment amounts remain required when a plan is configured. |
| `media.alt` | Add an explicit decorative-image option; otherwise retain descriptive text | Empty alt can be correct for decoration. Do not globally relax accessibility or use filenames as descriptions. Non-image uploads should not demand image alt. |
| `articles.authors` | Keep required at submission/publication | Ownership and access depend on authors, not just printed credits. Non-admin creation already adds the author. |
| Titles/names | Keep for identified/public records | Incomplete drafts can remain incomplete. Do not require duplicate English and Arabic text when a supported fallback is intended. |
| Cycle season/year/place | Keep for a saved operational cycle | They define its identity and compound uniqueness. Derived title/slug/academic year should remain automatic. |
| Enrollment person/course/status, membership person/programme/role | Keep | They define participation and feed access. Defaults can remove clicks without weakening integrity. |
| Schedule slot weekday/start/end; explicit session date overrides | Keep within a configured slot/override | Partial timing data cannot reliably produce meetings. No need to require a schedule on every archive record. |
| Press links/URLs | Keep for an actionable press record | At least one valid source is central to outside coverage. Drafts can support collecting incomplete records if needed. |
| Review status, tier, roles, source, session unit, Spaces mode | Keep valid system values; default or derive and reduce manual exposure | Removing `required` is not the useful fix. `articles.review.status` alone is marked required while shared review fields elsewhere are not; standardize the state contract, not the visual asterisk. |
| FAQ question/answer, social platform/URL, credit role/people, chosen block contents | Keep required when a row/block is used | Adding an optional row is a choice; saving an empty row creates broken output. |

More urgent than relaxing requirements: `registration.form` is optional even for method Site form, and `registration.url` is optional even for External link. Add conditional **server-side** validation using the effective inherited registration, not only `admin.condition`. Today registration can compute as open while no usable destination exists.

Evidence: [shared registration](../src/fields/registration.ts), [open/closed calculation](../src/lib/registration.ts), [schedule](../src/fields/schedule.ts), [materials](../src/fields/bibliography.ts), [Media](../src/collections/Media.ts), [Articles](../src/collections/Articles.ts), [Enrollments](../src/collections/Enrollments.ts), [Memberships](../src/collections/Memberships.ts).

## 4. Fields to replace, remove, or hide

### Move presentation into the editor

| Current fields | Proposed editing experience | Migration boundary |
| --- | --- | --- |
| Programme `highlights` | Bullet list inside overview, or a Highlights block only if its layout is distinctive | Migrate both languages and update the Bridge renderer. |
| Programme `testimonials` | Quote/Testimonial block with optional person relationship | The current Bridge renderer uses only `testimonials[0]`; extra entries create an expectation the page does not meet. |
| Programme `requirements` | A clearly labeled Requirements section/block in the main content | It currently renders in a sidebar in multiple layouts; preserve an equally discoverable placement. |
| Programme `schedule_note` | Text/callout block if it is only narrative | Retain `weekly_hours` as structured data if the page continues to show a commitment fact. |
| Course `facilitator_note` | A Participant notes callout in description | Preserve its public visibility and existing content. |
| Place `images` | Gallery block in description | Only migrate after inventorying records and every current consumer. |
| Event `agenda` | Keep optional named segments separate from primary event timing | A screening needs only its own date/time, with no agenda row or agenda title. Retain existing agenda data and fallback consumers during migration. |

Do not force everything into custom blocks: standard headings, lists, links, and quotes cover much editorial content. Add dedicated blocks only when they provide useful semantics or a stable design.

Keep `content_warning` independently discoverable, even if a warning block is used for rendering. Keep course sessions, their date overrides/cancellations, materials and activity classifications structured: they feed meeting generation, syllabus filters, linked Space posts, visual editing, and text export. Keep cover images for cards/SEO, summaries for cards/search, fellows/authors/editors for ownership, registration/pricing for applications, and article reading order/credits as data. A Person block in a paragraph does not replace the `fellows` relationship.

### Remove duplicate input and hide technical details

- **Programme `cycles`: derive a distinct ordered cycle list from `components` if a full consumer/import audit confirms there is no separate meaning.** The current Bridge API groups courses from component cycles. Maintaining both manually permits disagreement. Preserve deliberate cycle order before dropping storage.
- **Pricing currency:** only EGP is offered. Keep its stored/default value, but remove the unnecessary selector from routine editing.
- **User `sub`, newsletter `broadcast_id`, enrollment `source`:** put in collapsed system details or hide from ordinary editing. Preserve them for diagnostics/provenance.
- **Session `order`:** derive from array position for new content; keep an explicit display-number override if archive sessions intentionally skip numbers.
- **Import provenance:** `legacy_url` and archived registration URL are already hidden. Preserve them for redirects/imports; they are not dead fields.

Editor palette boundaries matter. After the main merge, default editors include Gallery and Related Content as well as Columns, Person profile, Movie, and inline mentions. Email-specific features and converters now exist in `src/lexical/email-features.ts` and `src/emails/rich-text.ts`. Preserve their legacy-content handling and regression tests. Keep the existing newsletter Picks/Gallery/Quote/Text blocks and verify every newly introduced node across its supported output channels.

Evidence: [editor defaults](../src/lexical/default-features.ts), [article editor](../src/lexical/article-body.ts), [Bridge renderer](../src/components/bridge/bridge-year.tsx), [Bridge data](../src/api/programmes.api.ts), [syllabus renderer](../src/components/course/course-syllabus.tsx), [email renderer](../src/emails/newsletter.tsx), [newsletter schema](../src/collections/Newsletters.ts).

## 5. Gaps in CILAS flows

| Priority | Finding | Required change |
| --- | --- | --- |
| P0 | Site Settings has no explicit access rules. Payload defaults missing rules to authenticated users; role navigation only hides the link. Settings include Spaces rollout controls. | Explicitly restrict update to admins; define intentional read access. Verify anonymous, member, fellow, admin and super-admin API behavior. |
| Resolved by main | Preview ownership constraints are now applied through `src/lib/preview-access.ts`, with new security regression tests. | Retain the merged fix and verify regression coverage when extending event preview. |
| P1 | Registration can be open without a form/link. | Validate effective registration at the API boundary and show a publication-readiness error linked to the field. |
| P1 | Events expose a site form, but admissions targets support only courses/programmes. The event page submits no target and the review queue filters out targetless submissions. | Add an event registration target and response/attendance workflow, or an explicit separate event inbox. Preserve event context in the submission; do not create course enrollments for events. |
| P1 | Events have neither drafts nor preview configuration. Public-tier edits take effect on save. | Add an event draft lifecycle, draft-aware read rules, authorized preview, migration/backfill of existing event publication state, and revalidation checks. |
| P1 | Programme acceptance creates membership; course acceptance creates enrollment. Programme acceptance does not allocate course enrollments. | Provide a roster/assignment step based on programme components and student choices. Do not assume every programme member attends every course. Show resulting course-space access. |
| P1 | Acceptance email failure returns a warning but no durable delivery state or retry action. | Persist delivery result and provide a safe resend action that does not repeat membership/enrollment creation. |
| P1 | Published courses can remain owner-only; space creation follows publication independently. | Display “published, owner only” clearly and show publication and Space consequences together. |
| P2 | Programme schema supports Women's Studies and Residency; the preview route renders only Bridge. Cohort auto-creation also intentionally handles Bridge only. | Mark unsupported preview/community behavior explicitly or implement the corresponding routes and policy. Do not imply all programme kinds have equivalent flows. |
| P2 | Publications have drafts/review and an intro/reading order, but no dedicated preview configuration or standalone public detail route through `pathOf`. | Preview the real publication experience, including its filtered articles destination; decide whether intro/credits need a dedicated reader. Existing newsletter publication links already use the article filter. |
| P2 | Bridge “current programme” selection relies on descending slug order and year routes rely on a slug prefix. | Use explicit validated academic identity/current selection. Keep slugs as addresses, preserve redirects, and report ambiguous or missing years. |
| P2 | Enrollment combines confirmed with paid, but the model has no separate payment record. | Label it as manual confirmation or add payment tracking only if staff need balances, deductions, receipts, and instalment status. Do not treat a status label as proof of payment. |
| P2 | Contact messages are excluded from the review queue. | Provide a separate messages inbox with handled/unhandled state. “Nothing waits for you” currently refers only to review/application items. |
| P2 | Review queue fetches all matching documents and versions, then shows five dashboard rows. Waiting age uses `updatedAt`, not a submission timestamp. | Store submission time, fetch bounded lists, and use separate exact counts only where supported. Paginate the full queue. |
| P2 | Editing templates/rollout settings does not tell staff which existing communities are affected. | Show rollout state, derived membership, introduction gate, and archive/reopen status on each Space. Introduction template changes apply to future spaces only. |

Additional evidence: [Site settings](../src/globals/SiteSettings.ts), [preview endpoint](<../src/app/(frontend)/api/preview/route.ts>), [access helpers](../src/access.ts), [admissions](../src/forms/applications.ts), [decision UI](../src/components/admin/submission-decision.tsx), [event page](<../src/app/(frontend)/[locale]/events/[slug]/page.tsx>), [Space hooks](../src/lib/space-hooks.ts), [Space access](../src/lib/spaces.ts), [paths](../src/lib/paths.ts).

## 6. Use Payload capabilities deliberately

| Capability | Current position | Recommendation |
| --- | --- | --- |
| Collection groups and role navigation | Partial groups; role hiding already implemented | Apply task groups consistently, retain server permissions and drawer access. |
| Tabs, rows, collapsibles, conditions, row labels | Rows/collapsibles common; tabs already used in Email settings | Reuse native presentation before building custom field components. |
| Dashboard widgets | Existing custom `beforeDashboard` queue | Reuse its data/permissions; consider native modular widgets after checking 3.91 types. |
| Filters, columns, sorting, saved views/presets | Several lists have useful columns; Courses lacks explicit default columns | Start with links/presets for current cycle, pending admissions, submitted writing, upcoming events, unpublished changes. Verify the exact saved-view support before promising shared/personal presets. |
| Joins and relationship drawers | People and courses already have useful reverse joins | Add contextual access to applications, participants, and linked Space; avoid duplicate relationship storage. |
| Drafts, autosave, versions | Uneven; events/press/people/settings lack comparable recovery | Prioritize drafts for events and recovery/version history for important settings. Permission checks must cover version endpoints. |
| Live preview | Courses/articles/programmes/newsletters configured; programme support is Bridge-only | Extend only to real, authorized rendering paths; test both languages. |
| Blocks and editor features | Shared website palette and article extras; separate newsletter sections | Define palettes for public content, articles, email, and sensitive internal assessments. |
| SEO and redirects | Plugins already installed | Keep derived defaults; place overrides in Publishing; preserve address redirects in migrations. |
| Import/export | Submission export already enabled | Keep private data admin-only; add roster exports only where there is an actual staff need. |
| Trash | Not enabled in local collection declarations | Evaluate for editorial records after checking delete hooks, roles, relationships, search removal, restore behavior, and versioned data. Not a blanket toggle for users/participation. |
| Scheduled publish/jobs | No scheduled publishing configured here | Add only when jobs execution/retries are operationally supported. Newsletter delivery is a separate send workflow. |
| Localization | English/Arabic fields and fallback exist | Show missing-translation indicators and actual fallback content; do not force translated names, imported originals, or Arabic text in every record. |

These recommendations use open-source configuration and the existing custom review flow. Enterprise publishing workflows and visual editing products are separate decisions; do not assume they are part of this installation.

Payload references, checked through Context7 and official docs: [draft validation](https://payloadcms.com/docs/versions/drafts), [presentational tabs](https://payloadcms.com/docs/fields/tabs), [dashboard widgets](https://payloadcms.com/docs/custom-components/dashboard), [access defaults](https://payloadcms.com/docs/access-control/overview), [trash](https://payloadcms.com/docs/trash/overview). Current online docs may describe features newer than the pinned version.

## 7. Delivery sequence and acceptance checks

1. **Protect boundaries:** Site Settings access and registration validation; retain the preview authorization fix merged from main. Verify anonymous/member/fellow/admin behavior through APIs, not just hidden navigation.
2. **Reorganize without data migration:** groups, unnamed tabs, columns, array row labels, clear inherited values, persistent Reviews/Subscribers links. Verify field paths and permissions remain correct and walk through course proposal, application decision, article review, and newsletter composition.
3. **Complete operations:** event draft/registration handling, programme roster assignment, durable acceptance-email result/retry, and inbox separation. Verify repeat acceptance does not duplicate participation and a resend does not recreate it.
4. **Migrate presentation:** inventory existing EN/AR content, introduce narrowly scoped blocks/renderers, migrate field content in order, verify public pages/email/previews/search/text export, then remove retired fields. Retain a rollback snapshot and fail visibly on content that cannot be migrated.
5. **Add recovery and automation:** version history, selective trash, and scheduling only after their access rules, hooks, jobs, indexing, and restore behavior are verified.

Representative completion checks:

- A fellow can start a course proposal before the intake is chosen; publication requires its actual operational identity.
- An admin can see effective cycle pricing/application settings without opening several records.
- A selected registration method always has a usable effective destination.
- Event registrations retain event identity and appear in their intended queue.
- Programme members can be assigned to courses intentionally, and Space access follows the resulting enrollment rules.
- An author sees the approved public article while proposed changes wait for review.
- Another person's draft cannot be previewed by changing a slug or reusing a draft-mode cookie.
- Existing English/Arabic content survives block migration; inserted website-only nodes cannot silently disappear from email.
- Every field the editor offers either affects the intended output or clearly explains its internal purpose.

No schema, application code, production records, or deployments were changed by this audit. Runtime and browser verification remain necessary during implementation.
