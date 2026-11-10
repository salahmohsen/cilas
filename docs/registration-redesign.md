# Registration and contribution redesign

Status: planned, 2026-11-10.

## Why

CILAS runs one application form per cycle. Applicants choose one or more courses in it. Some courses and workshops in a cycle use their own registration, and some close before the cycle does. Today a course either repeats the cycle's form or inherits it through empty fields. Each application is for exactly one course, so an applicant who wants two courses fills in the same form twice.

## Decisions

- **Course registration mode.** Each course has one admin-only choice: `follow_cycle` (default), `own`, or `closed`.
  - `follow_cycle`: the course is listed in its cycle's form. An optional `close_early` date removes it from the list before the cycle closes.
  - `own`: the course has its own method (site form or external link), form, deadline and contribution. It is not listed in the cycle form.
  - `closed`: the course takes no applications.
- **Apply link.** It stays on each course page (`/study/[slug]/apply`). There is no cycle apply page. A `follow_cycle` course opens its cycle's form with the course already ticked. The applicant can tick any other open course in the same cycle. An `own` course opens its own form.
- **External registration.** When the method is external, every field that needs the site form (form, applicant questions, course list) is hidden and not required. This applies to cycles, courses, programmes and events.
- **Course questions** stay on the course (`applicant_questions`), not in the form. The site adds them to the form when it renders the form. The cycle has a "Preview full form" button that shows the merged form.
- **Form preview.** One admin preview page renders a form with the same component as the public page, with submit turned off. Opened from a form or template, it shows the form's own questions. Opened from a cycle or course, it shows the full form a visitor sees.
- **Contribution.** One shape everywhere: a list of suggested amounts, with exactly one default. Payment plans exist only on programmes. A course's contribution comes from its override, or else from its cycle by course type. The form reads this at render time and stores none of it.
- **Contribution slider.** The form shows the amounts as marks on `ElasticSlider` (`src/components/arc/elastic-slider`), sorted from lowest to highest, and starts on the default. The slider stops only at those amounts. One amount shows as text without a slider. An amount of 0 shows "Free".
- **Form templates.** A form can be marked as a template. Admins can edit templates at any time. A "Registration defaults" global names the cycle, Bridge and workshop templates. A new cycle, a new Bridge year, and a course switched to `own` each get a copy of the matching template. Later template edits do not change copies.
- **Fellows.**
  - They see the cycle field read-only. They cannot see registration or contribution.
  - They can edit "Questions for applicants".
  - They see only applicants who ticked one of their courses. They see the shared answers and their own course's answers, never answers for other courses.
- **Cycle required at publish.** The course `cycle` field is required only when an admin approves or publishes the course. A fellow's draft can be saved without it.
- **Approval.** Admin approves an application once. Each chosen course has an accepted tick, on by default. Approval creates an enrollment for every ticked course and skips courses the person is already enrolled in. The acceptance email lists the ticked courses only.

## Data shape

```ts
type Contribution = {
  options: { amount: number; default: boolean }[] // exactly one default
  note?: string
  need_based_deductions?: boolean
}
// Programmes only: Contribution & { payment_plans }

type Cycle = {
  registration: {
    method: 'form' | 'external' | 'closed'
    form?: Form
    url?: string
    deadline?: Date
  }
  pricing: { course_types: CourseType[]; contribution: Contribution }[]
}

type Course = {
  cycle?: Cycle // admin-only; required at publish
  registration:
    | { mode: 'follow_cycle'; close_early?: Date }
    | { mode: 'own'; method: 'form' | 'external'; form?: Form; url?: string; deadline?: Date }
    | { mode: 'closed' }
  contribution_override?: Contribution // admin-only
  applicant_questions: Block[] // fellow + admin
}

type Application = {
  target: Cycle | Course | Programme
  submissionData: Answer[] // shared questions only
  choices: {
    course: Course
    amount: number // snapshot at submit
    need_reduction: boolean
    answers: { name: string; label: string; value: string }[] // label snapshot at submit
    accepted: boolean
  }[]
}
```

## Decision log

Problems found in the current code, grouped under the fix that removes them.

