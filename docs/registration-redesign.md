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
3. Course registration modes, fellow visibility, external hides site-form fields, cycle required at publish. Check as a fellow and as an admin.
4. Templates and the Registration defaults global, with automatic copies. Check by creating a cycle, a Bridge year and an `own` course.
5. Application shape with `choices`, and server checks on submit (open courses only, required questions of ticked courses only, amount must be one of the options). Tests cover closed, close-early and `own` courses.
6. Form page: course ticks, a Badge and questions per course, the contribution slider. Check in the browser.
7. Admin: full-form preview, per-course accepted ticks, enrollments without duplicates, the email. Check by approving one application with one course unticked.
8. Fellow applicants page. Check that a fellow sees only their course's answers.
9. Data migration of existing courses to modes. Compare counts before and after.

Migrations: the agent writes them and asks before it applies them.

Every step follows the untangle rules in `AGENTS.md`. In the files each step touches, it also removes comments that only restate the code, and removes or fixes tests that would not catch a real bug. Test cleanup comes last in each step, after the step's own checks pass.