Round E (2026-11-11). Each fix is listed above the problems it solves.

`src/lib/phone.ts` owns the installed Arc country table, parser, formatter and canonical E.164 validation. Form and course questions share a `phone` block with a generated machine name and an ISO default country (EG). The existing form values and device draft carry E.164 answers, including course answers. The Arc control preserves excess digits so incomplete and too-long states can be shown; its number controls stay LTR. Shared and course submissions refuse invalid phone answers before writes or file storage. `answerText` formats phones for every existing answer reader.

Problems solved: the only phone parser lived behind a client boundary, truncated excess digits, and could not validate server submissions; forms and course questions had no phone type, and readers would show raw E.164 strings.

`questionDescriptionFeatures` defines one small editor for all question descriptions: paragraphs, bold, italic, external links and ordered/unordered lists. The form renders these with the site's `RichTextField`; controls describe themselves through the rendered content, and file guidance and word counts remain separate. Arc descriptions accept React nodes in block-capable containers. MCP form and course writes accept phone questions and localized Markdown descriptions, converting them with the same restricted editor. The accepted-fields registry and guides include the new fields. The Bridge seed uses the migration's frozen plain-text converter so reseeding keeps its links.

Problems solved: every question's description was plain text; only some controls autolinked URLs, and others flattened the help text; concatenating rich descriptions with file guidance would stringify the document. MCP form creation and course writes otherwise had different description contracts.

Migration `20261110_215430_phone_question_rich_descriptions` was generated through `pnpm db:migrate:create` under `expect`. It creates phone block tables for forms, courses and course versions, changes the 25 existing localized description columns to JSON, and adds descriptions to country/state blocks. The data step preserves nulls and creates one paragraph per line with the former `Linked` URL rule. A dump/restore copy preserved all 30 descriptions and 16 links; dev matches the migrated copy, which was dropped. A URL-at-start regression found during verification was corrected in the converter, retested on a second restore, and the 30 dev values were regenerated from the original dump. Rollback refuses to discard rich text and phone data.

Verification: typecheck and lint passed (existing warnings). All 1,288 unit tests passed. Nine requested integration specs passed together (67 tests); the remaining MCP spec hit its random cycle-slug setup collision and passed all 41 tests on one rerun. The additional MCP OAuth spec passed all 42 tests. Own-form and full-cycle previews show the phone and rich description. SQL confirmed the browser fixtures, submissions and migration copy were removed. The application e2e passed on an external temporary checkout on port 3001 with Turnstile disabled only in that process. English/Arabic browser proof verifies rich bold/link/list descriptions, phone LTR and accessible descriptions; draft restoration and the too-long state were also checked. Screenshots are `phone-en.png`, `phone-ar.png` and `phone-admin.png` in the requested scratchpad. Shared-browser snapshots timed out twice, so Playwright supplied the proof. The temporary server was stopped; port 3000 was left running.

Round D (2026-11-10). Each fix is listed above the problems it solves.

`create_form_and_link` reads the course's mode first. A `follow_cycle` course is refused unless `link.switch_to_own` is set; the refusal names the cycle and points to `applicant_questions` with `update_course_draft`. The form guide, course guide and `new_form_for_course` prompt say the same. A new form is a copy made by `copyDefaultTemplate` (the one copier in `src/forms/templates.ts`, also used by the collection hooks); the given questions follow the template's. Without a workshop template the result says so. The lookup registry names the records each kind may return (`only`), and forms exclude templates.

Problems solved: linking silently took a course out of its cycle form; assistant forms ignored the workshop template; lookup offered templates as linkable forms.

`useSpamCheck().submit` returns `sent | bot | spam-check-failed | network | refused(error)`. `failureMessage` turns a failure into each form's own sentence. A failed or unloaded Turnstile now says to reload; a refusal without a reason says the server failed; only a failed request mentions the connection. The contact section accepts `{ failed }` from its submit handler.

Problems solved: a Turnstile failure threw, the form caught it as `undefined` and blamed the visitor's connection; `null` meant "bot" by convention.

`src/forms/question-name.ts` owns the one machine-name rule (`QUESTION_NAME`) and the generator. `nameQuestions` names each new question once from its English label (`question_<id>` for an Arabic-only label, `_2` for a repeat) and gives each new option a value the same way (`option_<id>`). A saved name or value, matched by row id, never changes. Form and course hooks run it before validation and refuse a given name that breaks the rule, for drafts too. The `name` and option `value` fields are hidden in the admin and marked `custom.generated`, so the MCP schema treats them as optional. Forms save option values; `answerText` in `src/forms/answer-text.ts` shows the current option label everywhere answers are read (admin submission view, choice cards, applicants view, form emails), and falls back to the saved text. Migrations `20261110_202109_question_machine_names` and `20261110_203134_option_machine_values` normalize old names and values with the same steps. On dev they changed 1 course question and 2 of its versions, and 5 form option values; 0 saved answers referred to them. Both passed on a dump/restore copy (with planted answers, which moved with them) before dev.

Problems solved: admins typed machine names such as "a question from test course one "; the MCP had its own name rule; option values were free text; answers stored option labels, so a relabel could not be shown.

`registrationFormField` takes its description from the caller, and `registrationField` and `validateCourseDestination` take a `FormHelp` (`templateFormHelp` for cycles, Bridge years and own courses; a plain message for events). Cycles and Bridge years copy their template whenever a site form is left empty, not only at creation, so the description is true. With no template set the error says to choose a form or set that template.

Problems solved: switching a saved cycle to "Site form" with the form empty failed with "registration.form" invalid, because the copy ran only at creation; the error blamed "the course or its cycle" on a cycle; the field did not say an empty form uses a template. A brand-new cycle and the picker filter did not reproduce on this code through REST and the admin UI as an admin: the copy was made and no template was offered.

Untangle round C (2026-11-10). Each fix is listed above the problems it solves.

`src/forms/applications.ts` is split into three modules. `application-fields.ts` holds the submission fields. `application-decision.ts` holds accept, reject and their endpoints. `applicant.ts` holds `applicantOf` and `rolesAfterAccept`. `checkTarget` moved next to `validateApplication`, the function it wraps. `TargetKind` and `idOf` are removed.

Problems solved: the new-application notice imported the whole acceptance module (transactions, mail, user creation) to read two answers. An exported type and an ID helper had no users.

`src/forms/course-titles.ts` looks up course titles with one `id in` query. The submission view, the new-application notice and the acceptance email use it, and each keeps the order of its choices.

Problems solved: the virtual `courses` column ran one `findByID` per choice for every list row. The notice and the email each looked up titles in a different way.

`choiceField` in `application-choices.ts` is the one name for the `choice:<id>:<name>` key. The form and the multipart parser both import it.

Problems solved: the same key had two names (`courseField` as an alias of `choiceFileField`). It was defined in the server input types module, and the client re-exported it.

The form preview page resolves `{ title, form, application }` from the contextual or the own-form source, then renders once. `PREVIEW_TARGET_FIELDS` in `src/lib/preview-url.ts` names the field each collection uses in a preview link. The link builder, the preview route and the live preview list read it.

Problems solved: the page had two copies of its shell. "Forms use the ID, other collections use the slug" was written as a conditional in both the route and the link builder.

`copyRegistrationTemplate(key, applies)` makes a hook for each collection. Each collection names its template and its rule. A cycle copies at creation. A Bridge programme copies at creation. A course copies whenever it is in `own` mode. The shared rule "only for site-form registration with no form yet" stays in the hook.

Problems solved: one nested ternary chose the template from the collection slug, the operation and the kind. Courses also repeated a "became own form" transition test. The no-form check already covers it. As a result, an `own` course whose form was cleared now gets a new copy, where before it failed validation.

The course `cycle` field has no custom component. `access.update: adminOnlyField` already makes Payload render it read-only for a fellow (`relationship--read-only`, input disabled). This was seen in the browser. The full-form preview button is hidden by `admin.condition` on the field. The preview page keeps its own admin check as the guard.

Problems solved: a client component repeated a rule that field access already enforces. The preview button did a role check on the client.

`src/lib/pricing.ts` is the only place that chooses the currency label: "EGP" in English and "ج.م" in Arabic. `formatAmount` and `contributionLabel` both put the label after the number. `contributionLabel` takes only `locale` and `free`. Calendar entries ask for the page language with Western digits (`<locale>-u-nu-latn`). JSON-LD keeps the ISO code. The unused `egp` and `amountEGP` messages are removed.

Problems solved: Arabic prices showed "EGP" while payment plans showed "ج.م". Events and calendars passed a translated currency word ("جنيه مصري"). Callers chose where the currency went and how numbers were formatted. English course and Bridge prices now read "30,000 EGP", the same as payment plans and the contribution slider.

The template copy hook reads the defaults from `req.context[REGISTRATION_DEFAULTS]` when a caller supplies them, and from the global otherwise. The template spec supplies its defaults this way and never writes the global. Its seed test runs inside a transaction that it rolls back. A final test checks that the global is unchanged.

Problems solved: the integration specs raced on the shared `registration-defaults` global, so round B had to run them one at a time.

Verification for round C: typecheck and lint passed (only older warnings). All 1,247 unit tests passed. The ten integration specs passed together with ten workers, 74 tests in 26 seconds against 183 seconds of total test time. A second parallel run also passed. The application e2e passed against a temporary webpack dev server with Turnstile keys empty for that process only. Browser checks as a fellow showed the read-only cycle field, no full-form preview button, and the applicants view in light and dark themes. The Arabic Bridge page showed `٣٠٬٠٠٠ ج.م` and no "EGP". The dev `registration-defaults` global was empty from an earlier race, so the seed function pointed it back at the existing templates. Test data was removed and checked with SQL.

Review fixes 3–5 (2026-11-10): `src/forms/application-target.ts` owns the explicitly tagged course, cycle and programme application target and returns its loaded cycle, form, availability, publication status, ownership and submission destination. The course and Bridge application pages, contextual preview and submission validator share it. `loadApplicationTarget` moved out of `lib`; registration rules there now have no database I/O. Application context receives the resolved target and uses one localized cycle-course query instead of fetching each course again. Readers are typed as `Reader`.

Problems solved: entity kind depended on the presence of `course_type`; three callers selected forms independently; cycle reads and course localization queries repeated; the apply page reconstructed its submission destination and asserted a cycle existed.

`src/lib/course-registration.ts` owns the default mode, own-method and destination requirements, and the approval/publication predicate. Course and plain registration hooks are separate. `registrationDestinationFields` shares method, form, URL and deadline definitions; the form relationship accepts its visibility condition from the caller.

Problems solved: mode defaults and own-registration rules drifted across CMS, MCP and readers; the shared validator branched on a collection that no longer used its field factory; course fields duplicated the shared destination fields; the form selector inferred its field shape.

`src/lib/pricing.ts` owns `CURRENCY`, sorted unique amounts, default selection and money formatting. The form reads contributions directly, JSON-LD uses the default helper, and Bridge prices pass the locale so Arabic digits are retained. The hidden one-value currency field was removed, including stale seed values and the MCP field contract.

Problems solved: contribution defaults and sorting were repeated; the UI imported domain money helpers from form choice types; currency was stored despite never varying; Bridge Arabic prices used English digits while payment plans used another formatter.

Migration `20261110_183648_fixed_contribution_currency` was generated through Payload's CLI with `expect`. It dropped seven currency columns and their enums on a dump/restore copy, preserving 315 courses and 5 submissions. The copy was dropped before successful application to dev. Types and import map were regenerated.

Verification: typecheck and lint passed (existing lint warnings); all 1,245 unit tests passed, including the resolver's three kinds, mode rules and Arabic money regression. All 73 tests in the ten requested integration specs passed with one worker. A concurrent run exposed the registration-template global race; the registration spec passed alone and the serial full selection passed without assertion changes. The final money/resolver check passed 15 tests and the MCP draft spec passed 15 tests after the last edits.

Browser verification: the Arabic Bridge page displayed `EGP ٣٠٬٠٠٠`; `untangleB-bridge-ar.png` records it in the requested scratchpad. The application e2e passed, including the cycle form, slider, separate answers and saved contributions for two courses; its screenshot was copied to `untangleB-course-cycle-form.png` in the same scratchpad. The first navigation timed out on a cold compile and passed after compilation. Shared-preview navigation timed out twice, so Playwright supplied the browser evidence. A temporary source copy on port 3001 avoided the existing server's Next lock. Turnstile and unreachable Typesense startup were disabled through process-only variables; no env file changed. All servers started for this verification were stopped. The import map was regenerated from the real checkout after stopping the temporary server.

Step 6 implementation (2026-11-10): `RenderedForm` accepts application context through its existing `PayloadForm` props. `application-choices.ts` owns the course context and field keys; `PayloadForm` keeps selection, per-course answers, amounts and deduction requests in the same TanStack values and device draft as shared answers. Course answers use the server's multipart choice names. Unticking deletes their fields and resets their contribution. The apply page obtains eligible courses from `openCoursesInCycle`, loads their localized questions and resolves their contribution once. Own-course forms use the same context with one fixed choice. Programmes retain their existing render path. ElasticSlider operates on sorted option positions with amount labels, so uneven amounts still snap on every pointer and keyboard change.

Problems solved: the apply page flattened one course's prefixed questions into the shared form; selection and contribution had no public controls; a second renderer would split validation, uploads and draft behavior; raw amount steps cannot represent uneven contribution options.

Step 5 and server approval implementation (2026-11-10): submissions can target a cycle and store `choices` with course, contribution amount, deduction request, answer snapshots and an admin-controlled accepted flag. `src/forms/open-courses.ts` owns eligibility through `isOpenCourseInCycle`; `openCoursesInCycle` exposes the reader's available courses. `src/forms/application-validation.ts` loads at the boundary and checks loaded data in the pure `checkApplication` function. Plain and multipart submissions use the same check; multipart course uploads use `file:choice:<course-id>:<question-name>` and become links in that choice's answers. Public creation always initializes accepted flags to true. Approval enrolls accepted choices transactionally, reuses existing enrollments and sends only accepted titles through the existing acceptance email template. Approval with no accepted choices asks the admin to select at least one. Cycle notifications name all chosen courses.

Existing course-target submissions without choices retain their prefixed answers and singular enrollment result. Their acceptance does not revalidate current registration, so historical applications remain acceptable. Local seeds and backfills still bypass availability checks. Until step 6, the existing follow-cycle page serializes its one course into a cycle choice, moves its prefixed answers into that choice and uses the resolved default contribution. Own-course pages retain their existing submission shape. The form now displays server error sentences without clearing answers. No course-selection or contribution UI is added.

Migration verification: `20261110_160334_application_choices` was generated with the Payload CLI through `expect`. Active dev connections prevented `createdb -T`, so a consistent `pg_dump`/`pg_restore` copy was used instead. Migration on that copy created both choices tables and the cycle relationship, preserving all five existing submissions. The copy was dropped and dev migrated successfully.

Problems solved: each course required a separate application; client question labels could become untrusted snapshots; multipart requests could bypass local-API availability checks; approval and its email could only represent one course; stricter cycle targeting would break the existing form before the course-selection UI arrives.

Step 4b implementation (2026-11-10): the existing preview URL and authorization endpoint accept forms by ID. The admin Preview button opens `/{locale}/forms/preview?form={id}` for forms and templates. The page authenticates every request and checks the collection's edit access independently of the draft cookie. Its query-based target leaves the same page available for cycle/course context in step 7; no context handling is built yet. `RenderedForm` owns message-block rendering, confirmation rendering and `publicForm` sanitization for the course, Bridge and preview pages. `PayloadForm` preview mode guards both submit handlers, disables the submit button, and skips spam widgets, analytics and draft persistence. No schema changes.

Problems solved: forms had no admin preview; duplicating the apply render path would let preview drift from public forms; a draft cookie alone cannot authorize a private preview; disabling only a button leaves other submission paths active.

Step 4 implementation (2026-11-10): `src/forms/templates.ts` owns registration form selection and copying. Collection hooks copy the matching default before destination validation, in the same transaction. A Bridge year is a new programme with `kind: bridge`. Cycles and Bridge years copy only at creation; courses also copy when changing to own site-form registration. Payload's duplicate operation preserves every template locale, including nested labels, confirmations and emails; form titles are not localized. The shared registration relationship excludes templates and rejects them server-side even for drafts. Seeds fill all three defaults after snapshot restore or before development entities are seeded.

Migration verification: `20261110_140348_registration_templates` was generated with the Payload CLI, applied successfully to a throwaway copy of `cilas_dev`, and checked for the new table and checkbox column. The copy was dropped and the dev database migrated.

Problems solved: new intakes needed hand-made forms; registration selectors could offer reusable templates as live forms; copying fields by hand could lose localized content or drift between entity types.

Step 3 implementation (2026-11-10): courseRegistration selects one complete destination by mode and caps the cycle deadline with close_early. Course-specific registration fields replace the shared field; the shared destination hook validates the resolver output. Admin-only write access protects registration, contribution and cycle without removing public read data. The cycle requirement runs after review transitions, so both approval and direct publication enforce it, while drafts remain nullable. Step 9 is included in the same schema migration. Archive imports explicitly use closed mode and retain their historical link in url. The migration drops the obsolete archived-link columns; rollback cannot recover those links or close_early.

Migration verification: a throwaway copy of cilas_dev contained 310 courses (300 empty methods, 10 external) and 3,750 versions (3,671 empty, 79 external). After migration: 300/3,671 follow_cycle, 10/79 own, 0/0 closed (courses/versions); close_early remains empty. The copy was dropped and the dev database migrated.

Problems solved: implicit per-field inheritance mixed unrelated destinations; fellows could write financial and registration settings; drafts required a cycle before an admin could assign one.

Step 1 implementation (2026-11-10): `courseRegistration(course, cycle)` owns per-field registration inheritance and delegates price selection to `pricingFor`. Readers consume the resolved status, destination, Cairo deadline day and price. The destination validator still validates independently of open status. Public external links retain their existing course-owned URL behavior; changing inherited external links belongs to a separate behavior change. llms.txt now reads its price note from the selected price, so a cycle price cannot display an unrelated override note. No schema or migration changes.

Step 2 implementation (2026-11-10): `contributionField()` owns the suggested options and uses the same exactly-one-default validator as MCP. Only programmes opt into payment plans. `contributionLabel()` owns amount selection and range formatting for every display, with translated calendar/event words supplied by their callers. JSON-LD reads the default option. Existing group names (`pricing` and `pricing_override`) stay in place for this step. The migration converts documents and draft versions before dropping min/max, retains max-only legacy values as a default, and restores extrema on rollback; discarded non-programme payment plans cannot be recovered by rollback.

- **One resolver, `courseRegistration(course, cycle, reader)`, returns status, apply link, deadline, form and contribution.** Every reader of registration or price calls it. The "empty field inherits the cycle" rule then lives in one place, and the mode field replaces it.
  - `src/app/(frontend)/[locale]/study/[slug]/CourseView.tsx:115` repeats `course.registration?.X ?? cycle?.registration?.X` for method, form and URL, and builds the apply link itself.
  - `src/app/(frontend)/[locale]/study/[slug]/apply/course-apply-page.tsx:61` repeats the same fallbacks for method, form and deadline.
  - `src/api/courses.api.ts:157` and `:212` repeat the status and the deadline fallback.
  - `src/api/llms-document.ts:389` reads `pricing_override.note` directly and ignores the cycle's price. `:392` and `:417` repeat the registration fallbacks.
  - `src/forms/applications.ts:96` repeats the form fallback in `checkTarget`.
  - `src/lib/registration.ts:46` (`loadApplicationTarget`) repeats the status fallback.
  - `src/components/admin/course-settings.tsx:18` rebuilds the course price from raw form fields to call `pricingFor`.
  - `src/fields/registration.ts:36` (`validateDestination`) loads the cycle to repeat the fallback during validation.
  - `src/plugins/mcp/guides.ts:45` documents "null method inherits the cycle" for agents.
- **One `Contribution` field and one `contributionLabel()`.** Every price display uses them. Programmes add payment plans to the same shape.
  - `src/lib/pricing.ts:29` (`priceLabel`) formats min and max.
  - `src/components/bridge/bridge-year.tsx:64` formats min and max again by hand.
  - `src/lib/event-calendar.ts:36` formats min and max a third time, with its own "free" rule.
  - `src/lib/schema.ts:212` reads `event.pricing.min` for JSON-LD.
  - `src/plugins/mcp/course-validation.ts:34` validates min and max for agents, separately from `src/fields/pricing.ts`.
  - `src/fields/pricing.ts` gives courses and cycles payment plans that only programmes use.
- **The application stores a list of chosen courses, each with its own answers.** Course questions then need no name prefix, and one submission can cover many courses.
  - `src/app/(frontend)/[locale]/study/[slug]/apply/course-apply-page.tsx:76` prefixes course question names with `course_` so they cannot overwrite shared answers. This is a convention that the acceptance code and every reader must know.
  - `src/forms/applications.ts:34` allows exactly one target, so one applicant needs N submissions for N courses.
- **The mode field states whether a course follows its cycle.** The admin UI and validation read the mode, not the absence of values.
  - `src/fields/registration.ts:73` describes an empty method as "use its cycle's". The admin cannot see which values are inherited.
  - `src/collections/Courses.ts:407` hides applicant questions when the course's own method is external, but not when the inherited cycle method is external.
- **Fellow field access lives in one place on the course collection.**
  - `src/collections/Courses.ts:201` makes `cycle` required on every save, so a fellow who cannot set it cannot save a draft.

Special cases kept on purpose:

- `checkTarget` lets local API callers (seeds, backfills) skip the open and published checks. The archive import needs this.

## Build order

Each step ends with a check before the next starts.

1. Resolver. Move every consumer in the decision log to `courseRegistration()`. Check that the course page, apply page, open page, study index and llms.txt render the same as before.
2. Contribution shape on cycles, courses, programmes and events. Payment plans on programmes only. The migration counts course plans first, then turns `min` into the default option and `max` into a second option. Check that old prices render correctly.
3. Course registration modes, fellow visibility, external hides site-form fields, cycle required at publish, and data migration of existing courses to modes (step 9 merged here). Compare document and version counts before and after. Check as a fellow and as an admin.
4. Templates and the Registration defaults global, with automatic copies. Check by creating a cycle, a Bridge year and an `own` course.
   4b. Form preview: a Preview button on forms and templates opens the shared preview page with the form's own questions. Check in the browser.
5. Application shape with `choices`, and server checks on submit (open courses only, required questions of ticked courses only, amount must be one of the options). Tests cover closed, close-early and `own` courses.
6. Form page: course ticks, a Badge and questions per course, the contribution slider. Check in the browser.
7. Admin: full-form preview from cycles and courses (the step 4b page with context), per-course accepted ticks, enrollments without duplicates, the email. Check by approving one application with one course unticked.
8. Fellow applicants page. Check that a fellow sees only their course's answers.
9. Merged into step 3: data migration of existing courses to modes.

Migrations: the agent writes them and asks before it applies them.

Every step follows the untangle rules in `AGENTS.md`. In the files each step touches, it also removes comments that only restate the code, and removes or fixes tests that would not catch a real bug. Test cleanup comes last in each step, after the step's own checks pass.

Step 7 implementation (2026-11-10): `src/forms/application-choices.ts` owns the shared context types and choice keys, so server loaders do not import the UI layer. `application-context.ts` loads the same eligible, localized course options for the public application and the existing form preview. `preview-context.ts` restricts contextual previews to admins; cycle previews start without a course selected, while course previews select that course. The admin submission array uses saved answer labels and Payload's native accepted fields. Approval saves those fields before deciding, and the result stores an enrollment summary so created and existing records remain distinguishable after reload. A virtual Courses column uses the same choice view data; the underlying `choices.course` relationship remains available for filtering. Legacy shared answers and the singular enrollment relationship remain visible.

Problems solved: full-form previews could drift from the applicant form; raw choice arrays obscured answer labels; unsaved accepted ticks could disagree with the decision endpoint; the singular result could not explain multiple enrollments or distinguish reused records.

ElasticSlider now resolves inherited direction in the component and maps its physical coordinates, fill, marks, overshoot and horizontal keys accordingly. Its numeric order remains ascending. Browser inspection found unchecked checkboxes had a false checked state and invisible mark, with hover changing only the border. No checkbox state change was needed.

Migration verification: `20261110_163833` was generated with the Payload CLI through `expect`. It adds `form_submissions.result_enrollments` as JSON. It passed on a dump/restore copy of dev, preserving the five submissions in that copy, before application to dev. The throwaway database was removed.

The step 6 Next issue was a hydration mismatch caused by screenshot caret hiding, confirmed in `/tmp/step6-dev.log`: inputs acquired `caret-color: transparent` before React hydrated. Playwright adds that inline style during screenshot preparation. `tests/helpers/formScreenshot.ts` preserves the caret instead, and the application e2e checks that capture leaves no Next issue badge. No hydration-warning suppression was added.

Step 8 and result normalization (2026-11-10). `src/forms/applicants.ts` owns the privileged applicants projection. It checks the viewer's role and linked person before querying, filters applications by taught courses, then constructs answers and choices explicitly. Fellows receive shared answers and their own course choices without financial fields. Legacy course targets become one choice with their prefixed answers. Choice labels use the saved snapshot; legacy labels use current course questions because no snapshot exists. Admins use the same projection with every course and financial fields. The custom Applicants admin view and the course sidebar link share its counts. The top-bar link follows role-nav permissions, matching the existing custom views.

Problems solved: collection read access cannot safely expose a mixed-course application to a fellow; client-side hiding would still deliver other courses' answers and contribution data; separate count queries could disagree with legacy matching. Result enrollment IDs and course titles were duplicated between a single relationship and JSON. `result.enrollments` is now the read-only, admin-only hasMany relationship. The typed `enrollment_outcomes` array retains only the enrollment reference and historical created flag, which cannot be derived from an enrollment's current status, source or timestamps. Programme membership is unchanged. Old single results without a recorded flag keep the relationship and leave that history unknown.

Migration `20261110_180434_application_enrollment_results` copies both old shapes before dropping them and deduplicates relationship links. It passed on a dump/restore copy with five submissions, the copy was dropped, and it was applied to dev. The migration integration test rolls the schema back in a transaction, populates both historical shapes, reapplies the migration and verifies the links and flags before rolling the transaction back.

Review fixes 1, 2, 8, 10 (applicants only), 14 (2026-11-10): course-target applications now require one matching choice; acceptance, uploads and applicants read that shape exclusively. Migration `20261110_182457_backfill_course_choices` moves historical prefixed course answers into choices, saving current English question labels with a name fallback. Submissions have no version tables. The data migration deliberately refuses rollback because subsequent choice edits cannot safely become legacy answers again.

Template forms are admin-readable and cannot receive submissions, even through local creation without a target. Registration defaults retain Payload's relationship validation with privileged reads because that global is admin-only and trusted local seeds have no user. Applicants use an explicit admin/fellow viewer; the course sidebar counts matching submissions without projecting every applicant. Target lookups suppress only not-found errors; multipart choice IDs are checked before database lookup.

Problems solved: empty choices bypassed course questions and contributions; two legacy answer conventions split uploads and applicants; acceptance silently inferred a course; heuristic financial filtering could discard ordinary answers; public templates could be read and submitted; database failures looked like missing targets; malformed multipart IDs returned server errors; the sidebar fetched full applicant details for a count.

Verification: the dump/restore copy and dev migration both preserved 5 submissions and 35 shared answers; legacy course targets, prefixed answers to move, choices and choice answers were all 0 before and after. The copy was dropped. The transactional backfill test exercises two legacy course submissions (including one without answers), two moved answers, and preservation of existing choices and non-course submissions. Typecheck, lint (existing warnings), all 1,239 unit tests and 54 targeted integration tests pass. Types and import map were regenerated. The application e2e reached the form but failed to confirm submission; diagnostic instrumentation recorded Cloudflare Turnstile's challenge request failing with `net::ERR_ADDRESS_UNREACHABLE`. Temporary instrumentation was removed.
