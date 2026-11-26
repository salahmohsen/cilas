# The portal: one place on the site where members, fellows and admins do their work

Accepted design, 2026-11-18. Nothing in the repo implements it yet. The phases at the end say in which order it is built.

The owner approved the decisions D1 to D18 on 2026-11-18, except D16, which is open. The [Decisions log](#decisions-log) lists each one. Where an earlier source (the critique ledgers, the tech plan, U-sessions) says something different, this spec wins.

## Context

`/[locale]/spaces` today holds the course, cohort and community spaces. Everything else a fellow or a student does happens in the Payload admin at `/admin`: write an article, propose or edit a course, read applicants, write assessments. The admin is built for admins. For everyone else it is a database screen with role-based hiding.

- Every role can open `/admin`. `users` has no `access.admin` (`src/collections/Users.ts:147-153`). The role nav only hides links (`src/plugins/role-nav.ts`).
- The review state of one document is spread over four stored facts: `_status`, `review.status`, `review.request`, and the latest draft version. An owner's edit to a published document saves a draft beside it (`src/lib/review-hooks.ts:45-58`). No screen shows the owner one clear state.
- `review_note` is one textarea, and each review round overwrites it (`src/fields/review.ts:59-67`). The history of a review is lost.
- Course approval publishes (`review-hooks.ts:175-182`), publishing needs a cycle (`src/collections/Courses.ts:578-587`), and course approval sets no tier, so `tier` stays `owner` (`src/fields/tier.ts`).
- An author cannot withdraw a submission (`src/lib/review.ts:17-23`, `submitted: []`).
- A session of an unpublished course has no lock. Its access is the owner rule with no constraint (`src/collections/Sessions.ts:98-108`), so a fellow can move the sessions of a proposal while an admin reviews it.
- The applicant decision endpoints commit at once and send the email after the commit (`src/forms/application-decision.ts:491-526`). There is no undo window.
- Links in review emails and notifications point into the admin (`review-hooks.ts:221`, `src/lib/review-queue.ts:71`, `src/lib/invitation.ts:83`).
- Fellows write assessments (narratives in place of grades) on the enrollments of their courses in `/admin` (`src/collections/Enrollments.ts`, the `assessor` field rule and `adminOrTeachingFellow`).

The prototype that this spec follows is published at [CILAS portal prototype](https://claude.ai/artifact/EAKLx74CwTcbJGEqtPiUDH). Three critique rounds shaped it. Its source is `portal-v4/app.js` in the design session's scratchpad. The prototype is a picture of the design. Where this spec and the prototype differ, this spec wins.

## Goals and non-goals

Goals:

- Fellows and students do all their work in the portal and never need `/admin`.
- Admins review, decide applicants and publish from the portal. They keep `/admin` for settings and for everything the portal does not cover.
- One status model, one task list and one design language on every screen, so the portal needs no explanation.
- Access rules guard every read and write. A field the portal does not show is not a guard.
- The portal meets WCAG 2.2 AA (see [Accessibility baseline](#accessibility-baseline)).
- After phase 7, `/admin` is closed to non-admins.

Non-goals:

- The portal does not replace the admin for admins. Cycles, registration, pricing, forms, enrollments and site settings stay in `/admin`.
- No seat limits on courses. No `.docx` upload. Authors write in the portal editor.
- No guided tour. Onboarding is a short checklist and role-specific empty states.
- No automatic notice when a session changes (D1).
- No server-side timer for the undo windows. The browser holds them (D15).
- No hiding of applicant money fields from fellows (D12).
- Programme applications are decided as a whole in `/admin`, as today. The applicants board holds course choices only.
- Students have no enrollments page. A student sees the courses they take as spaces and on the calendar (see [Calls](#calls-this-spec-makes-that-no-decision-covers)).
- Applicants have no portal and no status page. Their only touchpoints are the emails the code sends today, among them the decision emails of `src/forms/application-decision.ts`.

## Users and flows

Three roles use the portal.

- **Admin.** Runs cycles, decides applicants, reviews articles and courses, publishes.
- **Fellow.** Teaches one or more courses. Edits the non-admin fields of their courses, proposes new courses, writes articles, and writes the assessments of the students in their courses (D18). Sees the applicants of their own courses, money fields included (D12). Never decides.
- **Student** (`member` and `non_degree_seeking`). Joins spaces, writes articles and submits them for review.

### Handoff matrix

Each row is one handoff. "Told" means a notification row in the bell, its push when the reader allows push, and the email the code already sends, unless the row says otherwise. The section named in the last column holds the rule. This table does not restate rules.

| #   | Transition                                    | Who acts, where                                            | Who is told                                                                    | What each role sees next                                                                                                          | Rule in                                                                           |
| --- | --------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Owner submits an article or a course          | Owner, editor, **Submit for review**                       | Admins: `submitted`                                                            | Owner: Submitted, form locked, **Withdraw**. Admin: one task, in To review and in Needs you                                       | [Status model](#status-model-statusof), [Review and history](#review-and-history) |
| 2   | Owner withdraws a submission (D3)             | Owner, editor, **Withdraw**                                | Admins: `withdrawn`, in the bell only. No email                                | Owner: Draft, form open. Admin: the task leaves To review and Needs you                                                           | [Review and history](#review-and-history)                                         |
| 3   | Admin asks for changes                        | Admin, review pane, note required                          | Owner: `changes_requested`, after the undo window                              | Owner: Changes requested, the note in the banner, a Needs you row. Admin: the row leaves To review                                | [Review and history](#review-and-history)                                         |
| 4   | Owner submits again                           | Owner, editor                                              | Admins: `submitted`                                                            | Admin: the row returns with "Round n", the history and the diff (D9)                                                              | [Review and history](#review-and-history)                                         |
| 5   | Admin approves and publishes an article       | Admin, review pane, **Publish as** (D6)                    | Owner: `approved`, naming the tier, after the undo window                      | Owner: Published, **View on the site**                                                                                            | [Review and history](#review-and-history)                                         |
| 6   | Admin approves and publishes a course         | Admin, review pane, **Cycle** and **Tier** (D10)           | Owner: `approved`, after the undo window                                       | Owner: Published. The course is on the site at the chosen tier. Each listed fellow gets the fellow role                           | [Review and history](#review-and-history)                                         |
| 7   | Admin declines                                | Admin, review pane, note required                          | Owner: `rejected`, after the undo window                                       | Owner: Declined and the note, in the bell and in the list's Closed group. No Needs you row, because a decline asks for no work    | [Tasks and the bell](#tasks-needsuser-and-the-bell)                               |
| 8   | Owner asks to remove a published item         | Owner, editor menu, **Request removal**                    | Admins: `submitted` (removal note)                                             | Owner: Published plus Removal requested. Admin: one task, in To review and in Needs you                                           | [Status model](#status-model-statusof)                                            |
| 9   | Admin removes, or keeps with a note           | Admin, review pane                                         | Owner: `removed`, or `rejected` with the keep note, after the undo window      | Owner: the item leaves the site, or Published plus Kept on the site                                                               | [Status model](#status-model-statusof)                                            |
| 10  | Fellow edits a published course               | Fellow, course form                                        | Nobody until they submit                                                       | Fellow: Published plus Unsent edits. The site keeps the live version                                                              | [Course form](#course-form-and-the-sessions-calendar)                             |
| 11  | Fellow changes sessions of a published course | Fellow, course form or space Calendar tab                  | Nobody automatically. The optional prefilled announcement tells the space (D1) | Members: the calendar and the syllabus show the change                                                                            | [Course form](#course-form-and-the-sessions-calendar)                             |
| 12  | Applicant applies                             | Applicant, public form                                     | Admins and the fellows of the chosen courses: `application`                    | Admin: a card in Waiting, a Needs you row. Fellow: a card in Waiting, view only                                                   | [Applicants board](#applicants-board)                                             |
| 13  | Admin decides an applicant                    | Admin, applicants board                                    | Applicant: email after the undo window                                         | Admin: the ring, then Email sent. Fellow: the card in its new lane on the next load. Other admins: nothing until the commit (D15) | [Applicants board](#applicants-board)                                             |
| 14  | Admin reopens a decided applicant             | Admin, applicants board, **Move to** Waiting               | Nobody. No email                                                               | Admin and fellow: the card in Waiting                                                                                             | [Applicants board](#applicants-board)                                             |
| 15  | Accepted student signs in for the first time  | Student, set-password link from the email, then the portal | Admins: `joined`, as today                                                     | Student: Home with the first-run checklist                                                                                        | [Onboarding](#onboarding)                                                         |
| 16  | Fellow writes an assessment                   | Fellow, Participants page (D18)                            | Nobody                                                                         | Fellow and admins: the assessment on the enrollment. The student never sees it                                                    | [Participants](#participants-and-assessments-d18)                                 |

Two handoffs have no notice, by decision:

- Fellows get no notification when an admin decides one of their applicants. The board shows the decision. No decision above needs a `decided` kind, so the portal adds none.
- Members get no automatic notice when a session moves (D1).

## Design language

The prototype, [CILAS portal prototype](https://claude.ai/artifact/EAKLx74CwTcbJGEqtPiUDH), holds the full design language. These are its rules in short. Every screen obeys them.

- **Status.** One table of statuses with a tone, an icon and a label. One function renders a badge and one renders the next action. No other code writes a status word or picks a status colour. Colour follows the record, not the viewer. Colour is never the only cue: the icon and the label always show. Green means only accepted or published. See [Status model](#status-model-statusof).
- **Buttons.** Four levels. Primary: `--foreground` fill, pill, at most one per surface. Secondary: 1px `--border-strong` outline. Quiet: text in `--text-secondary`. Quiet danger: text in `--danger`, never a red fill. Height 36px, 44px under `(pointer: coarse)`. Labels are a verb and an object.
- **Targets.** Every interactive element is at least 24x24px (WCAG 2.5.8) and at least 44x44px under `(pointer: coarse)`. This includes row links, chips, nav rows, the **Move to** button and the ring. Padding extends the hit area. Two hit areas never overlap.
- **Surfaces.** Four levels. L0 page and sidebar. L1 the inset shell, radius 24. L2 a card, 1px `--border`, radius 16, padding 16. L3 floating (popover, menu, sheet, palette, toast) on `--surface-raised` with `--shadow-floating`. A card never holds a bordered or tinted tile. Inside a card, rows are divided by a hairline. A kanban lane is a tinted region, and a kanban card is an L2 card.
- **Radius.** `--radius-inner` 8px, `--radius-control` 12px, `--radius-panel` 16px, `--radius-surface` 24px, and round for buttons, chips, badges, avatars and the ring. No other values.
- **Type.** Six sizes and two weights: caption 12px, meta 13px, body 15px, section heading 17px, page title 28px, display 34px. Weights 400 and 500. Inputs are 16px under `(pointer: coarse)`. Counts and times use `tabular-nums`.
- **Contrast.** Text is at least 4.5:1 against its background, and large text, icons and control borders are at least 3:1 (WCAG 1.4.3, 1.4.11). In light mode `--text-muted` is about `oklch(52% 0 0)` or darker, so 12px muted text passes. Phase 1a commits a measured table of each badge tone and each muted token in light, dark and increased contrast, as the unit test `tests/unit/portal-contrast.unit.spec.ts`. The test computes each ratio from the tokens and fails when one drops below its limit. The Next session tile sets its overlay opacity so its text passes 4.5:1 over a white cover, the worst case.
- **Page header.** H1 28px, a 15px subtitle, and a slot for at most one primary and one secondary button. In the article editor the H1 is the title field. In the course form the H1 is the page name: "Propose a course", "Edit course" or "Course" (read-only).
- **List rows.** Every row has a 40x40 slot, radius 8. A row with no cover shows an empty `--surface-muted` slot, with no letter and no icon.
- **Counts.** Two looks only. Work for you is a muted tabular number. Unread posts are a red numbered circle on space rows and space avatars. In the folded sidebar, a work count is a muted number chip ("9+" above 9). Every count has an accessible name (see [Navigation](#navigation)).
- **Translation state.** The writing-language switch shows a translation state from one function `langState(locale)`: "English · complete", "عربي · 2 not translated", "عربي · not started". The word "missing" belongs to the submit gate only.
- **Toasts.** The portal uses the site's one toast host: the Arc `ToastStack` that `SiteToasts` mounts in the root layout (`src/components/site-toasts.tsx`). The portal adds no second host. A portal toast lives 8 s. Hover, focus and a hidden tab pause it. A toast never dismisses while it has focus, and it never takes focus on its own. It survives a route change, because the host sits above the route groups. Phase 1a edits the vendored `ToastStack` so that the host shows above an open modal `<dialog>`, for example as a popover in the top layer that shows again after a dialog opens. If the browser keeps that toast inert while a modal is open, a toast raised while a modal is open shows its text in the modal's own status line instead. The phase 1a e2e decides which of the two ships. A pending-decision toast is the exception to the 8 s rule: the pending timer owns it (see [Pending decisions](#pending-decisions-and-the-undo-window)). Every action in a toast also exists where the reader acted: the pending line, the restore line, the field error, the failed row with **Try again**, and for "Checklist hidden" the palette command. A toast never holds the only path to an action. The host's existing Alt+T key moves focus into it (`src/components/arc/toast-stack/toast-stack.tsx:743-755`). The portal adds no other key, and no action depends on Alt+T.
- **Undo, not confirm.** Reversible actions show an Undo. A confirm dialog appears only for an irreversible delete (hold to delete, then confirm). **Withdraw** undoes **Request removal**. **Discard my changes** commits at once. The page then shows a line "Your changes were discarded." with **Restore them**. The line stays until the owner edits again or leaves the page. **Restore them** is a draft save of the reviewed fields of the version before the discard. The toast repeats the line, but the line is the keyboard path.
- **Success moments.** One component, `SuccessCheck`, draws a check once. It shows on "Email sent" and on "Decided". Under reduced motion it shows the text only. The owner's action area keeps its width across **Submit**, Submitted and **Withdraw**, so nothing shifts.
- **Motion.** 120 to 200 ms, `--ease-standard`, no scale on panels. The palette is the one exception: it fades in and out in 80 to 150 ms, with no movement. Every animation has a reduced-motion branch with no movement:

  | Animation                 | Normal                                      | Reduced motion                                                                  |
  | ------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
  | Pending ring              | drains over the window                      | no arc. The remaining whole seconds as text, updated each second, `aria-hidden` |
  | Card move between lanes   | height and fade                             | the card appears in place                                                       |
  | New card in a lane        | height and fade                             | appears in place                                                                |
  | Sheet, drawer, More sheet | slide in and out                            | open and close at once                                                          |
  | Toast                     | rises in                                    | appears in place                                                                |
  | Palette                   | fades in and out, 80 to 150 ms, no movement | appears in place                                                                |
  | Success check             | draws once                                  | text only                                                                       |

- **Language.** Every portal string is in `messages/en.json` and `messages/ar.json` under the `Portal` namespace. Plurals use ICU plural forms in next-intl, never string joins. CSS uses logical properties only. Keys and shortcuts sit in `<bdi dir="ltr">`.
- **RTL and language.** Directional icons (arrows, chevrons, the back link) mirror in Arabic. Each localized field carries `lang` and `dir` for its writing language (WCAG 3.1.2). User text, such as applicant answers and names, gets `dir="auto"`. A name inside running text sits in `<bdi>`, so a Latin name or a number does not break an Arabic line. Choose images per language where a picture holds text or a cultural cue. Do not mirror photos. Source: [portal-research.md](2026-11-18-portal-research.md), Arabic and English (RTL). The writing-language switch has an accessible name with its state, for example "Write in Arabic, 2 not translated". A locked form hides the switch.
- **Components.** Arc UI from `src/components/arc`. Arc Pro blocks may inspire a layout. Their source is never copied.

## Accessibility baseline

The target is WCAG 2.2 AA on every portal page. Phase 1a builds the shared parts below in the shell, and every later phase uses them.

- **Landmarks.** One skip link to `#main` as the first focusable element. One `<main id="main">`. The sidebar and the bottom bar are each a `<nav>` with an `aria-label`. The current nav item has `aria-current="page"`.
- **Live region.** One polite live region in the shell (`role="status"`, a stable empty node). Every feature announces through one function, `announce(message)` in `src/portal/feedback/`. It sets the text one frame after it clears the node, so a repeated message is read again.
- **Toast host.** The site's `ToastStack` (see Toasts in [Design language](#design-language)). It is a labelled `<section>` with its own polite live region (`toast-stack.tsx:785-791`), which reads the toast text. A message goes to a toast or to `announce()`, never to both.
- **Focus.** One `:focus-visible` ring token for every control. No ring on pointer focus. A sticky bar never hides the focused control (WCAG 2.4.11). Pages with a sticky bar (the phone review pane, the Save schedule bar, the bottom bar) set `scroll-padding-block-end` to the bar height. On a phone the toast host sits above the bottom bar and `env(safe-area-inset-bottom)`. While a toast shows, its height joins `scroll-padding-block-end`, and focus that the portal moves is scrolled into view above the toast.
- **Modal surfaces.** Every sheet, drawer and dialog in the portal is modal. Among them are the applicant sheet, the assessment sheet, the session drawer, the material dialog, the announcement offer, the More sheet and the palette. Each one traps focus, makes the rest of the page inert and closes on Esc. Each one has its own status line, a polite live region inside it, for the toast fallback (see Toasts in [Design language](#design-language)). Each one uses a native `<dialog>` with `showModal()`, or the Arc component that does the same. On close, focus returns to the trigger. If the trigger is gone, focus moves to the next card or row. When a sheet changes between its phone and desktop form on resize, focus stays on the same control. The bell popover is not modal: it closes on Esc and returns focus to the bell.
- **Menus.** **Move to**, the account menu and the block menu follow the WAI-ARIA menu button pattern, with `aria-haspopup` and `aria-expanded`.
- **Rows and cards with actions.** A row or card that holds a button is a container, not a link. Its title is the link, or on a board card, the button that opens the sheet. **Undo**, **Move to**, the ring, **Try again** and the quiet links of a course row are siblings of that title, never inside it.
- **Busy state.** A card or row whose decision is pending has `aria-busy="true"`.
- **Forms.** A field error sits under its field. The field gets `aria-invalid` and `aria-describedby` to the error, and focus moves to the first field in error. Buttons are never disabled for missing input. They validate on press.
- **Drag.** Every drag has a single-pointer path and a keyboard path (WCAG 2.5.7). The board has **Move to**. The calendar has **Add session**, the block menu and its keys.
- **Time limits.** Every undo window can be paused (WCAG 2.2.1). See [Pending decisions](#pending-decisions-and-the-undo-window).

Tests: axe runs on every portal route, as each role, in English and Arabic, with no violations. Each feature has a keyboard-only e2e walk. The shell, Home, the board and both editors also run at 320px width and at 200% zoom with no horizontal scroll and no lost content (WCAG 1.4.10).

## UI skills: which one, when

Each skill is loaded only when the task matches what it does. Every task in the implementation plan has a "Skills:" line that names only the skills it needs. Delegated implementers load the listed skills before they edit. Do not load every skill for every task.

| When the task...                                                                                           | Load                                        | What it gives                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Writes any HTML, CSS or client JS (always first for web UI)                                                | modern-web-guidance                         | Current platform patterns: dialog, popover, anchor positioning, container queries, forms, view transitions |
| Uses or adds an Arc component or block                                                                     | arc (with the arc MCP `get_component`)      | The right component, documented props, Arc tokens and copy rules, the Pro boundary                         |
| Lays out a page or component: grouping, spacing, reading order, breakpoints, RTL direction                 | better-layout                               | Structure, progressive disclosure, logical properties                                                      |
| Sets type: scale, weights, truncation, tabular numbers, Arabic and Latin pairing                           | better-typography                           | Type scale and text rules                                                                                  |
| Picks or changes colors, status colors, dark mode, contrast                                                | better-colors                               | OKLCH tokens, contrast checks, the meaning of color                                                        |
| Polishes visual details: borders, shadows, radii, icons, hover and press states                            | better-ui                                   | Design-engineering details                                                                                 |
| Builds an interaction detail that no narrower skill covers (popover origin, press feel, drag details)      | emil-design-eng                             | Interaction polish rules                                                                                   |
| Builds keyboard paths, focus, ARIA, live regions, form errors, touch targets                               | better-accessibility                        | WCAG 2.2 AA implementation rules                                                                           |
| Finishes a screen with real data, before its PR                                                            | break-ui                                    | Worst-case data: long Arabic names, zero and huge counts, missing fields                                   |
| Writes or edits user-facing copy (English or Arabic)                                                       | better-writing, then humanizer              | Labels, empty states, errors, with AI-sounding text removed                                                |
| Adds a new animation or transition                                                                         | animate, then transitions-dev               | Whether it should animate, its purpose, curve and interruption, and drop-in snippets                       |
| Tunes motion that already exists                                                                           | transitions-polish                          | The token scale for duration, easing, stagger, open and close asymmetry                                    |
| Looks for places that should animate                                                                       | find-animation-opportunities                | A read-only list with exact values                                                                         |
| Needs the name of a motion effect                                                                          | animation-vocabulary                        | The exact term                                                                                             |
| Builds gesture, drag, sheet, spring or material-depth behavior (kanban drag, bottom sheet, countdown ring) | apple-design                                | Fluid, interruptible, physical motion, and reduced motion                                                  |
| Has two or more real shapes for a component or module API                                                  | design-an-interface                         | Parallel, very different designs to compare                                                                |
| Reviews a whole screen or flow at the end of a phase                                                       | better-interface (full), ux-auditor         | A cross-discipline review, and a heuristic and WCAG audit with severities                                  |
| Is not sure which skill fits                                                                               | ask-emil                                    | A router over the skills                                                                                   |
| Changes a Payload collection, field, access rule, hook or endpoint                                         | payload (`.agents/skills/payload/SKILL.md`) | Payload's config, access and hook rules                                                                    |
| Changes `src/components/calendar/ui/` or the board in `src/components/board/ui/`                           | ui-sdk (`.agents/skills/ui-sdk/SKILL.md`)   | The installed ui-sdk API. `AGENTS.md` requires it before a calendar change                                 |
| Writes any code (every task)                                                                               | tdd                                         | Test first, then the code                                                                                  |
| Reviews a phase with no screen                                                                             | code-review, then security-review           | A diff review, and a review of access and write paths                                                      |

The last task of each phase is its review task, and each phase block names it in its Review line. A phase that ships a screen runs ux-auditor and better-interface on its screens, then break-ui, before the PR. A phase with no screen (phase 0, the spike, 4b, 4c and 4d) runs code-review, then security-review.

## Architecture

### Frame (D11)

The frontend splits into two route groups under the one root layout `src/app/(frontend)/[locale]/layout.tsx`:

- `(site)` holds the public site: every folder under `[locale]/` today except `spaces/`, among them `(home)`, `[...path]`, `articles`, `login`, `welcome`, `settings`, `profile` and `apply`. The deadlines bar, the site header, the `max-w-page` main and the footer move from the root layout (`[locale]/layout.tsx:100-112`) into `(site)/layout.tsx`. The root layout keeps the providers, `SiteToasts` and `PushRegistrar`, so the toast host and push registration serve the portal too. `opengraph-image.tsx` stays at `[locale]`. The plan checks where `not-found.tsx` must sit so that a not-found page keeps the site header.
- `(portal)` holds `/spaces` and everything under it. `(portal)/spaces/layout.tsx` renders the portal shell.

Route groups that share a root layout navigate without a full reload (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md:28-32`).

The portal shell:

- An inset sidebar on the L0 tint and the main area as the L1 surface.
- The top of the sidebar holds the bell (the existing `NotificationCenter` from `src/components/site-notifications.tsx`) and the account menu. From phase 6, the search button for the palette sits under them.
- `[` folds the sidebar. The key works only while focus is inside the sidebar (WCAG 2.1.4, active only on focus). It is read by position (`event.code` `BracketLeft`). A fold toggle button does the same and has `aria-expanded`. The folded state is remembered per user, in client storage keyed by the account id (no new field, no migration). Folded, nav rows show their icon and a muted count chip, and spaces show as round cover avatars with red unread counts. Folded, each nav row and space avatar keeps its label as visually hidden text, with the count text of [Navigation](#navigation). It shows the label in a tooltip on hover and on keyboard focus.
- Under 700px the sidebar is replaced by a bottom bar: Home, Inbox, Calendar and More. The bar holds 3 to 5 items plus More, in the same order as the sidebar. Source: [portal-research.md](2026-11-18-portal-research.md), Shell and navigation. Until phases 1c and 1d ship Inbox and Calendar, the bar holds Home and More. More opens a sheet with the other nav items, and from phase 6 a Search row first. The phone page header holds the bell, and from phase 6 a 44px Search button.
- The shell holds the live region and the skip link (see [Accessibility baseline](#accessibility-baseline)). From phase 2 it also holds the pending-decisions provider (see [Pending decisions](#pending-decisions-and-the-undo-window)). The toast host is the site's, in the root layout.

**Space routes in their own group.** The space pages and their `@dialog` slot move into `(portal)/spaces/(rooms)/`: `(rooms)/[kind]/[slug]`, `(rooms)/community` and `(rooms)/@dialog/…`. `(rooms)/layout.tsx` checks the spaces "off" switch once, for every space page and every dialog route, and returns not found. It replaces the check at `spaces/layout.tsx:22`, and no other file returns not found for it. Today's `/spaces` page (`spaces/page.tsx:88-120`) sits outside `(rooms)` until phase 1c replaces it, and it calls `mySpaces` with no check of its own. From phase 1a until 1c, that page reads the mode and, with spaces off, skips `mySpaces` and shows its shortcut list, or its empty state when the reader has no shortcut. Phase 1c deletes the page with that read. It also holds the 1200px frame of today's spaces layout (`spaces/layout.tsx:26`), which applies only to space pages. A new space route under `(rooms)` gets the check with no extra code.

The `@dialog` slot keeps its `default.tsx` and adds `[...catchAll]/page.tsx`, which returns `null`. A soft navigation inside `(rooms)` to a route that the slot does not match keeps the old slot content visible (`parallel-routes.md:485`), so without the catch-all an open post dialog stays over the next space page. A navigation out of `(rooms)` unmounts the slot with its layout.

A post link from a page outside `(rooms)`, such as Home, opens the full post page. Inside a space it opens the dialog. The phase 1a e2e checks both, and that an open dialog closes on a navigation to another space page.

Home, Inbox, Calendar, Articles, Courses, Applicants, To review, Participants and Account work with spaces off. Home then hides "Your spaces", and the sidebar hides the spaces list.

The portal layout requires a signed-in reader. With no reader it redirects to `/{locale}/login?next=…`, as the spaces layout does today.

### Routes

All under `src/app/(frontend)/[locale]/(portal)/spaces/`. Moving `spaces/` under a group keeps the `@dialog` intercepts working, because groups and slots are not route segments (`intercepting-routes.md:54`).

| Path                                                 | Page                               | Roles                       |
| ---------------------------------------------------- | ---------------------------------- | --------------------------- |
| `/spaces`                                            | Home                               | all                         |
| `/spaces/inbox`                                      | Inbox: Needs you, then Latest      | all                         |
| `/spaces/calendar`                                   | Calendar tab                       | all                         |
| `/spaces/articles`                                   | Articles list                      | all                         |
| `/spaces/articles/new`, `/spaces/articles/[id]`      | Article editor                     | all                         |
| `/spaces/courses`                                    | Courses list                       | fellow, admin               |
| `/spaces/courses/new`, `/spaces/courses/[id]`        | Course form                        | fellow, admin               |
| `/spaces/courses/[id]/participants`                  | Participants and assessments (D18) | the course's fellows, admin |
| `/spaces/applicants`                                 | Applicants board                   | fellow, admin               |
| `/spaces/review`, `/spaces/review/[collection]/[id]` | To review list and pane            | admin                       |
| `/spaces/account`                                    | Profile and settings (D5)          | all                         |
| `/spaces/[kind]/[slug]`, `/spaces/community/…`       | Spaces, unchanged, under `(rooms)` | members of the space        |

Static segments win over `[kind]`, and `[kind]/[slug]/page.tsx` already refuses any kind other than `course` and `cohort` (line 31).

`/profile` and `/settings` stay in `(site)` as redirects: `/settings` goes to `/spaces/account`, and `/profile` goes to `/spaces/account#profile`.

### Feature folders

Portal code lives in `src/portal/<feature>/`. Each folder holds its server reads, its server actions and its client parts. The route files under `(portal)/spaces/` only compose them.

| Folder                       | Holds                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/portal/nav/`            | `portalNav(user)`, the shell, the bottom bar                                                                               |
| `src/portal/feedback/`       | the live region and `announce()`, the empty-state component, `SuccessCheck`                                                |
| `src/portal/pending/`        | the pending-decisions provider and its state machine                                                                       |
| `src/portal/needs/`          | `needs(user)`, `needsCounts(user)`                                                                                         |
| `src/portal/home/`           | Home cards                                                                                                                 |
| `src/portal/lists/`          | the shared row, the Articles and Courses lists                                                                             |
| `src/portal/review/`         | To review list, review pane, history, diff                                                                                 |
| `src/portal/applicants/`     | the board, cards, sheet                                                                                                    |
| `src/portal/course-form/`    | `saveCourse`, the form, the section rail                                                                                   |
| `src/portal/participants/`   | `participantsFor`, the Participants page and the assessment sheet                                                          |
| `src/portal/rich-text/`      | the portal Lexical editor core and the locked node, shared by the course form, the assessment sheet and the article editor |
| `src/portal/article-editor/` | the article nodes, toolbar, save action                                                                                    |
| `src/portal/palette/`        | the command registry, the palette and `searchMyWork`                                                                       |
| `src/portal/onboarding/`     | the checklist                                                                                                              |
| `src/portal/account/`        | the account page groups                                                                                                    |

Rules that the admin and the portal both need stay in `src/lib/` and the portal imports them: `review.ts`, the new `review-status.ts`, `reviewed-fields.ts`, `review-history.ts`, `document-href.ts`, `course-submit-gate.ts` and `rich-text-guard.ts`, and `meetings.ts`. The calendar stays in `src/components/calendar/`. The generic board goes in `src/components/board/ui/` (D13). Neither knows about the portal.

### Data access rule

Access rules are the gate. REST, GraphQL and `/api/mcp` stay open, so every portal read and write uses one of two patterns. Each module states which one.

- **Gated read.** For collections with real access rules (articles, courses, sessions, enrollments, notifications, media, people): the Local API with `user` and `overrideAccess: false`. The calendar actions already do this (`src/actions/save-schedule-edits.ts:47-48`, `src/lib/calendar-sources.ts:296-302`).
- **Projection.** For data that the access rules do not let the reader read, one module reads with `overrideAccess: true`, filters by viewer and drops fields. No second projection of the same data exists.
  - `form-submissions` (`src/payload.config.ts:357`): `applicantsFor` and `searchApplicants` in `src/forms/applicants.ts`. The board calls `applicantsFor`. The palette calls `searchApplicants`.
  - `review-events`: `reviewHistoryFor(collection, id, user)` in `src/lib/review-history.ts`. It gates on the version access, not on a read of the document, because any member reads a published document (`readTiers`, `src/access.ts:262-284`). Only a current owner (the latest version lists them) or an admin reads the history. It first runs `findVersions({ where: { parent: { equals: id }, latest: { equals: true } }, limit: 1, user, overrideAccess: false })`. The version access lets only admins and owners through (`readVersions: isAdminOrOwn(owned, { versions: true })`, `Articles.ts:50`, `Courses.ts:124`). Without `latest`, any old version that lists the reader passes, and a removed author keeps the history. An author who is removed in a copy that is not approved yet loses it at once. If that read finds a version, it returns the events as `{ at, from, to, note, actorName }`, with no user relation. Otherwise it returns nothing.
  - `people` for the Participants page: `participantsFor(course, user)` in `src/portal/participants/`. A person made for an accepted applicant is hidden by default (`People.ts:42-50`, `visible` with `defaultValue: false`), and `readPeople` lets a fellow read only visible people (`src/access.ts:99-104`). The function first reads the course with a gated read and requires `isAdminUser(user)` or the reader's person in `course.fellows`. Otherwise it returns not found, because `readEnrollments` also lets a fellow read their own enrollments as a student (`src/access.ts:198-204`). Then it reads the course's enrollments with a gated read as `user`, and reads `people` with `overrideAccess: true` for those person ids only. It returns `{ enrollment, name, photo, status, hasAssessment }`.

`getReviewQueue` reads with `overrideAccess: true` (`review-queue.ts:31`). Every portal caller checks that the reader is an admin before it calls it.

One function owns each rule: status words, next actions, `needs()`, nav items, document links. Lists, Home, the sidebar, the palette and the emails call it.

### Lazy loading rule

- First-render content renders on the server: Home, the lists, the To review list and the board lanes.
- UI that shows only after an action uses `preloadable` (`src/lib/preloadable.tsx`): the applicant sheet, the assessment sheet, the session drawer, the material dialog, the announcement offer and the pending-decision toast. The trigger calls `X.preload` on `onPointerEnter`, `onFocus` and `onPointerDown`.
- The palette is `preloadable`. It has no pointer trigger for Cmd+K, so the shell calls its `preload` when the browser is idle after the first render. The chunk of the Site group's search adapter loads when the palette opens, and it preloads on hover of the search button and when the browser is idle.
- The pending-decisions provider (from phase 2) renders on first render, not lazily, because it owns the `pagehide` and `visibilitychange` listeners.
- The article editor and the course calendar are the main content of their page. They use `next/dynamic` with a skeleton, as `StudyGrid` does (`src/components/study-list.tsx`).
- The heavy `getReviewQueue` (`src/lib/review-queue.ts:30-56`) and the full `applicantsFor` load only on To review, the board, and an admin's Home and Inbox. The layout calls only `needsCounts()` (see [Tasks](#tasks-needsuser-and-the-bell)). The palette's My work uses `searchMyWork`, which takes at most 5 rows per kind.

## Navigation

**Behavior.** One function, `portalNav(user)` in `src/portal/nav/`, returns the nav items as `PortalNavItem { key, labelKey, group, href, icon, count }`, where `labelKey` is a key under `Portal.nav`, and `count` is a number, or `null` for an item that shows no number. The sidebar, the bottom bar, the More sheet and the palette "Go to" group render it.

| Item           | Student | Fellow   | Admin | Count                                                                |
| -------------- | ------- | -------- | ----- | -------------------------------------------------------------------- |
| Home           | top     | top      | top   | none                                                                 |
| Inbox          | top     | top      | top   | total of `needs(user)`                                               |
| Calendar       | top     | top      | top   | none                                                                 |
| Articles       | My work | My work  | Admin | own items in Needs you (admin: none)                                 |
| Courses        |         | My work  | Admin | own items in Needs you (admin: none)                                 |
| Applicants     |         | Teaching | Admin | admin: applicants waiting. Fellow: none, because a fellow cannot act |
| To review      |         |          | Admin | review rows                                                          |
| Open dashboard |         |          | Admin | none. Links to `/admin`                                              |

Below the groups come the reader's spaces, each with its red unread count. The account menu holds: Profile and settings (`/spaces/account`), Language, Theme, Sign out. Its keys follow the WAI-ARIA menu pattern. On a phone, the same four rows close the More sheet. From phase 2, **Sign out** first sends and awaits every pending decision (see [Pending decisions](#pending-decisions-and-the-undo-window)), then signs out.

Each count has an accessible name on its link, in visually hidden text: "Inbox, 3 tasks", "Course name, 4 unread posts". "9+" reads as "more than 9".

On a phone the bottom bar is a `<nav aria-label="Main">` whose current item has `aria-current="page"`. Each item is at least 44px high. The bar sits above `env(safe-area-inset-bottom)`. More is a button with `aria-expanded` that opens the More sheet as a modal surface.

`workViewsFor()` (`src/components/admin/work-views.ts:15-31`) keeps only the admin top bar, and its links stay in the admin. The `/spaces` shortcuts into `/admin` (`spaces/page.tsx:44-80`) are removed in phase 1c. Admins reach the admin from **Open dashboard**.

**Data.** Counts come from `needsCounts(user)`, which the layout calls once per request, and from the existing unread counts of spaces. See [Tasks](#tasks-needsuser-and-the-bell).

**Access.** The nav is a view. Each page checks the role on the server and returns not found for a role that may not open it.

**Errors.** If the count query fails, the nav renders with no counts and logs the error. The page still loads.

**Tests.** E2E per role at 1440px and 390px: the right items show, in the right groups, with the right counts and their accessible names. With spaces off, the spaces list is gone and Home, Articles and Courses load. Folded, each link has the same accessible name as unfolded. These checks live in `portal-shell`. Each phase adds the assertions for the items it ships (see the target table in [Phases](#phases)).

## Status model: `statusOf`

**Behavior.** One pure function, `statusOf({ doc, draft })` in `src/lib/review-status.ts`, returns one `StatusKey` for an article, a course or a publication. `doc` is the published row, or the draft row when the document was never published. `draft` is the latest version (`find({ draft: true })`), or `null`. The portal lists, the editors, Home, the palette and the admin review queue call it.

```ts
type StatusInput = { doc: ReviewedDoc; draft: ReviewedDoc | null }
// ReviewedDoc: an article, course or publication row with _status, review, updatedAt and its reviewed fields
type StatusBadge = { tone: 'neutral' | 'info' | 'warning' | 'danger' | 'success'; icon: string; labelKey: string }
statusOf(input: StatusInput): StatusKey
statusBadge(key: StatusKey): StatusBadge[] // one badge, or two on a live item with a draft copy
nextAction(key: StatusKey, viewer: 'owner' | 'admin'): { labelKey: string } | null
waitsOn(key: StatusKey): 'owner' | 'admin' | null
neverPublished(doc: ReviewedDoc): boolean
```

| Key                        | When                                                                                                                                         | Badges (tone, icon)                                       | Owner's next action                                                   | Admin's next action                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| `draft`                    | not live, `review.status` draft                                                                                                              | Draft (neutral, `pencil-line`)                            | Continue writing, then submit                                         | none (admins do not see other people's drafts)   |
| `submitted`                | not live, submitted                                                                                                                          | Submitted (`--info`, `clock`)                             | With an admin. **Withdraw** returns it to Draft                       | Approve and publish, ask for changes, or decline |
| `changes_requested`        | not live, changes requested                                                                                                                  | Changes requested (`--warning`, `message-square-warning`) | Read the note, edit, submit again                                     | Waiting on the author                            |
| `rejected`                 | not live, rejected                                                                                                                           | Declined (`--danger`, `circle-x`)                         | Read the note. Duplicate as a new draft, or delete                    | none                                             |
| `published`                | live, and no draft copy, or a draft copy at `approved` or `draft` that equals the live row                                                   | Published (`--success`, `globe`)                          | View on the site. Edits wait for review                               | none                                             |
| `published_unsent`         | live, and a draft copy that differs from the live row (`hasUnsentEdits`), at `approved` or `draft`, or at `rejected` with `request: removal` | Published, plus Unsent edits (neutral, `file-pen`)        | Submit changes for review, or discard them                            | none                                             |
| `published_edits`          | live, draft copy submitted with `request: changes`                                                                                           | Published, plus Edits in review (`--info`, `file-clock`)  | With an admin. The live version does not change. **Withdraw changes** | Review the changes                               |
| `published_removal`        | live, draft copy submitted with `request: removal`                                                                                           | Published, plus Removal requested (neutral, `archive-x`)  | With an admin. **Withdraw** keeps it on the site                      | Remove, or keep with a note                      |
| `published_edits_returned` | live, draft copy changes requested                                                                                                           | Published, plus Changes requested (`--warning`)           | Read the note, edit, submit again                                     | Waiting on the author                            |
| `published_edits_declined` | live, draft copy rejected, `request: changes`, or `request: null` on a row declined before phase 1b                                          | Published, plus Edits declined (`--danger`)               | Read the note. Discard the edits, or edit and submit again            | none                                             |
| `published_removal_kept`   | live, draft copy rejected, `request: removal`, and the copy equals the live row                                                              | Published, plus Kept on the site (neutral)                | Read the note                                                         | none                                             |

Labels exist in English and Arabic in `messages/*.json` under `Portal.status`. `statusBadge(key)` renders the badges. `nextAction(key, viewer)` renders the next-action line.

**Who an item waits on.** `waitsOn(key)` is the one Needs you predicate. It returns `admin` for `submitted`, `published_edits` and `published_removal`, `owner` for `changes_requested` and `published_edits_returned`, and `null` for every other key. `needs()`, the Needs you group of each list and the admin's Waiting on the author group all read it.

**Never published.** `neverPublished(doc)` is true when the main row's `_status` is `draft`. It is the same fact that the owner delete rule reads (`isAdminOrOwn` with `draft: true`, `src/access.ts:141-160`). A document that an admin removed from the site also counts, because it is off the site.

**`review.request` stays until the next move.** Today the hook clears `review.request` on every move except a move to `submitted` (`review-hooks.ts:169-173`). Then a declined edit and a kept removal store the same facts, and `statusOf` cannot tell them apart. The change: on a live document, `request` stays through `changes_requested` and `rejected`. It clears on a move to `draft` (withdraw, discard) and on approval. A move into `submitted` from another state takes the `request` that the write sends, or `changes` when it sends none. It no longer falls back to the stored value (`review-hooks.ts:172`), because after a kept removal the stored value is `removal`, and a resubmitted edit would inherit it. A write that stays at `submitted` keeps the stored `request`, so an admin save of a waiting removal request does not reset it. The **Request removal** button, in the portal and in `/admin`, sends `request: removal` in the same write as the move. This change ships in phase 1b, while owners still submit from `/admin`. The old rule also stored `request: null` on a kept removal, so a kept removal from before phase 1b reads as Edits declined. Production is a beta with no real users, so the spec accepts that label on old rows and adds no data fix.

**Reviewed fields.** `src/lib/reviewed-fields.ts` holds, per collection, the list of fields that review covers: every field an owner may write, as the phase 0 audit lists it, minus `review`, `slug` and timestamps. Course `fellows` is a reviewed field. `hasUnsentEdits` and the diff both read this list.

`hasUnsentEdits(draft, doc)` compares the reviewed fields of the draft copy and the live row. It tells `published_unsent` from `published`. When the draft copy's `updatedAt` equals the live row's, it returns false with no field compare. Rich text compares without Lexical node ids and with `locale: 'all'`.

**Discard my changes.** Discard does not use `restoreVersion`. A restore runs the collection `beforeChange` hooks with `operation: 'update'` and the owner's draft copy as `originalDoc` (`payload/dist/collections/operations/restoreVersion.js:196-206`), and `applyReview` refuses it in every state: from `approved` by the decided-document rule (`review-hooks.ts:155-162`), and from any other state by the draft-save rule (`review-hooks.ts:135-141`). Discard is an owner draft save instead. It writes the live row's reviewed fields into the draft copy and keeps the copy's `review.status` when it is `approved` or `draft`. From `changes_requested` or `rejected` it moves the copy to `draft`. For that move, `LIVE_AUTHOR_MOVES` in `src/lib/review.ts:29-32` gets `changes_requested: ['draft']`, and its `rejected` entry adds `draft`. The save sends no email (`notifyOn` returns null for these moves). Only the two real moves (from `changes_requested` or `rejected` to `draft`) write a `review-events` row. The key then becomes `published`. **Restore them** is the undo of a discard (see Undo, not confirm in [Design language](#design-language)). It is an owner draft save that writes the reviewed fields of the version before the discard into the draft copy, so the key returns to `published_unsent` and no email goes. Discard, **Restore them**, their buttons and the `LIVE_AUTHOR_MOVES` change ship in phase 2.

Approval publishes at once, and the admin picks the cycle and the tier in the same step (D10). No state sits between approval and publication.

Applicants have their own statuses, on one choice of one application:

| Key        | Badge                                  | Admin's next action                                 | Fellow sees                        |
| ---------- | -------------------------------------- | --------------------------------------------------- | ---------------------------------- |
| `pending`  | Waiting (`--info`, `clock`)            | Accept or decline                                   | Waiting for an admin               |
| `accepted` | Accepted (`--success`, `circle-check`) | none. **Move to** Waiting reopens it, with no email | Accepted, with a link to the space |
| `rejected` | Declined (`--danger`, `circle-x`)      | none. **Move to** Waiting reopens it, with no email | Declined                           |

A decision inside the undo window is not a status. It exists only in the deciding admin's browser and shows as the ring (see [Pending decisions](#pending-decisions-and-the-undo-window)).

**Data.** No new fields. `statusOf` reads `_status`, `review.status`, `review.request` and the latest version.

**Access.** Gated read. An owner reads their own versions through the collection's version access. An admin reads all.

**Errors.** A combination that the table does not hold (for example a document that is not live with `review.status: approved`) returns `draft` and logs a warning with the document id.

**Tests.** A unit table test: each combination of the four facts gives one key. It covers both `published_unsent` shapes (a copy at `approved`, and a copy at `draft` after a withdraw), and it tells `published_edits_declined` from `published_removal_kept` by `request`. It covers the third `published_unsent` shape (a changed copy at `rejected` with `request: removal`), and a live copy at `rejected` with `request: null`, which reads as `published_edits_declined`. A unit test settles whether Payload leaves an equal draft version after a publish, and `hasUnsentEdits` returns false for it. Int, in phase 1b: a table test on the `applyReview` hook, one case per part of the `request` rule. A kept removal, then a resubmitted edit, gets `changes`. A write that stays at `submitted` keeps `removal`. Approval and withdraw clear `request`. `changes_requested` and `rejected` on a live document keep it. Int: a fellow edits a published course, and `statusOf` says `published_unsent`. After submit it says `published_edits`, and the public read still returns the old title. Int, in phase 2 with `review-events`: **Discard my changes** from a copy at `approved`, `draft`, `changes_requested` and `rejected`. Each one succeeds, publishes nothing, sends no email, and leaves the key `published`. The moves from `changes_requested` and `rejected` each write one `review-events` row, and the other two write none.

## Tasks: `needs(user)` and the bell

**Behavior.** Two lists with two meanings.

- **Needs you** is work. `needs(user)` in `src/portal/needs/needs.ts` returns the things this reader must do, as `NeedRow`. Each row is one link to `href`. The verb is its action label. A row runs no action in place. A row leaves when the state of its document changes.

```ts
type NeedKind = 'review' | 'edit_review' | 'removal_review' | 'applicants' | 'changes_requested'
type NeedRow = {
  kind: NeedKind
  verbKey: string
  href: string
  label: string
  count: number
  owner: { id: number; name: string } | null
}
```

| `kind`              | For                                                      | Verb (`Portal.needs.*`)  | `href`                                                    |
| ------------------- | -------------------------------------------------------- | ------------------------ | --------------------------------------------------------- |
| `review`            | admin, a submitted new item                              | Review                   | `documentHref`                                            |
| `edit_review`       | admin, `published_edits`                                 | Review the changes       | `documentHref`                                            |
| `removal_review`    | admin, `published_removal`                               | Decide on the removal    | `documentHref`                                            |
| `applicants`        | admin, one row with `count` n                            | Decide on {n} applicants | `/spaces/applicants` (`/admin/applicants` before phase 3) |
| `changes_requested` | owner, `changes_requested` or `published_edits_returned` | Read the note and edit   | `documentHref`                                            |

`owner` names the item's owner on an admin row, and is `null` on the reader's own rows. `label` is the document title in the reader's locale, or the title in the other locale when it has none. On the `applicants` row it is the verb text.

- **Latest** is information. It is the bell: the rows of the `notifications` collection, pushed live through the Postgres `LISTEN` hub (`src/lib/realtime/hub.ts`). A notification can be read while the work still waits, so no count of work comes from notifications.

Rows in `needs(user)`:

- Admin: one row per submitted article, course, publication, edit or removal request. One row "{n} applicants wait for a decision", with `count` n.
- Fellow and student: each own article or course whose `waitsOn(key)` is `owner`. `waitsOn` lives in `src/lib/review-status.ts`, and the list groups read it too. A declined item, declined edits and a kept removal ask for no work. The owner learns of them from the bell and the email, and the lists show them in their groups.
- Publication owners: until D16 is decided, a publication with changes requested reaches its owner through the bell and the email only. It has no Needs you row, because the portal has no publication page.

**Counts.** Each row has a `count`: 1, or n for the applicants row. Every total is the sum of `count`. Two functions read the same predicates:

- `needsCounts(user)` returns only the numbers. It uses `count` queries and `select`, plus `countWaitingApplicants` (in `src/forms/applicants.ts`) and `countReviewQueue` (in `src/lib/review-queue.ts`). The `where` fragments of its `count` queries sit next to `waitsOn` in `src/lib/review-status.ts`, built from one table of `{ key, where }`, so the two do not drift apart.
- An applicant count counts pending choices of course applications: one per course choice whose `decision` is null or `pending` (`src/forms/applicants.ts:126`). A programme application counts 0, because the board does not hold it. `payload.count` counts submissions, not choices, so the count is one `select` of `choices` with a reduce, or one grouped SQL query through the pool, as `claimDigest` does (`src/lib/space-digest.ts:170`). `countWaitingApplicants(user): { total: number; byCourse: Map<number, number> }` gives the total for the sidebar, the Needs you row and the Home card, and the count per course for the list rows. A fellow's result holds only the courses they teach.
- `countReviewQueue` counts the distinct document ids of the two queries in `getReviewQueue` (`review-queue.ts:44-52`), so a never-published submitted document counts once. The portal layout calls it once per request, and it feeds every number in the sidebar, the bottom bar and the Home card.
- `needs(user)` returns the full rows. Only Home and Inbox call it.

Where the two lists show:

| Place                                 | Shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home, Needs you card                  | `needs(user)`. With more than 5 rows, one row per kind with the sum of `count`. A grouped row links to the list of its kind: `review`, `edit_review` and `removal_review` to To review (`/admin/reviews` before phase 2), `changes_requested` to the Articles list filtered to Needs you when the group holds an article, and to the Courses list otherwise. `applicants` stays its own row. A grouped row's verb is its kind's verb with the number. The card count is the total |
| Inbox page                            | Needs you (every row), then Latest: the 30 newest notification rows (a default the owner may change), with **Show more**                                                                                                                                                                                                                                                                                                                                                          |
| Sidebar Inbox                         | the total                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Sidebar To review, Applicants (admin) | the review rows, the waiting applicants                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Sidebar Articles, Courses             | the owner's rows of that kind                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Bell                                  | Latest, with its unread count                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Space rows and avatars                | unread posts, red                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Each committed admin outcome sends the owner one notification through the existing kinds (`approved`, `changes_requested`, `rejected`, `removed`). It shows in Latest. Latest never adds to a sidebar number.

**One task, one row.** A task has exactly one row in `needs(user)`. Needs you on Home and Inbox, the To review list and the Needs you group of a list are views of that one row, and they read the same predicate. The Inbox number is the total. The To review and Applicants numbers are its parts. The bell may hold an event row for the same item. An event row says that something happened and links to the task through `documentHref`. It has no verb and adds to no work count. Read is not resolved: reading a bell row does not remove the task, and a task leaves only when its document changes. Source: [portal-research.md](2026-11-18-portal-research.md), Bell (events) vs Needs you (tasks).

**Data.** `needs(user)` and `needsCounts(user)` derive from documents on each request, wrapped in React `cache`. The live refresh: when the shell receives a notification of kind `submitted`, `approved`, `changes_requested`, `rejected`, `removed`, `application` or `withdrawn`, it calls `router.refresh()`, debounced 1 s. `router.refresh()` keeps client state such as an open sheet or a running ring (`03-api-reference/04-functions/use-router.md:46`). A portal server action that changes work calls `refresh()` (`04-functions/refresh.md`).

**Access.** Gated read for documents. The applicants numbers come from `src/forms/applicants.ts`, the one projection.

**Errors.** If a source fails, `needs()` returns the rows of the other sources and the Needs you card shows "Some tasks could not load. Reload." The count then shows no number, not a wrong one.

**Tests.** Int: seed one item of each kind, with a never-published submitted item among them. Then the total of `needs(admin)` equals `getReviewQueue().length` plus the number of pending course choices, and the number of rows equals `getReviewQueue().length` plus 1. Int: `needsCounts(user)` equals the totals of `needs(user)` for each role. Int: a declined article is not in `needs(owner)`. Int: `countWaitingApplicants` counts 2 for one applicant with two course choices, 0 for a programme application, and counts a null decision as waiting. E2E: the Home count and the sidebar Inbox number agree. E2E: an owner submits in a second session, and the admin's Inbox number changes with no reload, after the 1 s debounce. Measure the cost of `needs()` and `needsCounts()` per role on the prod clone in phase 1c, before any cache is added.

## Home

**Behavior.** A board, top to bottom:

1. Greeting with the first name. While the checklist shows: "{n} steps to get started.", then one sentence about the next session.
2. **Needs you** card. When `needs()` is empty and the checklist has open steps, the checklist card takes its place. When both are empty, the card says "Nothing needs you now." with no button.
3. The checklist as a slim card, when `needs()` has rows and the checklist has open steps. Only students and fellows get a checklist (see [Onboarding](#onboarding)).
4. **Next session** tile: the course cover under a dark overlay, the session title, the time in Cairo, a link to the space. With no session: "No sessions yet" and one action (student: **Browse spaces**, fellow: **Open your courses**, admin: **Open the calendar**, from phase 1d). Before phase 1d the admin tile shows no button.
5. **Your spaces**: one tile per space on fixed 232px tracks, with the red unread count. Hidden when spaces are off.
6. **Latest**: the five newest notification rows, with a link to Inbox. With none: "Nothing new yet. Replies, reviews and decisions show here."

**Data.** `needs(user)`, `nextMeeting` from `src/lib/meetings.ts` over the reader's courses, the reader's spaces with unread counts, the five newest notifications.

**Access.** Gated reads only.

**Errors.** Each card loads on its own under a Suspense boundary. A failed card shows one line "This could not load." with **Retry**, and the other cards stay.

**Tests.** E2E `portal-home` per role in English and Arabic, on Home and on Inbox: Needs you, the counts agree, the next session, the spaces, and Latest on Inbox with **Show more**. Empty data for each role: no console error, an H1 exists, and each empty card shows its empty text.

## Lists

**Behavior.** One row component serves the Articles and Courses lists. The row's title is its link, to `documentHref` (see [Document links](#document-links)). Other links and buttons on the row are siblings of the title (see Rows and cards with actions in [Accessibility baseline](#accessibility-baseline)). The row holds the 40x40 slot, the title (15px, one line), a meta line (13px), the badges from `statusBadge()` and the next-action line from `nextAction()`.

- Article meta: "Updated 2 days ago · Public". Admin adds the owner's name and "Waiting 3 days". The waiting time is the `updatedAt` of the latest version, which is the submit write.
- Course meta: "Thematic course · Spring 2026 · 5 of 12 held". For a fellow and an admin, a quiet link on the same line: "3 applicants wait. View list", which opens the board with that course chip on. The number comes from `byCourse` of `countWaitingApplicants` (see [Tasks](#tasks-needsuser-and-the-bell)). A live course also gets the quiet link "Participants", to its Participants page. Each link ships in the phase that ships its page (see [Phases](#phases)). There is no progress bar.

Groups, in order, empty groups hidden. A row sits in the first group that matches.

- Articles, fellow and student: Needs you (`waitsOn(key)` is `owner`), In progress (`draft`, `published_unsent`, `published_edits_declined`), With editors (`submitted`, `published_edits`, `published_removal`), Published (`published`, `published_removal_kept`), Closed (`rejected`).
- Courses, fellow: Needs you, Teaching now (live, or has a space), Proposals (`draft`, `submitted`), Closed (`rejected`).
- Articles and Courses, admin: Needs you (`waitsOn(key)` is `admin`), Waiting on the author (`waitsOn(key)` is `owner`), In progress (the admin's own drafts), Published (every live key that does not wait for review: `published`, `published_unsent`, `published_edits_declined`, `published_removal_kept`), Closed (`rejected`).

Admins see the lists as "All articles" and "All courses". Admins may read every document. The list query adds a `where` filter that leaves out other people's drafts. A fellow or a student sees "My articles" and "My courses". The page header has one primary button: **New article** or **Propose a course**. An admin with no linked person has no **Propose a course** button, because `addSelfAs('fellows')` needs one. Admins create courses in `/admin`.

Filter chips (All, Needs you, Drafts, Published) and a search field show only when the list has more than 6 rows. The filter state is in the URL. A search with no result says "No articles match "{query}"." with **Clear search**.

Each group is a `<section>` with an `<h2>` that holds its name and count. The filter chips are links, because the filter is in the URL, and the current chip has `aria-current="true"`. After **Show more**, focus moves to the first new row, and `announce()` says "{n} more rows."

**Delete.** **Delete** on a declined, never-published item works for its owner. Today the owner delete rule is `while: WITH_OWNER` (`src/access.ts:124`, used by `Articles.ts:58`, `Courses.ts:116` and `Publications.ts:43`), together with `draft: true`, which is `neverPublished`. A new constant, `OWNER_DELETE` (`draft`, `changes_requested` and `rejected`), replaces it in the delete rules of articles and courses. `WITH_OWNER` stays as it is, because publications and the review hooks also use it. An article deletes through the collection's delete. A course deletes through its existing endpoint, `POST /api/courses/{id}/delete`, after `GET /api/courses/{id}/delete-summary` lists what goes with it (`src/forms/delete-endpoints.ts:58-59`). The collection `delete` stays `() => false` (`Courses.ts:130-133`).

**Duplicate.** **Duplicate as a new draft** on a declined item creates a new document with `payload.create`, as the reader, with `overrideAccess: false`. The create writes the reviewed fields of the declined item in its first locale, and one `payload.update` per other locale writes the rest. Both writes send `review.status: draft`. They do not copy the `review` group, because on a create the hook reads the old state as `draft`, and an owner's move from `draft` to `rejected` is refused (`review-hooks.ts:128`, `:163-168`). `addSelfAs` makes the reader the owner. A course copy has no sessions.

**Data.** Groups load one by one, in order. The groups that hold work (Needs you, Waiting on the author, With editors, In progress, Proposals) are small and load in full. Published, Teaching now and Closed load 50 rows at a time, with **Show more**, and leave out the ids of the earlier groups. Each group is a gated `find` with `select` for the row fields, plus the latest draft versions for `statusOf`.

**Access.** Gated read.

**Errors.** A failed list shows the page header and "The list could not load." with **Retry**. An empty list shows the empty state of its role (see [Onboarding](#onboarding)).

**Tests.** E2E: every row has a slot, a badge and a next-action line. The group order holds. With 60 published rows and one row that waits on the reader, the Needs you row shows, and Published shows 50 rows and **Show more**. A fellow's live course with edits waiting shows two badges. Keyboard: **Show more** moves focus to the first new row. Int: an owner deletes a declined, never-published article, and a declined course that has a session, and cannot delete a submitted one. The course delete removes its sessions with `overrideAccess: true` (`src/lib/course-delete.ts`), so the session lock does not block it.

## Calendar

**Behavior.** `/spaces/calendar` renders the public calendar component (ADR 0011, "Public calendar redesign") with the legend filters preset: the reader's courses on, public events on, other courses off. The reader can turn any legend type on or off. The view and date stay in the URL (`?view=week&date=…`), as on the public calendar. A click on a block opens the same popover as the public calendar. A fellow or an admin edits a course schedule from the course form or the space Calendar tab, not here.

**Data.** The public calendar's cached meetings query, plus one gated read (`user`, `overrideAccess: false`) of the sessions of the reader's own courses. The two lists merge by session id. The reader's course ids set the preset.

**Access.** The public query reads only public sessions and events. The gated read adds what the reader may read: a Community-tier course they take, and a fellow's own unpublished course.

**Errors.** As the public calendar.

**Tests.** E2E: as a student, only their course and public events show at first. Turning "Other courses" on adds blocks. A student of a Community-tier course sees its sessions. In Arabic, the week starts on Saturday on the right.

## Pending decisions and the undo window

Review decisions and applicant decisions both wait in the browser before they commit (D15). One client provider holds them: `PendingProvider` in `src/portal/pending/`, mounted in the portal shell. A route change inside the portal keeps the timers. Phase 2 builds it for review decisions. Phase 3 reuses it for the board.

**Items.** Each pending item is `{ key, label, request }`. `key` names the decision, for example `review:articles:12` or `applicant:340:7`. `request` is `{ url, body }`. The provider owns the one `fetch`, with `keepalive: true`. A caller never sends the commit itself, and the commit is never a server action, because a server action cannot use `keepalive`.

```ts
type PendingState = 'pending' | 'paused' | 'committing' | 'sent' | 'failed' | 'undone'
type PendingView = { state: PendingState; remainingMs: number; status?: number; result?: unknown } // result: the parsed JSON body of a 2xx
type PendingApi = {
  decide(item: { key: string; label: string; request: { url: string; body: unknown } }): boolean // false when the key already has an item
  undo(key: string): void
  undoAll(): void
  retry(key: string): void
  pause(key: string, cause: 'focus' | 'tap'): void
  resume(key: string, cause: 'focus' | 'tap'): void
  overlay(open: boolean): void // counts open surfaces. `overlay` is a cause of every item while the count is above 0
  items: { key: string; label: string; view: PendingView }[]
}
usePending(): PendingApi
usePendingItem(key: string): PendingView | null
```

The provider reads the response. A 2xx is `ok`. A 409 or a 400 is `refused`, and `status` carries the code, so the UI picks its copy. A network failure or any other status is `error`. On `ok` the provider keeps the parsed JSON body as `result`. The board reads `result.emailed`, which the decide handler returns as `true`, `false` or `null` (`application-decision.ts:509-525`). `true` shows "Email sent", `false` shows "Email failed" with **Send again**, and `null` shows "Decided".

**State machine.** Each item has one state. Only these events are legal:

| From            | Event                                                                                                                                                                                 | To                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| idle (no item)  | `decide`                                                                                                                                                                              | pending                |
| pending         | `pause` (a cause joins the set: `focus` on the item or its toast, `overlay` while a **Move to** menu or any modal surface of the portal is open, `tap` on the ring on a touch screen) | paused                 |
| paused          | `pause` (another cause joins the set)                                                                                                                                                 | paused                 |
| paused          | `resume` (a cause leaves, and the cause set becomes empty)                                                                                                                            | pending                |
| pending, paused | `undo` (**Undo**, the second tap on the ring, Esc on the focused item, **Undo all**)                                                                                                  | undone                 |
| pending         | `expire` (the timer ends)                                                                                                                                                             | committing             |
| pending, paused | `flush` (`pagehide`, `visibilitychange` to `hidden`, provider unmount, **Sign out**)                                                                                                  | committing             |
| committing      | `ok`                                                                                                                                                                                  | sent                   |
| committing      | `refused` (409 or 400)                                                                                                                                                                | undone                 |
| committing      | `error`                                                                                                                                                                               | failed                 |
| failed          | `retry` (**Try again**)                                                                                                                                                               | committing             |
| failed          | `undo` (**Undo**)                                                                                                                                                                     | undone                 |
| failed          | `flush`                                                                                                                                                                               | committing             |
| sent, undone    | `dismiss` (after its line or toast shows)                                                                                                                                             | idle (the item leaves) |

The timer runs only while the cause set is empty. On resume it goes on with the time that was left. It does not restart. Time is read from `performance.now()`.

The modal surfaces are the sheets, drawers and dialogs of the portal, the palette and the More sheet. The page behind a modal is inert, so no pending line, ring or **Undo all** can be reached while one is open. So `overlay` joins the cause set of every item at once. Each modal surface and each **Move to** menu calls `overlay(true)` when it opens and `overlay(false)` when it closes. The provider counts the open surfaces, because a surface can open over another (the material dialog over the session drawer, the palette over a sheet). When the count goes above 0, the provider sends `pause` with `overlay` to every item. When the last surface closes and the count is 0, it sends `resume` with `overlay` to every item. An item that starts while the count is above 0 starts paused.

A key has at most one item. `decide` on a key that has an item is refused. A pending card or row shows **Undo** in place of **Move to** and the decision buttons, and a drop of a pending card on a lane is refused with "Undo first."

An item moves to committing before its `fetch` starts. A second trigger then finds it in committing and sends nothing, so one browser sends each commit once. **Undo** is disabled while an item is committing and after it is sent. On a failed item, **Undo** gives the decision up. A refused item leaves the provider with its message, and the page refreshes. A refusal is never retried.

**Window.** `UNDO_MS` is 5 s. Test builds read a shorter value from a test-only env (1.5 s).

**Pause (WCAG 2.2.1).** The undo window is a time limit, so WCAG 2.2.1 Timing Adjustable applies. The pause causes above stop the timer. After a decision, focus leaves the pending item (see the review row and the pending card), so the timer runs. The reader moves focus back to the item to pause it. On a touch screen, the first tap on the ring adds `tap` to the cause set. The second tap undoes. A tap in another place removes `tap`, and the timer goes on. Esc while focus is not on a pending item also removes `tap`. Esc while focus is on the pending item or its ring undoes it, as in the state table. While paused, the line says "Paused. Email waits.", and the ring label ends "Timer paused." There is no setting for a longer window.

**Where Undo lives.** Undo is never only in the toast. It is also on the pending item (the card's line and ring, the pending review row's line) and in the "Undo all" bar. The toast does not dismiss while it has focus. Focus never moves into the toast unasked. The Undo on the pending item is the keyboard path. Source: [portal-research.md](2026-11-18-portal-research.md), Undo instead of confirm.

**Many at once.** Each item has its own timer. With 2 or more pending items, a bar says "{n} emails wait" with **Undo all**. The bar is a `<section aria-label="Pending decisions">` in the shell. It counts in `scroll-padding-block-end`, like the other sticky bars. When it first shows, `announce()` says "{n} emails wait. Undo all is available." once. After **Undo all**, focus moves to the first item that came back.

**Copy.** The pending line says when the email goes: "Accepting. Email in 5 s". The bar and the first pending toast of a session add "Emails go when you leave this page or switch app."

**Commit on leave.** `flush` commits every pending item at once:

- `pagehide`: the tab closes, reloads or leaves the site.
- `visibilitychange` to `hidden`: the reader switches tab or app, or the phone locks its screen. A phone can kill a background tab with no `pagehide`.
- The provider unmounts: the reader opens a `(site)` page. In development, React Strict Mode mounts the provider twice. The unmount flush waits one task and does nothing if the provider mounted again.
- **Sign out** flushes and awaits every commit before it signs out, so no commit runs without the session cookie. If a commit fails, sign-out stops, and the item shows its error with **Try again** and **Undo**.

**Back-forward cache.** On `pageshow` with `event.persisted`, the provider drops every item and calls `router.refresh()`. A restored page never shows live timers for decisions that were already sent.

**What this costs, stated plainly:**

- A crashed browser or a killed process loses its pending decisions. No email goes and nothing is saved. On reload, the item is back where it was.
- A `keepalive` commit from a page that is gone cannot show its result. If it fails (any non-2xx response), the decision is lost, and the reader sees the item undecided on the next load.
- A tab switch, an app switch or a locked phone screen commits at once, with no chance to undo.
- Other admins do not see pending decisions until the commit.

**Tests.** Unit: every legal event of the state machine, and a refusal for each illegal one (for example `undo` from committing, and `decide` on a key that has an item). Unit: `expire` and `flush` together send one `fetch`. Unit: decide, focus the item, blur, and the commit comes after the time that was left. Unit: a 409 ends in undone with no retry. Unit: open a modal with two items pending, both pause, and both resume with their time left when it closes. Unit: open a dialog over a sheet, close the dialog, and the items stay paused until the sheet closes. Unit: on `ok` the view holds `result`. E2E: reload during the window, and the item is decided with its email sent. E2E: switch tab during the window, and the decision commits. E2E: **Sign out** during the window commits first. E2E with `reducedMotion: 'reduce'`: the ring shows the remaining seconds as text with no arc.

## Review and history

**Behavior.** To review is the admin's queue of submitted articles, courses and publications, edits to published ones, and removal requests. Oldest first. On a wide screen it is a list with a pane beside it. Under 700px it is the list, and a tap opens the pane as its own page with a back link "To review" and a sticky action bar.

The pane shows, in order:

1. Title, byline and a facts row in 13px. Article: "Asked for: Public · Translation from Arabic · 3 tags · English and Arabic". Course: "Thematic course · In person · Arabic · Starts 7 Feb · 6 sessions · English and Arabic · Fellows: {names}".
2. The banner with the latest note, then a `<details>` "History ({n})", open for the admin.
3. On a resubmission or a published edit: **What changed**, a field-level diff (D9).
4. The body, at most 320px high, with **Show more**. A quiet link "Read the full article" or "Open the full course" opens the read-only view. Its back link returns to the same row.

**Read-only views.** The pane body, the read-only view and the read-only pages `/spaces/articles/[id]` and `/spaces/courses/[id]` of phase 2 render through the site's rich text converter (`src/components/RichTextField.tsx`) and the public course page component `CourseView`, which renders a course it gets as a prop (`src/app/(frontend)/[locale]/study/[slug]/CourseView.tsx` today, under `(site)/` from phase 1a). They read the submitted or draft version through the version access, so only the owner and admins read a draft (`readVersions`, `Articles.ts:50`, `Courses.ts:124`). The editors of phases 4e and 5 replace the owner's read-only page. The admin's view stays read-only. 5. The actions.

Actions by item:

| Item                 | Primary                                                                                                                                                                                                                                                                                                         | Other actions                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Article, new or edit | **Approve and publish**, with the select **Publish as** (Community, Public). It starts at the requested tier (D6)                                                                                                                                                                                               | **Ask for changes** (note required), **Decline** (note required) |
| Course, new or edit  | **Approve and publish**, with **Cycle** (required) and **Tier** (Community, Public, starts at Public) (D10). On an edit of a live course, both start at the course's current values. The button label names the fellows when the approval makes someone a fellow: "Approve and publish. Makes {names} fellows." | **Ask for changes**, **Decline**, as above                       |
| Publication          | **Approve and publish**                                                                                                                                                                                                                                                                                         | **Ask for changes**, **Decline**                                 |
| Removal request      | **Remove from the site**                                                                                                                                                                                                                                                                                        | **Keep it published** (note required)                            |

Courses get an `onApprove`, like `approveArticle` (`src/collections/Articles.ts:29-43`). It returns the tier the pane sends, or `public` when the incoming tier is `owner`. Then an approval from `/admin` also leaves no course at `owner`. Approval grants the fellow role to everyone in `fellows` (`propagateFellowRole`, `Courses.ts:58-81`), and those people then see the money fields of the course's applicants (D12). That is why the pane and the diff show the fellows.

A note goes in the owner's notification and email. A required note that is empty shows its error under the field, and focus moves there. Source: [portal-research.md](2026-11-18-portal-research.md), Review and approval.

**Decisions wait in the undo window.** The pane validates on press, before any pending item starts: **Cycle** on a course approval, and the note where it is required. A gap shows its error under the field, focus moves there, and no pending item starts.

Every review decision (approve, ask for changes, decline, remove, keep) is a pending item (see [Pending decisions](#pending-decisions-and-the-undo-window)). The row stays in the list as a pending row. It has `aria-busy="true"`, and its line says "Approving. Email in 5 s" with **Undo**. Focus moves to the next row that is not pending, and the pane shows that row. When no such row exists, focus moves to the list heading, and the pane shows "Nothing else waits." On a phone, the pane page goes to the next row's pane, or back to the list when no row is left. A toast says "Approved. Email in 5 s" with **Undo**, and the toast host reads it. `announce()` says "6 left." 500 ms after the toast shows (a default), and the count leaves out pending rows. Undo makes the row a normal row again, selected, with the note and the selects as they were, and focus moves to that row. When the timer ends, the browser sends the commit. The row leaves the list when the commit succeeds.

**The review endpoint.** Each commit is one request to `POST /api/{collection}/{id}/review`. One factory in `src/lib/review-endpoint.ts` adds this Payload endpoint to articles, courses and publications. The body is `{ to, note, tier, cycle, updatedAt }`, well under the 64 KB `keepalive` limit. The endpoint is admin only. It refuses a request whose `Origin` header is not the site's own origin with 403, so it does not rest on the default `Lax` cookie alone. It writes through `payload.update` with the admin as `user` and `overrideAccess: false`, so `applyReview` still enforces every move. `/admin` keeps its own behavior.

`applyReview` lets an admin make any move (`canMove`, `src/lib/review.ts`), so the endpoint allows only the moves of a decision. It reads only the keys above, and it sends `tier` and `cycle` only on an approval. `tier` must be `community` or `public`, never `owner`, and `cycle` must be the id of an existing cycle. Any other move, a missing required note, or another `tier` or `cycle` gets 400 with the field error. The page `/spaces/review/[collection]/[id]` accepts only `articles`, `courses` and `publications` as `collection`, and returns not found otherwise.

| Item waits with                   | Legal `to`                      | Note     |
| --------------------------------- | ------------------------------- | -------- |
| `request: changes`, or no request | `approved`                      | optional |
| `request: changes`, or no request | `changes_requested`, `rejected` | required |
| `request: removal`                | `draft` (remove from the site)  | optional |
| `request: removal`                | `rejected` (keep it published)  | required |

The endpoint sets `review.review_note` to `note`, or to `null` when there is none, on every move, as the admin button does (`src/components/admin/submit-for-review.tsx:177`).

The endpoint refuses a stale decision. `updatedAt` is the time of the version the pane showed. The steps run in one transaction (`initTransaction`, as the applicant `decide` handler does at `application-decision.ts:498`), and step 1 starts with a row lock on the document, so two commits on one document run one after the other. The lock is one helper, `lockRow(req, table, id)` in `src/lib/lock-row.ts`, extracted from `application-decision.ts:59-68` (`for update` through the transaction's session), and the applicant handler uses it too. Every `payload.update`, `findVersions` and `notify` call in the handler passes the same `req`, as `application-decision.ts:52` does, or the lock holds nothing. The owner's **Withdraw** and **Withdraw changes** take the same lock before their write, so their hook reads the state after any admin commit. In this order:

1. If the newest `review-events` row of the document is this same move by this same admin, made after `updatedAt`, the endpoint returns 200 and changes nothing. A retry is safe.
2. If the latest version is newer than `updatedAt`, or its `review.status` is not `submitted`, the endpoint returns 409 (see Errors).
3. Otherwise it writes the decision.

So an admin cannot approve an item that its owner withdrew a second ago, or one that another admin decided.

The owner's `approved` notification for an article names the tier: "Your article "{title}" was published for the community" or "… on the public site".

**Withdraw (D3).** An owner may withdraw a submission. On a document that was never published, `submitted` goes back to `draft` and the form opens again. On a live document, the draft copy goes from `submitted` to `draft`, `review.request` clears, and the key becomes `published_unsent` (or `published` when the copy equals the live row). A withdrawn removal request leaves the document live, with nothing waiting. Admins get a `withdrawn` notification in the bell, with no email, and the queue row and the Needs you row leave.

The code changes for withdraw:

- `AUTHOR_MOVES.submitted` becomes `['draft']` in `src/lib/review.ts:17-23`.
- The refusal for an owner's write from `submitted` (`review-hooks.ts:147-152`) lets exactly the move to `draft` through.
- Submit and Withdraw are full saves (`draft: false`) on a document that is not live. A draft save that changes the status throws there (`review-hooks.ts:135-141`), and `notifyReview` skips draft saves on a document that is not live (`review-hooks.ts:209-210`). On a live document, every owner write is a draft save, and both moves are allowed.
- `notifyReview` decides by actor first, for the audience, the kind, the bell line and the email. Today an owner who withdraws a removal request makes the same move as an admin who approves the removal (`submitted` to `draft` with `request: removal`), and the hook tells the owners "was taken off the site, as you asked" (`review-hooks.ts:213-216`, `REMOVAL_NOTES.draft`). The change: when the actor is not an admin and the move is `submitted` to `draft`, the hook tells the admins with kind `withdrawn` in the bell and sends no email. When the actor is an admin, the existing `removed` notice to the owners stays.
- `withdrawn` is appended last to `NOTIFICATION_KINDS` in `src/lib/notification-kinds.ts`, with `audience: 'admins'`. The order of that record is the order of the stored values, so it goes at the end. Every new notification row also sends a push, unless the reader turned that kind off (`src/lib/realtime/publish.ts:89`, `sendPushForNotification` in `src/lib/push/send.ts`). So admins get a push for each withdraw, as for every other kind, and the push sender gets no special case. `withdrawn` is added to `PREFERENCE_ORDER` (`src/lib/notification-preferences.ts:13`) after `submitted`, so an admin can turn it off as they can `submitted` and `application`.

**Review history.** A new append-only collection `review-events` holds one row per real review move:

```
review-events
  collection     'articles' | 'courses' | 'publications'
  doc            the document id, indexed
  version        the id of the version that the move created
  from, to       review states
  request        'changes' | 'removal' | null
  note           the review note of this move, or null
  actor          users, or null for a server write
  at             date
```

Its own afterChange hook in `reviewHooks` writes the row, not `notifyReview`, because `notifyReview` returns early for server writes and for moves with no audience (`review-hooks.ts:209-217`). An autosave writes no row, and a write whose `review.status` does not change writes no row.

The hook gets `version` with `findVersions({ where: { parent: { equals: doc.id } }, sort: '-updatedAt', limit: 1, req })`, with the same `req`, so it reads inside the same transaction. Payload saves the version before afterChange runs (`payload/dist/collections/operations/utilities/update.js:324`, `:386`), but it passes no version id to the hook.

The hook writes `note` only when the actor is an admin and the move is a decision. It takes the note from the incoming `data.review.review_note` of that write, not from the stored document, so a note never carries over to the next row. An owner's move has `note: null`. Access: `read` is admins only, and owners read history through `reviewHistoryFor` (see [Data access rule](#data-access-rule)). `create`, `update` and `delete` are `() => false` for every user, set explicitly so that REST and GraphQL are closed too. The hook writes with `overrideAccess: true`. The banner shows the latest note. History lists every row.

**Diff (D9).** The diff compares two Payload versions by id. The other side is the version that was submitted. The base:

- For a document that is not live, the base is the `version` stored on the latest `review-events` row whose `to` is `changes_requested`.
- For a live document, the base is always the live row.

The diff lists each changed reviewed field (see [Status model](#status-model-statusof)) with the old and the new value. A text field shows both values. A rich text field shows the changed paragraphs as plain text, old above new. `fellows` shows the names added and removed. Sessions are not in the diff, because sessions have no review (ADR 0011).

### Document links

One function, `documentHref({ collection, id, viewer, waiting, locale })` in `src/lib/document-href.ts`, gives the link in every email, notification and list row. `viewer` is `'owner' | 'admin' | 'fellow'`. `waiting` is true when `waitsOn(key)` is `admin`. Callers pass both, so the function reads nothing. It ships in phase 1b, because the list rows need it. In phase 1b it gives the admin URL for every viewer. Phase 2 changes it in the same PR that ships the pages, with no flag.

- An admin gets `/spaces/review/{collection}/{id}` while the document waits for review, and the admin URL otherwise.
- An owner gets the portal page (`/spaces/articles/{id}`, `/spaces/courses/{id}`). Before phase 2, the function gives the admin URL.
- An `application` notice gets `/spaces/applicants?application={id}` for an admin and `/spaces/applicants?course={id}` for a fellow, from phase 3. The board opens with that card's sheet open, or with that course chip on.
- A publication owner gets the admin URL until D16 is decided, because the portal has no publication page.
- `users` (the `joined` notice to admins, `invitation.ts:83`) gets the admin URL.

A link in an email is absolute and carries the recipient's locale: `space-preferences.locale` when the account has that row, and the site's default locale otherwise. Recipients differ in role and locale, so `notifyReview` sends one review email per recipient, with that recipient's link from `documentHref`. Today `sendReviewEmail` sends one message with one link to the whole `to` list (`src/lib/review-mail.ts:82-95`), so recipients also see each other's addresses. `emailRecipients` (`review-mail.ts:47`) changes to return each recipient's locale with the address. A link stored in `notifications.link` is a locale-free path. The bell adds the reader's current locale when it renders a stored link that starts with `/spaces`, and leaves an `/admin` link as it is. The function replaces the links at `review-hooks.ts:221`, `review-queue.ts:71`, `invitation.ts:83`, and `notify-application.ts:42` and `:64`. A one-off data script rewrites the stored `link` of old notification rows that start with `/admin/collections/` or `/admin/applicants`. It builds each new link with `documentHref`, for that row's recipient and the document's current state. It skips `users` links, which stay admin links, and rows whose document is gone. The owner runs it by hand on each database. Deploys never run it. A stored link holds the link of the moment it was written. Opened after the document changed, it shows the page of the document's current state.

**Data.** M1 (`review-events`). M3 (`withdrawn`). The queue reads `getReviewQueue` (`src/lib/review-queue.ts:30-56`) after an admin check.

**Access.** Gated read for documents and versions. Events through `reviewHistoryFor`. Review writes go through the review endpoint. `applyReview` stays the one place that enforces moves.

**Errors.**

- The pane checks **Cycle** and the required note on press (see above). The server keeps the same rules (`Courses.ts:578-587`, and the endpoint's note rule). If a commit still returns a field error (400), it is a refusal. The pending row becomes a normal row again, selected, with the error under the field. It never becomes a 500.
- A stale decision gets 409 from the review endpoint (see above). It is a refusal: the pending row becomes a normal row again, selected, and a toast says "This changed while you reviewed it." The pane shows the new state.
- A network failure or another non-2xx response at the commit leaves the item failed. The pending row says "Not saved." with **Try again** and **Undo**, and a toast says the same. **Undo** makes the pending row a normal row again, selected, with the note and the selects as they were.
- A pruned version shows "The earlier version is no longer stored." in place of the diff.
- An owner's withdraw that waits on the lock and then finds the item decided is refused. The page says "An admin decided this while you withdrew it." and shows the new state.

**Tests.** Int: submit, ask for changes with note 1, submit, ask for changes with note 2, submit, approve. `review-events` has 6 rows in order, notes 1 and 2 are on rows 2 and 4 and on no other row, and each row holds its own `version`, distinct for two moves in one second. Through `reviewHistoryFor`, the owner reads them. After the approval, the item is published, and another member still reads none. A REST read of `review-events` as a member returns nothing. Int: withdraw from `submitted` on a new and on a live document. The admins get `withdrawn` with no email, and the queue no longer lists it. Int: an owner withdraws a removal request. The owners get no "taken off the site" notice, and the admins get `withdrawn`. Int: the owner withdraws, then a commit with the old `updatedAt` gets 409 and nothing publishes. Int: the same commit sent twice returns 200 both times and sends one email. Int: two commits with different verdicts on one document at the same time: one writes, the other gets 409, and one email goes. Int: each move outside the endpoint's table, a missing required note, `tier: owner` and an unknown `cycle` get 400. Int: an owner's withdraw and an admin's approval on one document at the same time run one after the other. When the admin is first, the withdraw is refused, and the owner sees "An admin decided this while you withdrew it." When the owner is first, the admin gets 409. Int: a submit with one Arabic and one English admin sends two emails, each to one address, with a link in that admin's locale. Int: a request with a foreign `Origin` gets 403. Int: Discard, then **Restore them**: the key returns to `published_unsent` with the same field values, and no email goes. Int: approving a course with cycle and tier publishes it at that tier. Unit: `documentHref` for each collection, viewer, `waiting` value and locale. E2E: `/spaces/review/users/1` is not found. E2E `portal-review`: approve with cycle and tier, undo it, approve again and let the timer end, ask for changes with a note, the history shows, an owner's email link opens the portal. With the accessibility tree event log, both the toast text and "6 left." arrive. On a phone, tabbing through the pane keeps focus visible above the sticky bar.

## Applicants board

**Behavior.** Three lanes: Waiting, Accepted, Declined. Course chips sit on top: "All courses" first, then one chip per course, in a row with an end fade on phones. One card per applicant per course choice. Two fellows of one course both see its cards.

Admins move a card three ways, and every way calls one `decide(key, to)`:

- **Move to**, a menu button on each card (WAI-ARIA menu button). It is the keyboard and touch path, and it ships first.
- Pointer drag between lanes, through the generic board in `src/components/board/ui/` (D13).
- **Accept** and **Decline** in the applicant sheet. The sheet closes on either, and the ring shows on the card.

Fellows have no Move to, no grip and no sheet buttons. Their intro line says "Only admins decide. You see who applied to your courses."

**Keyboard drag.** When pointer drag ships, it has a keyboard path: Space lifts a card, the arrow keys move it, Space drops it, Esc cancels. Outside drag mode the board does not capture plain arrow keys, because screen readers use them. Lift, move, drop and cancel are announced through `announce()`, in the shared polite live region, with text the board supplies. Move announcements are debounced, about 500 ms. A drop calls `decide(key, to)` like the other two ways. **Move to** stays the first path (WCAG 2.5.7). Source: [portal-research.md](2026-11-18-portal-research.md), Applicants kanban.

**Legal moves.** The **Move to** menu lists only the lanes that the card may move to. The card's own lane is not offered.

| From               | To                        | How                                                                                                    | Email                 |
| ------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------- |
| Waiting            | Accepted, Declined        | pending item, then `POST /api/form-submissions/{id}/courses/{course}/accept` or `/reject`              | after the undo window |
| Accepted, Declined | Waiting (Reopen)          | at once, `POST /api/form-submissions/{id}/courses/{course}/reopen` (`application-decision.ts:369-388`) | none                  |
| Accepted           | Declined, and the reverse | refused                                                                                                | none                  |

Reopen commits at once with no ring. A toast says "Reopened. No email sent." A drop on the other verdict's lane is refused with "Reopen it first." A card whose email went says "Email already sent" in its menu.

**The pending card.** `decide()` makes a pending item (see [Pending decisions](#pending-decisions-and-the-undo-window)). On a wide screen the card moves to the target lane, at the top: pending cards come first, newest on top. On a phone the card stays in its lane. In both, the card shows a ring that drains over `UNDO_MS` with the seconds inside, and the line "Accepting. Email in 5 s" with **Undo**. While pending, the card shows **Undo** in place of **Move to**. After a decision, focus moves to the next card in the lane the card left, or to the lane heading when the lane is empty. Focus does not stay on the pending card, so the timer runs. The reader moves focus back to the card to pause it or to undo it. The sheet closes on **Accept** or **Decline**, and focus goes to the next card, not to the card that opened the sheet. When the timer ends, the card shows "Email sent", or "Email failed" with **Send again**, which calls the existing `/resend` endpoint.

The ring contract:

- The ring is a `<button>`, at least 24px, and 44px under `(pointer: coarse)` (the drawn ring stays 28px).
- Its label is "Undo accepting {name}" or "Undo declining {name}", in English and Arabic. On a touch screen, while `tap` is not in the cause set, the label is "Pause, then undo accepting {name}" (or declining), because the first tap only pauses. While paused, the label ends "Timer paused."
- The seconds inside are `aria-hidden`.
- The pending line is announced once when the item starts, through its toast, and once on "Email sent" or "Email failed", through `announce()`. It is never announced per second.
- The card has `aria-busy="true"` while its item is pending.

Undo puts the card back in its lane, and a toast says "Undone. {name} is back in Waiting."

**One idempotent commit.** Extract `commitCourseDecision(req, id, course, verdict)` from the `decide` handler (`application-decision.ts:491-526`). It runs `decideCourse` in the transaction, then `sendMail` and `recordSend` after the commit, as today. The endpoint calls it. If the choice already holds the same verdict, it returns `{ ok: true, emailed: null }` and sends nothing. Today a second call is refused (`application-decision.ts:317-318`). Then a retry never sends two emails. The row lock on the submission (`application-decision.ts:55-70`, the `for update` at line 68) orders two calls on one application. A different verdict is still refused.

The card reads `emailed` from the commit's `result` (see [Pending decisions](#pending-decisions-and-the-undo-window)). On `emailed: null` the card shows "Decided", not "Email sent". After the refresh, if `applicantsFor` reports `emailFailed` for that choice, the card shows "Email failed" with **Send again**.

**Fellows see money fields (D12).** The fellow projection in `applicantsFor` returns `amount`, `need_reduction` and `contribution` for choices on the fellow's own courses, the same as for admins. This removes the `admin ?` conditions at `src/forms/applicants.ts:134-135`. The rule "fellows see only their own courses, view only, never decide" stays. A fellow's result holds only the choices of courses they teach. `form-submissions` read stays admin only, so the projection is still the only door. `docs/decisions/applicants-review.md` line 15 ("omit financial data for fellows") changes to say that fellows see the money fields of their own courses. The change ships in phase 3, with the board. The admin view `src/components/admin/applicants.tsx` uses the same projection, so fellows see the money fields there from phase 3 too.

**Board library (D13).** The board uses ui-sdk's `createTransfer` (`@ui-sdk/core/docs/core.md:4691-4720`) for moving items between lists, with keyboard support and announcements. Phase 3 starts with a half-day check of `createTransfer`. It passes when all of these hold: Space, the arrow keys and Space move a card to another lane. Lift, move, drop and cancel are each announced once. In Arabic the left and right arrows follow the RTL lane order. A touch drag moves a card. Esc cancels a drag and leaves the card where it was. Any miss means the board ships with **Move to** only and no drag. Only when the check passes, ADR 0011 gets an amendment in its decision log: `src/components/board/ui/` may also import ui-sdk, for the kanban. The lint rule changes with it. In `.oxlintrc.json` (`no-restricted-imports` and its override, lines 109-127), the override that turns `no-restricted-imports` off adds `src/components/board/ui/**` and `tests/unit/board/**`, and the rule's message names both folders. The ui-sdk line in `AGENTS.md` changes to name both folders. The generic board knows nothing about applicants. `src/portal/applicants/` holds the lanes, cards and sheet.

**Data.** `applicantsFor` (projection). `countWaitingApplicants` for the counts. No new fields. No migration.

**Access.** The decision endpoints stay admin only (`application-decision.ts:494`). The board hides the controls for fellows. The endpoint is the guard.

**Errors.**

- The commit returns 400 because another admin decided first with another verdict. The card shows "Another admin decided first." and the board refreshes.
- The network fails at the commit. The card shows "Not saved. Try again." with **Try again**, which calls the same endpoint, and **Undo**, which gives the decision up. The decision stays out of the database until it succeeds.
- The email fails after the commit. The card shows "Email failed" with **Send again**.

**Tests.** Int: `commitCourseDecision` twice with the same verdict sends one email. Two courses of one application both commit. Int: the fellow projection returns the money fields for the fellow's own course, and no choice of another course. Update the exact key set in `tests/int/applicants.int.spec.ts:113-160` to include the money keys. E2E `portal-applicants` with the test window of 1.5 s: Move to Accepted by keyboard. Focus moves to the next card, and the ring counts down with no more input. Move again, move focus back to the pending card, the line says "Paused. Email waits.", and Esc undoes. A pending card offers **Undo** and no **Move to**. Keyboard drag, when it ships: Space lifts, an arrow moves, Space drops, Esc cancels, each announced once, and plain arrows move nothing outside drag mode. Move again, wait, "Email sent". Navigate to Courses during the window, and the decision still commits. Move to Waiting on a decided card, and it reopens with no email. As a fellow: no Move to and no grip. Worst case: 40 applicants with long Arabic names and 20 courses in the chip row, at 390px and 1440px, with no overflow.

## Course form and the sessions calendar

**Behavior.** `/spaces/courses/new` and `/spaces/courses/[id]`. The H1 is "Propose a course" (new), "Edit course" (own, editable) or "Course" (read-only, or any viewer who is not an owner). A back row reads "Courses / {title or Untitled course}". A section rail on the side lists: Basics, Teaching, Sessions, Notes, Review. A section with a blocking gap shows the `circle-dashed` icon in the rail. On a live course, the page header has the secondary button **Participants**.

Fields the form shows, from `src/collections/Courses.ts`:

- Basics: `cover_image`, `title`, `subtitle`, `epigraph`, `description`. `description` is localized rich text on the default editor, which has content blocks (`Courses.ts:223`, `src/payload.config.ts:279`, `src/lexical/default-features.ts`). The form edits it with the portal rich-text core (phase 4d). Authors insert paragraphs, headings, lists, links, bold and italic, and every other stored node round-trips locked (D17). If the spike is no-go, the Basics section shows the description read-only with **Edit description in the dashboard**, which opens the admin course editor.
- Teaching: `course_type`, `location`, `teaching_languages`, `language_note`.
- Sessions: the calendar (below) and `syllabus_tentative` ("Syllabus may change").
- Notes: `facilitator_note`, `content_warning`, and the course materials (the course bibliography) as a card list.
- Review: the submit gate and the button.

The form never shows `fellows` (filled by `addSelfAs('fellows')`, `src/lib/review-ownership.ts:6-13`), `cycle`, `tier`, the Applications and contribution tab, the Participants tab, or the review group. Optional fields open from a verb-first row: "Add an epigraph", "Add a language note", "Add a facilitator note", "Add a content warning".

**Notes shown on the public page (D7).** `content_warning`, `language_note` and `facilitator_note` all show on the public course page. Each field has one hint line under it: "Shows on the public course page."

**Writing language.** The EN and AR switch sets the language of every localized field and of the session drawer. It shows `langState`. Placeholders follow the writing language. The text direction of a field follows the writing language, not the page language.

**When the draft is created.** "Propose a course" opens an empty form and creates nothing. The first save with a title, in either language, creates the draft course. Until then the Sessions section shows "Add a title to start placing sessions." A title-only draft saves, because Payload does not validate required fields on a draft save (`versions.drafts.validate` defaults to false, and `Courses.ts:139-146` does not set it).

**Saving.** The form saves a draft 1.5 s after typing stops, and every 30 s while changes wait, through the server action `saveCourse` with `draft: true, autosave: true`. `saveCourse` takes `{ id, locale, updatedAt, fields }`, where `fields` is `Partial<CourseFormFields>`, the fields of the list above without the calendar. It returns `{ ok: true, updatedAt }` or `{ ok: false, errors: { field, message }[] }`. Each save sends the `updatedAt` it started from. A stale save is refused, never overwritten silently, as `saveScheduleEdits` already does. The form shows "This course was changed in another tab or by an admin." with **Reload**, **Keep mine** and **See changes**. **Reload** drops my edits. **Keep mine** saves again on top of the new version. **See changes** opens the field diff of [Review and history](#review-and-history) between the version the form started from and the latest version. It reads `reviewed-fields.ts`.

One persistent save status sits near the content, in the page header. It has three states: "Saving", "Saved {relative time}" (for example "Saved 2 min ago"), and "Not saved. Retrying." It never shows a stale "Saved": while changes wait or a save has failed, it shows "Saving" or "Not saved". It does not flicker per keystroke. The visible status is not a live region. Only `announce()` speaks, and only twice: the first "Not saved. Retrying." of a failure, and the first "Saved" after it. A failed save keeps the edits and retries on the next change or after 10 s. Leaving the page with an unsaved change asks first, through the leave guard (`src/lib/leave-guard.ts`). Source: [portal-research.md](2026-11-18-portal-research.md), Autosave.

**Submit gate (D4).** **Submit course for review** on a course that is not live needs a title and a description in the same language (English or Arabic), at least one session (with or without a meeting), and a `course_type`. The schema requires `course_type` (`Courses.ts:235-238`). Payload skips that check on a draft save but runs it on the full save that Submit is (`payload/dist/collections/operations/utilities/update.js:191`). Submit saves in the locale that holds the title and the description, because `title` is required and localized (`Courses.ts:187`).

The gate is one function, `courseSubmitGaps` in `src/lib/course-submit-gate.ts`. It returns `{ field, section, message }[]`, with one item per blocking gap, and an empty array when the course may be submitted. A course `beforeChange` hook calls it on an owner's move to `submitted` on a course that is not live, reads both locales with `locale: 'all'` and counts the sessions, and refuses with a 400 that names the gaps. So the gate binds REST too. The form calls the same function to show the gaps before the request. The signature is `courseSubmitGaps(course: CourseAllLocales, sessionCount: number)`, where `CourseAllLocales` is the course read with `locale: 'all'`. If a gap exists, Submit moves focus to the first missing field and shows "Add a title and a description in English or Arabic, a course type, and at least one session." The Review section lists every other empty field as a warning: "Not required. An admin can ask for it", each with a link to the field. Warnings never block.

**States of the form**, from `statusOf`:

| Key                                                    | Course fields | Sessions    | Buttons                                                                  |
| ------------------------------------------------------ | ------------- | ----------- | ------------------------------------------------------------------------ |
| `draft`, `changes_requested`                           | open          | open        | **Submit course for review**                                             |
| `submitted` (never published)                          | locked        | locked (D2) | **Withdraw**                                                             |
| `rejected` (never published)                           | locked        | locked (D2) | **Duplicate as a new draft**, **Delete**                                 |
| `published`                                            | open          | live        | none. **Request removal** in the header menu                             |
| `published_unsent`                                     | open          | live        | **Submit changes for review**. **Discard my changes** in the header menu |
| `published_edits`, `published_removal`                 | locked        | live        | **Withdraw changes** or **Withdraw**                                     |
| `published_edits_returned`, `published_edits_declined` | open          | live        | **Submit changes for review**. **Discard my changes** in the header menu |
| `published_removal_kept`                               | open          | live        | none. **Request removal** in the header menu                             |

On a live course, one line with the `globe` icon sits next to the Save schedule bar: "Session changes go live when you save. They do not need review." On a course that is not live, the line does not show.

**Sessions lock on a proposal with an admin (D2).** On a course that is not live, a non-admin may not create, update or delete its sessions while the course's `review.status` is `submitted` or `rejected`. The rule is one constraint in the sessions access (`createSession` and the `update` and `delete` rules at `src/collections/Sessions.ts:98-108`), not in the UI. On a live course, the course's fellows edit its sessions with no review, as ADR 0011 decides.

**The calendar.** The Sessions section embeds the shared site schedule host. `SpaceCalendarEditor` (`src/components/space/space-calendar-editor.tsx`) moves to `src/components/space/schedule-host.tsx` and takes a calendar parent: a course or a space. The space Calendar tab and the course form both use it. It brings `useScheduleDrafts`, `useScheduleSave`, the session form, the leave guard and the announcement offer. The course form adds no calendar behavior of its own.

What the reader gets, as ADR 0011 and its decision log define it:

- A week view that starts on Saturday, in Cairo time, with a 24h and 12h switch, an all-day row and a now line. Under a 640px container: one day at a time with a day switcher.
- The look of the ADR 0011 decision log of 2026-11-15: soft tinted blocks with title and time, small muted hour labels, cancelled sessions hatched.
- Draw on an empty slot to make a new untitled session with one meeting (15-minute snap). Drag a block to move it, drag its bottom edge to resize. Keys: arrows move by a day or 15 minutes, Shift and arrows resize, Enter opens.
- **Add session** in the host header creates an untitled session in the Unscheduled tray, with no drag. Both the space Calendar tab and the course form get it, because they share the host.
- The block menu (the "⋯" button, right-click, Shift+F10, the Menu key, long press): Open, Add meeting, New session next week, Delete meeting. There is no "delete session" on the calendar.
- The Unscheduled tray beside the calendar (below it when narrow). Drag a session from the tray onto the grid to place it, or open it and add a meeting in the drawer, which places it with no drag. An empty tray says "Every session has a time."
- In edit mode, a click on a session opens the session form in a drawer (a bottom sheet on phones). Its parts, in order: Title (placeholder "Session N"), Description (Markdown), Meetings (each with a date and a start and end time, through the Arc `DatePicker` and `TimePicker` in `src/components/space/session-form.tsx`), Materials, Activities, Cancelled, the hold-to-delete **Delete session**. **Apply** stages the details with the calendar changes. **Cancel** drops only the form's changes.
- Materials and activities are cards that open a native `<dialog>` to add or edit (`src/components/space/card-list.tsx`). The course materials in Notes use the same card list.
- The Save schedule bar shows only while changes wait: "3 changes wait. **Save schedule** / **Cancel**". One Save sends one request, `saveScheduleEdits({ calendar, details })`, in one transaction. The bar says that the course's own save does not save the schedule.

Two points differ from U-sessions, and ADR 0011 wins on both, because its decision log is newer and built: the drawer's **Apply** stages changes (U-sessions saved each session from its drawer), and one **Save schedule** sends all of them.

**Telling the space (D1).** After **Save schedule** on a live course that has a space, the host offers the prefilled announcement of ADR 0011 ("Saving and telling people"): the text of the changes and one schedule block, with **Publish to space** or **Skip**. On a course that is not live, no offer opens, because its sessions are visible only to its fellows and admins. Nothing is sent automatically.

**Delete.** **Delete** on a declined proposal calls the course delete endpoint (see [Lists](#lists)).

**Data.** No new fields. `saveCourse` writes through `payload.update` or `payload.create` with `user` and `overrideAccess: false`, `draft: true`. Sessions write through `saveScheduleEdits`.

**Access.** Gated writes. `adminOnlyField` (`src/access.ts:302`) refuses `cycle`, `tier`, registration and `pricing_override` from a fellow, whatever the form sends. `addSelfAs('fellows')` adds the fellow on create and needs a linked person (`canTeach`, `src/access.ts:116-117`).

**Errors.**

- A fellow with no linked person sees "Your account has no person record. Ask an admin to link one." in place of the form.
- A refused write shows the field error from Payload next to the field.
- A stale schedule save keeps the changes on screen, names the session another person changed, and offers **Reload and lose my changes** (ADR 0011).
- A session write on a submitted or declined proposal is refused by the access rule. The form is already locked, so this reaches only a REST caller.

**Tests.** Int: a fellow creates a course with only a title and `draft: true`. It saves, has the fellow in `fellows`, and has `tier: owner`. Int: the submit gate refuses a course with no description, with no session, and with a title in English and a description in Arabic only. Int: a fellow's session update on a submitted or declined, never-published course is refused, and on a live course it succeeds. Int: a duplicate of a declined course is a draft owned by the fellow, with no sessions. E2E `portal-course-form`: propose, type a title, the calendar unlocks, draw a session, add a second session with **Add session**, and place it through the drawer with the keyboard only, so its block shows on the grid. Save schedule, submit. The admin sees it in To review. On a published course: edit the description, submit, the course fields lock, move a session, Save schedule, the announcement offer opens. Tabbing through the form keeps focus visible above the Save schedule bar. The space calendar e2e (`space-calendar-edit.e2e.spec.ts`) still passes.

## Article editor

**Behavior.** `/spaces/articles/new` and `/spaces/articles/[id]`. The H1 is the title field. Enter in the title moves focus to the body. Paste into the title inserts plain text.

The body is our own Lexical editor, built on the portal rich-text core from phase 4d (`src/portal/rich-text/`, on `@lexical/react`), writing the same JSON as the admin's `articleBodyFeatures` (`src/collections/Articles.ts:124-129`, `src/lexical/article-body.ts:9-17`).

- Authors insert: paragraphs, headings, lists, quotes, bold, italic, links, uploads (images), Gallery, Footnote and Mention.
- CardStack, Columns, RelatedContent, PersonProfile and Movie are admin-only to insert (D17). In the portal they load as locked nodes. A locked node shows a read-only preview with its block name, can be moved or deleted as a whole, and round-trips its JSON untouched. The toolbar offers only the nodes an author may insert.
- Footnote edits its nested rich text in a dialog. Undo works inside it, and focus returns to the footnote mark.
- Mention and the legacy relationship node pick their target through one server action, `searchLinkTargets(query, types)`, with `overrideAccess: false`. It returns `{ relationTo, id, label }` for people, articles, courses, events, publications and programmes the author may read. The node stores the same `{ relationTo, value }` the admin stores.
- Paste or drop an image: the editor asks for its alt text, because `media` requires `alt`, then creates a `media` row (create is open to signed-in users, `src/collections/Media.ts:15-22`) and inserts an upload node. The image types and the size limit are those of profile photos (see [Security baseline](#security-baseline-phase-0)): JPEG, PNG or WebP, at most 5 MB. A larger file shows that limit under the image.

**The server guards D17.** `guardRichText(value, previous, user)` in `src/lib/rich-text-guard.ts` is a `beforeChange` field hook on every rich text field that a non-admin may write: article `body` (`Articles.ts:125`), course `description` (`Courses.ts:223`), the `description` of the old course `sessions` array (`Courses.ts:402`, hidden in the admin but open to REST), enrollment `assessment` (`Enrollments.ts:96`), person `bio` (`People.ts:72`, the reader's own person) and publication `intro` (`Publications.ts:76`). A new owner-writable rich text field gets the hook too. From a non-admin, the hook refuses any admin-only node that the previous value of the field does not hold with the same JSON. The five admin-only blocks (CardStack, Columns, RelatedContent, PersonProfile, Movie) are one exported constant, `ADMIN_ONLY_BLOCKS`, in `rich-text-guard.ts`. The editor core imports it for its toolbar. A locked node that was already there passes. The hook refuses only these five, so `/admin` keeps working for owners until phase 7. The smaller insert set of each portal field (for `description` and `assessment`: paragraphs, headings, lists, links, bold and italic) is a toolbar rule, not a server rule. The hook walks into nested block `fields` and nested editor states (Columns, CardStack and Footnote hold them), so an admin-only block inside an allowed one is found. It runs per locale, on `value` with the previous value of the same locale. It also refuses a mention or relationship node whose target the author cannot read. It reads each distinct target once, with one gated `find` per collection, so a write costs at most one read per target collection. So a REST write cannot add what the editor hides.

The side panel holds: the cover (one control that opens a popover with presets and **Upload**), **Who can read it** (`requested_tier`: "Community only. Members read it in the portal." or "Public. Ask for the public site. An admin decides."), authors, the translation group (original language, title, authors, link, source, note), tags and related articles. `published_date`, `featured` and `tier` are admin-only and not shown. On a phone, the side panel shows below the body.

**Saving.** One save per locale. The editor saves a draft 1.5 s after typing stops, and every 30 s while changes wait, through `payload.update({ draft: true, autosave: true, locale, user, overrideAccess: false })`. The language switch saves the current locale first. `langState` reads both locales with `locale: 'all'` on load. Each save sends the `updatedAt` it started from. The save status and the stale refusal (**Reload**, **Keep mine**, **See changes**) follow the [Course form](#course-form-and-the-sessions-calendar): the message reads "This article was changed in another tab or by an admin." The submit gate is the schema's: a title in the locale of the save. Submit is a full save in a locale that holds the title.

**States.** The editor uses the state table of the [Course form](#course-form-and-the-sessions-calendar), without the Sessions column: the same keys, the same locks and the same buttons, with **Submit for review** in place of **Submit course for review**.

**Version pin.** `lexical` and `@lexical/react` become direct dependencies, pinned to the exact version that `@payloadcms/richtext-lexical` uses (0.50.0 today). A check in `lefthook.yml` compares the two versions and fails on a difference. Two copies of `lexical` break node identity.

**Round-trip spike (go or no-go).** Payload documents no site-side editor, so the spike stays required. Source: [portal-research.md](2026-11-18-portal-research.md), Article editor on the site. The spike runs in parallel with phase 1 and takes 3 to 4 days. It goes when all seven checks pass:

1. A script loads every article body, in both locales, from the local prod clone into a headless editor with our nodes, exports it, and deep-compares the result with the input. Zero differences.
2. A save through `payload.update({ draft: true, autosave: true, locale, user, overrideAccess: false })` passes Payload's own Lexical validation.
3. The editor route's chunk is under 150 KB gzip.
4. A footnote dialog keeps undo and returns focus.
5. The Arabic body edits right to left, with correct caret and lists.
6. A pasted image creates a media row and renders through the site's converter.
7. The round-trip shows zero differences on every course description and every assessment in the prod clone, in both locales.

No-go means phases 4d, 5, 5b and 7 do not start. Then `guardRichText` does not ship either, and `bio`, `intro` and the old sessions `description` stay as unguarded as today, while `/admin` stays open to owners. Phase 4e ships with the read-only description. Phase 6 goes on without the editors. Articles keep opening in the admin editor, and the spike report names each node or check that failed so that the owner can decide the next step.

**Data.** No new fields. The body JSON is the same as the admin's.

**Access.** Gated writes. The review hooks lock a submitted article as they do today. `guardRichText` guards D17.

**Errors.**

- A failed autosave keeps the text in the editor, shows "Not saved. Retrying." and retries on the next change or after 10 s. Leaving the page with an unsaved change asks first, through the leave guard.
- A body node that our editor does not know loads as a locked node, so it round-trips. The round-trip check in CI catches it before release.

**Tests.** The round-trip script runs in CI on the bodies of published, public-tier articles only, plus hand-made fixtures for each node type. Drafts and private bodies never enter the repo. The full run over every body stays a local script on the prod clone, run in the spike and before the phase 5 release. Int `rich-text-guard`: a member's REST write that adds a CardStack node is refused, and a write that keeps an existing one passes. A CardStack nested inside Columns is refused. A mention of a target the author cannot read is refused. An Arabic-locale write is checked against the Arabic previous value. A fellow's `description` and `assessment` with a new Columns node are refused, and with a quote or an upload they pass. (CardStack is not in the default editor, so Payload's own validation refuses it there first.) A member's `bio` and a publication owner's `intro` with a new PersonProfile node are refused. E2E `portal-article-editor`: write, bold, add a footnote and an image, switch to Arabic, write, reload. Both locales are there, and the preview at `/api/preview` (`src/lib/preview-url.ts`) renders both.

## Participants and assessments (D18)

**Behavior.** `/spaces/courses/[id]/participants` lists the enrollments of one course: the student's name, the 40x40 photo slot, the enrollment status, and "Assessment written" or "No assessment yet". It is open to the course's fellows and to admins. The page and `participantsFor` first check that the reader is an admin or a person in `course.fellows`, and return not found otherwise (see [Data access rule](#data-access-rule)). The course list row and the course page header link to it. A row opens a sheet (`preloadable`) where the fellow writes the assessment narrative, in English or Arabic, with **Save assessment**. Fellows see who takes their course here, with spaces on or off. A person whom an admin enrolled with no application is on this list too.

The sheet uses the portal's rich-text core (phase 4d) with paragraphs, bold, italic, lists and links only, so the `assessment` JSON stays the admin's format. Other stored nodes round-trip locked, and `guardRichText` guards the field. It saves on **Save assessment**, not on a timer, and sends the `updatedAt` it started from. It shows "Saving" and "Saved", and on a failure "Not saved." with **Try again**. It shows the stale message of the course form.

**Data.** No new fields. `participantsFor(course, user)` reads the list (see [Data access rule](#data-access-rule)): a gated `find` of `enrollments` where `course` equals the id, then the names and photos of those people through the projection, because an accepted applicant's person is hidden. The write is `payload.update({ collection: 'enrollments', id, data: { assessment }, locale, user, overrideAccess: false })`.

**Access.** The existing rules, unchanged: `read` is `readEnrollments` (a fellow reads the enrollments of courses they teach), `update` is `adminOrTeachingFellow`, and the `assessor` field rule (`src/collections/Enrollments.ts`) lets a fellow read and write `assessment` on others' enrollments, never their own, and never lets the student read it.

**Errors.** A refused write shows "You cannot assess this enrollment." in the sheet. A failed list shows "The list could not load." with **Retry**. An empty list says "No one is enrolled yet. Accepted applicants show here."

**Tests.** Int: `participantsFor` returns the name and photo of a hidden person enrolled in the fellow's course, and returns nothing for a course the fellow does not teach. Int: a fellow who is enrolled as a student in another fellow's course gets not found from `participantsFor` and the page, and no row. Int: a fellow writes an assessment on an enrollment of their course. The write is refused on another course, and on the fellow's own enrollment. The student reads no `assessment`. E2E `portal-participants`: as a fellow, open the page, write an assessment in Arabic, save, reload, and it is there. As a student, the page is not found.

## Command palette

**Behavior.** One palette holds actions and content. It has no modes, and there is no second palette. Cmd+K or Ctrl+K opens it everywhere in the portal on a wide screen, and the same key closes it. The sidebar search button opens it too. It never opens on hover. In the article editor and in rich text fields, Cmd+K inserts a link, as Lexical does. A second Cmd+K, or the search button, opens the palette. On a phone, the Search row in the More sheet and the Search button in the page header open it, and it is a full-height dialog with a visible **Close** button, 44px rows and an icon on every row. It follows Arc's command palette (`src/components/arc/command-palette/command-palette.tsx`) and the WAI-ARIA combobox and listbox pattern (see ARIA below). Source: [portal-research.md](2026-11-18-portal-research.md), Command bar rules.

Groups, in this order when the query is empty, at most 12 rows in total. They fill in this order: Recent 5, On this page 3, Create 2, Go to the rest. Spaces are dropped first. **Recent** comes first: the last 5 commands the reader ran, per account, in client storage, with no frecency math. Then:

1. **On this page**, from the page's registered actions. 3 rows, then "+{n} more", which expands the group in place. Examples: Applicants: one row per course chip and "Decide on {n} applicants". To review: one row per item. Editors: **Submit for review**, "Switch writing language", "Jump to {section}". Calendar: "Go to today".
2. **Create**: "Write an article" (all), "Propose a course" (fellows, and admins with a linked person, because `addSelfAs('fellows')` needs one).
3. **Go to**: the `portalNav(user)` items.
4. **Spaces**: the reader's spaces. Hidden when spaces are off.

Each row has an icon by kind, a verb-and-object label, an optional secondary line and an optional muted count. Keycaps show only for real shortcuts, such as `[` on "Fold the sidebar". They sit on the row and are `aria-hidden`, so the palette teaches shortcuts. No row for an action the role cannot do, and no disabled rows.

Matching is the Arc command palette's default match for the local groups, over the label and the aliases, in both languages: an Arabic page matches English labels, and the reverse. Each command has aliases, so "archive" finds the right verb. The order for one query is stable. When the best match sits in a lower group, a **Top result** row shows first. Each command declares `when(ctx)`, with `PaletteCtx { role, pathname, selection }`. A command that does not apply is hidden. A command that fits the page is boosted, not shown alone.

The vendored Arc component filters every item by substring (`src/components/arc/command-palette/command-palette.tsx:64-70`). Server rows already match their query, and their labels need not hold it (a typo match, an Arabic query on an English title). So the component gets a `filter` prop, and the network groups turn the built-in match off. The palette adds these parts to the vendored component, as local edits: Recent, **Top result**, "+{n} more", "Show all in {group}", async network groups with their error row, and the `filter` prop. Arc is installed, so it is not added again.

**Sources.** Typing searches five groups:

1. On this page.
2. Go to (`portalNav`).
3. My work: one server action, `searchMyWork(query)` in `src/portal/palette/`. It returns at most 5 rows per kind: the reader's own articles and courses (gated read), the review queue for an admin (after the admin check), and applicant names from `searchApplicants(query)` in `src/forms/applicants.ts`. The applicant name is not a field. It is a row of the `submissionData` array, `{ field: 'name', value }` (`applicants.ts:142-154`). So `searchApplicants` runs one `where` with `submissionData.field` equal to `name` and `submissionData.value` like the query, plus `choices.course` in the reader's course ids for a fellow. If Payload cannot hold the two array conditions to one array row, it reads `submissionData` and `choices.course` with `select` for the reader's courses and matches `answer('name')` in memory. The int test decides which of the two ships. It takes at most 5 and returns `{ id, name, course }` only, for an admin or a fellow of that course.

`searchMyWork` checks a rate limit through `rateAllowed` in `src/lib/private-search/rate.ts`. The helper gets a `scope` argument that prefixes each key (`palette:`, `spaces-search:`), so the palette and `/api/spaces-search` keep separate counters. Today the network key of `/api/spaces-search` hashes the constant `'untrusted-proxy'` (`src/app/(frontend)/api/spaces-search/route.ts:35`), so it is one counter for the whole site with a smaller limit (180) than `global` (600). Both scopes drop the network key while the proxy gives no client address. The budgets per minute are defaults: `palette` 60 per user and 1,200 global, and `spaces-search` 45 per user and 600 global. So the site-wide limit of `/api/spaces-search` rises from 180 to 600. The palette's Space posts group still calls `/api/spaces-search` and counts against its scope. 4. Space posts (`/api/spaces-search`). 5. Site: Typesense, through the site-search adapter. Courses, people and events use the public key. Articles use the community key, which covers the community articles index only (`src/lib/community-search.ts`). Typesense holds only public and community content. Applicant data never enters Typesense.

Typing also filters Create and Spaces, as local groups.

**Results.** Each network group (3 to 5) shows at most 5 rows and a "Show all in {group}" row. Local groups show every match. Network groups wait 150 ms after typing stops and need at least 2 characters. A new request cancels the old one with an `AbortController`. Old results stay until the new ones arrive, so the list does not flicker. The listbox has `aria-busy` while a request runs. A failed group shows its own error row, "Site search is not available. Try again.", and never blocks the other groups.

**One level.** The list is flat. Esc clears the query, and the next Esc closes the palette. A command that needs a choice is one row per choice.

**Budgets.** Local filtering takes under 16 ms per keystroke for up to 500 commands. The first network results arrive under 400 ms at p75 on the prod clone. The list needs no virtualization under 2,000 rows.

**ARIA and keys.** The palette is a native `<dialog>` with `showModal()` and an accessible name. The input has `role="combobox"`, `aria-autocomplete="list"`, `aria-controls` and `aria-expanded`. The list is a `role="listbox"` with options in labelled `role="group"` groups. DOM focus stays in the input, and `aria-activedescendant` moves. Script scrolls the active option into view. Only the active option has `aria-selected`. When typing pauses, the live region, through `announce()`, says the number of results, or "No results for "{query}"." Up and Down move and wrap. Enter runs the row. Cmd or Ctrl with Enter opens a link row in a new tab. Home and End stay with the text cursor.

**Focus and motion.** The palette records the focused element before it opens and restores it on close. When a command navigates, focus goes to the h1 of the new page. The palette opens and closes with a fade of 80 to 150 ms and no movement, the same for a key and for a button. Result rows never animate while the list reorders during typing. No `transition: all`. Under reduced motion the palette appears in place.

**Data.** A client registry of `PaletteCommand { id, label, aliases, group, icon, shortcut, run, when }`, where `when(ctx: PaletteCtx)` holds the role, route and selection test. The shell provides Create, Go to and Spaces. Each page registers its "On this page" actions through `usePageCommands(commands)`.

**Access.** The server search is gated. The registry holds only actions that the role can do. Applicant names come from `searchApplicants` only, for admins and for fellows on their own courses.

**Errors.** A failed network group shows its own error row (see Results). The local rows stay.

**Tests.** E2E `portal-palette`: as a student, no "Propose" or "Applicants" rows. On Applicants as an admin, the first group is "On this page" with "Decide on". Rows differ per role, and the context rows change per route. Cmd+K in the editor inserts a link, and the second press opens the palette. The Site group fills after the pause. When it fails, its error row shows and the local rows stay. An applicant name search returns rows only for admins, and for the fellows of that course. Keyboard only: open, arrow, Enter, Esc returns focus. Focus returns after close. The phone layout shows a full-height dialog with a Close button. The palette count, the Home count and the sidebar Inbox number agree. Unit: the `when(ctx)` table, a stable order for a fixed query, and the trim order of the 12 rows of an empty query. Unit: a Site row whose label does not hold the query still shows. Int: `searchApplicants` does not match an applicant whose other answer (an essay line) holds the query. Int: `searchMyWork` calls do not count against the `spaces-search` budget.

## Onboarding

**Behavior.** No tour. Two parts.

**A checklist on Home** for a student or a fellow. Each step ticks from real data, never from a click:

- Student: 1 "Open your space and say hello" (the reader has a read marker in a space). 2 "Add a photo and a short bio" (the person has a photo). 3 "Write your first article (optional)" (the reader owns an article).
- Fellow: 1 "Open your course space" (a read marker in a space they moderate). 2 "Post the week-one announcement" (an announcement by them in such a space). 3 "Add a photo and a short bio".

A step whose data cannot exist is left out: the space steps, when spaces are off or the reader has no space. So the card can finish.

**One checklist per account.** A space page today shows its own checklist (`src/components/space/onboarding-checklist.tsx`). Its steps are per space, ticked by click through `stepMarkAction`, and stored on `space-visits`. The portal replaces it. The space page stops showing that checklist, and the Home checklist reuses its Arc component (`src/components/arc/onboarding-checklist/onboarding-checklist.tsx`). The steps with data map to the Home steps: `introduced` to "say hello", `checked_profile` to "Add a photo". The click-only steps (`saw_privacy`, `read_pinned`, `chose_digest`) go: the privacy consent stays the gate it is today, and the digest choice lives in Account, Notifications. `stepMarkAction` and the space checklist component are deleted. `saw_privacy` on `space-visits` stays, because the consent gate reads it (`src/lib/spaces-write.ts:1413`). The other four step fields (`introduced`, `read_pinned`, `checked_profile`, `chose_digest`) leave `space-visits` in M2. The plan greps each name before the drop. The intro gate reads comments, not the `introduced` column (`src/lib/spaces.ts:344-350`), so the drop is safe.

The card shows "{n} of {m} done" and **Hide**. Each step's state is in its text, not only in its icon: "Done: Add a photo and a short bio". When the count drops, `announce()` says "{n} steps to get started." Hide shows the toast "Checklist hidden." with **Undo**, and focus moves to the first Needs you row or to the H1. The palette command "Show the getting-started checklist" brings it back. When every step is done, the card leaves.

Admins get no checklist. Their steps (review, decide, open the dashboard) have no data to tick from, and Needs you already holds their work.

**After the password is set.** The set-password page (`/[locale]/welcome/[token]`) redirects to `/{locale}/spaces` when the password is saved. The `joined` notice to admins (`src/lib/invitation.ts:80-85`) stays, with its link from `documentHref`.

**Empty states** follow one pattern: one sentence about what this is, one primary button if the reader can act, and one line about what happens next. Phase 1a builds the component, and each phase writes the empty states of the pages it ships. Source: [portal-research.md](2026-11-18-portal-research.md), Onboarding and empty states.

- Articles: "You have no articles yet. An admin reads each article before it is public." **Write an article**. "Drafts save. Nothing is sent until you submit."
- All articles (admin): "No one has written an article yet." No button.
- Courses (fellow): "You do not teach a course yet. An admin reviews each proposal before it is public." **Propose a course**.
- All courses (admin): "No courses yet." **Open dashboard**.
- Applicants (fellow): "No one has applied to your courses yet. Applications open with the cycle." No button.
- Applicants (admin): "No applications this cycle yet." **Open dashboard**.
- A course chip with no cards: "No one applied to this course yet."
- To review: "Nothing to review. New articles and courses show here when someone submits them."
- Inbox, Needs you: "Nothing needs you now." Inbox, Latest: "Nothing new yet. Replies, reviews and decisions show here."
- Home, Needs you with no checklist: "Nothing needs you now."
- Calendar: "Nothing in your calendar." **Show public events** turns that legend type on.
- Unscheduled tray: "Every session has a time."
- Lanes: Waiting "No one is waiting." Accepted and Declined, admin: "No one yet. Use Move to, or drag a card here." Fellow: "No one yet. Admins decide."
- Participants: "No one is enrolled yet. Accepted applicants show here."
- Search with no result, in a list or the palette: "No results for "{query}"." with **Clear search** in a list.
- Student Home with no space: **See open courses**, to the public courses page.

**Data.** M2 adds `checklist_hidden_at` (date) to `space-preferences`. The server creates that row (`create: () => false`), so the hide action creates it with `overrideAccess: true` for the current account only, as `spaces-write` does.

**Access.** The owner may update their own `space-preferences` row. No other account's row is touched.

**Errors.** A failed hide keeps the card and shows "Could not hide the checklist. Try again."

**Tests.** Int: a member hides the checklist, and another member's row is unchanged. A REST update of another account's row is refused. E2E: a new student sees "3 steps to get started.", and adding a photo turns it to 2. With spaces off, a new student sees 2 steps. A space page shows no checklist. Each empty state above shows with the `empty` seed for its role. That seed does not exist yet (`package.json` has only `db:seed`). Phase 1a adds it as a database state, not as extra accounts, because an admin's empty states read data of every owner: an empty database with one admin, one fellow (with a linked person and no course) and one student (with no space). Its command is `pnpm db:seed:empty`. Every empty-state test runs on it.

## Profile and settings (D5)

**Behavior.** `/spaces/account` is one page inside the portal shell, in phase 1d, with three groups:

1. **Profile** (`id="profile"`, the target of the `/profile` redirect): photo, name, short bio and the other person fields that `ProfileForm` (`src/components/profile/profile-form.tsx`) edits today, through `saveProfileAction` and `removeProfilePhotoAction`. A reader with no linked person sees the existing "no person" text.
2. **Sign-in**: the account email (read-only) and **Change password**, which sends the existing reset email (the `/forgot` and `/reset` flow).
3. **Notifications**: `NotificationsSection` (`src/components/settings/notifications-section.tsx`) with push and the space email choices, as on `/settings` today. The space email choices show only when spaces are not off.

The page moves the existing components out of `src/app/(frontend)/[locale]/settings/page.tsx` into `src/portal/account/`. It does not rewrite them. `/settings` and `/profile` redirect to it.

**Data.** No new fields.

**Access.** The existing profile and preference actions, which act only on the signed-in account.

**Errors.** As today in each component.

**Tests.** E2E `portal-account`: `/settings` lands on `/spaces/account`. `/profile` lands on `/spaces/account#profile`, the final URL holds the fragment, and the Profile group (`id="profile"`) is in view. A profile save works. A photo change shows in the account menu avatar.

## Security baseline (phase 0)

Hiding a field in the portal guards nothing. A fellow with `curl` can set any field that access allows. Phase 0 makes the access rules match the portal before any portal page ships.

- **A field-access audit.** `scripts/field-access-audit.ts` walks the Payload config and prints, per collection, the access of every field for create, update and read. It calls no access function, because many rules are functions of the document (`assessor`, `isAdminOrOwn`). For each field and operation it records `open` when the field has no access function, and otherwise the function's name (`adminOnlyField`, `assessor`, and so on). Its output is committed as `tests/int/field-access-audit.snapshot.json`, one row per `{ collection, field, create, update, read }`, and a snapshot test compares it. A changed name or a new `open` fails the test, so a new field shows up in review. The role write tests below, not the snapshot, prove what each role may do. The snapshot guards new fields, and the role write tests below guard the named ones. Both stay.
- **`legacy_url`** has no field access (`src/fields/import.ts:9-17`). Redirects from the old site resolve through it, so an author can claim an unused old URL on a draft. Add `adminOnlyField` on create and update.
- **`slug`** on articles, courses and publications (`slugField()`, `src/fields/slug.ts`) has no field access, so an owner can claim a future slug on a draft. A non-admin cannot set `slug` by hand: the slug follows the title until an admin sets it. The plan picks the mechanism (field access, or a hook that drops the hand-written value) and tests that Payload's slug generation still runs.
- **`space-preferences.digest_sent_at`** has no field access, and the owner may update their row (`src/collections/SpacePreferences.ts`). Set field-level access `update: () => false` on that field only. The collection's `update` stays open to the owner, because `checklist_hidden_at` needs it. The digest job writes the field with raw SQL (`src/lib/space-digest.ts:176-189`), so field access does not block it.
- **`courses.fellows`** stays open to the owner (`Courses.ts:226`). The fellow role is granted only on publish (`Courses.ts:58-81`), so adding a co-fellow to a draft is intended. The admin sees and approves the fellows in the review pane (see [Review and history](#review-and-history)).
- **`media` create** stays open to signed-in accounts (`Media.ts:19`), for covers, photos and pasted images. For non-admins it accepts the image types and the size limit that profile photos already use (`PHOTO_TYPES` and `PHOTO_MAX_BYTES`, `src/lib/profile-limits.ts:11-12`). Files that are not images go to `space-files`, as today.
- **Jobs.** The portal adds no Payload jobs.
- **`/api/mcp`** tools already use `overrideAccess: false` (`src/plugins/mcp/tools/course.ts:24,57`). No change.
- **`form-submissions`** read stays admin only. The D12 projection change ships in phase 3.

Tests: `tests/int/portal-access.int.spec.ts`, through the Local API with `overrideAccess: false` and `user`. "Dropped" means the write succeeds and the stored value does not change. "Throws" means the call throws and nothing is stored. As anonymous, every write throws. Collection access that returns `false` throws `Forbidden`. Only field access drops a value. The Start column says whether a row fails before phase 0 (new) or passes today and must keep passing (guard), so the plan knows which red tests to write.

| Collection                      | Field or call                                                                                   | Role                             | Expected                                                                                                          | Start                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| articles, own                   | `tier`, `published_date`, `featured`, `review.review_note`, `legacy_url`, `slug`                | fellow, member                   | dropped. The slug follows the title                                                                               | new: `legacy_url`, `slug`. Guard: the rest             |
| publications, own               | `review.review_note`, `legacy_url`, `slug`                                                      | fellow, member                   | dropped. The slug follows the title                                                                               | new: `legacy_url`, `slug`. Guard: `review.review_note` |
| enrollments of a taught course  | `person`, `course`, `status`, `slot`, `source`                                                  | fellow                           | dropped                                                                                                           | guard                                                  |
| enrollments, own                | `assessment`                                                                                    | member                           | the write throws, and a read returns no `assessment`                                                              | guard                                                  |
| courses, own                    | `tier`, `cycle`, `registration`, `pricing_override`, `review.review_note`, `legacy_url`, `slug` | fellow                           | dropped. The slug follows the title                                                                               | new: `legacy_url`, `slug`. Guard: the rest             |
| space-preferences, own row      | `digest_sent_at`                                                                                | fellow, member                   | dropped                                                                                                           | new                                                    |
| articles, own, and courses, own | `_status: 'published'`                                                                          | fellow (both), member (articles) | throws `Forbidden` (`adminPublishes`, `src/access.ts:178-184`). Nothing is stored, and the document stays a draft | guard                                                  |
| media                           | create with a type outside `PHOTO_TYPES`, or larger than `PHOTO_MAX_BYTES`                      | fellow, member                   | throws                                                                                                            | new                                                    |
| form-submissions                | `find`                                                                                          | fellow, member, anonymous        | throws `Forbidden`                                                                                                | guard                                                  |

The audit snapshot matches.

## Migrations

The owner creates each migration with `migrate:create` and reviews it before it runs. The Dockerfile applies migrations on deploy.

| Id  | Change                                                                                                                                                                                                                  | Phase |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| M1  | New `review-events` collection: `doc` and `version` as integers, an index on `(collection, doc)`, `actor` nullable with `ON DELETE SET NULL`, and the `payload_locked_documents_rels` column that `migrate:create` adds | 2     |
| M2  | `space-preferences.checklist_hidden_at`, and the drop of the four unused step columns of `space-visits`                                                                                                                 | 6     |
| M3  | Notification kind enum adds `withdrawn`                                                                                                                                                                                 | 2     |

No migration: the phase 0 access fixes, `users.access.admin`, the course `onApprove`, the route groups, the session lock (D2), the fellow projection (D12), the `withdraw` move (D3), the `request` and Discard changes, and the Participants page (D18).

## Tests

Each phase ends when its tests pass. New specs:

| Spec                    | Kind              | Covers                                                                                                                                                                                                                                             | Phase                                                  |
| ----------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `portal-access`         | int               | phase 0 refusals, audit snapshot                                                                                                                                                                                                                   | 0                                                      |
| `portal-shell`          | e2e and unit      | skip link, landmarks, nav per role, every nav item opens a page, the `(site)` smoke routes, axe, keyboard walk, `announce()`, toast over a modal, `SuccessCheck` reduced motion, folded state and its accessible names, toast and focus at 390px   | 1a                                                     |
| `portal-spaces-off`     | e2e               | portal pages load, `/spaces` lists no space, space pages and every dialog route are not found, a dialog closes on navigation                                                                                                                       | 1a                                                     |
| `review-status`         | unit and int      | `statusOf`, `waitsOn`, `neverPublished`, `hasUnsentEdits`, the `request` hook table                                                                                                                                                                | 1b                                                     |
| `document-href`         | unit              | links per collection, viewer, `waiting` value and locale                                                                                                                                                                                           | 1b                                                     |
| `portal-lists`          | e2e and int       | rows, groups, paging, empty states (e2e). The owner delete of a declined item (int)                                                                                                                                                                | 1b                                                     |
| `needs`                 | int and e2e       | `needs(user)` rows, `needsCounts(user)` totals, the applicant count per choice, live refresh                                                                                                                                                       | 1c                                                     |
| `portal-home`           | e2e               | Home and Inbox per role                                                                                                                                                                                                                            | 1c                                                     |
| `portal-calendar`       | e2e               | preset legend, own Community-tier sessions, Arabic week                                                                                                                                                                                            | 1d                                                     |
| `portal-account`        | e2e               | redirects, profile save                                                                                                                                                                                                                            | 1d                                                     |
| `pending`               | unit              | the state machine, the cause set, one commit per item                                                                                                                                                                                              | 2                                                      |
| `review-events`         | int               | append-only history, `reviewHistoryFor` on a published item, withdraw, Discard and **Restore them**, stale 409, repeat 200, the move table and its 400 cases, the lock with an owner's withdraw, `Origin`, one email per recipient in their locale | 2                                                      |
| `portal-review`         | e2e               | approve with cycle and tier, undo, notes, history                                                                                                                                                                                                  | 2                                                      |
| `application-commit`    | int               | one email per decision under retry, reopen                                                                                                                                                                                                         | 3                                                      |
| `applicants` (extended) | int               | fellow money keys on own courses, no other courses                                                                                                                                                                                                 | 3                                                      |
| `portal-applicants`     | e2e               | menu, drag, ring, undo, commit, reopen, fellow view, worst case                                                                                                                                                                                    | 3                                                      |
| `course-proposal`       | int               | title-only draft, submit gate, session lock, duplicate                                                                                                                                                                                             | 4b (lock), 4c (gate), 4e (title-only draft, duplicate) |
| `rich-text-guard`       | int               | admin-only nodes refused from non-admins in every owner-writable rich text field, nested blocks, unreadable mention targets, both locales                                                                                                          | 4d, 5                                                  |
| `portal-course-form`    | e2e               | propose, calendar, Add session placed through the drawer, submit, live sessions                                                                                                                                                                    | 4e                                                     |
| `portal-article-editor` | e2e               | write, footnote, image, both locales, reload                                                                                                                                                                                                       | 5                                                      |
| `portal-participants`   | e2e and int       | the list with a hidden person's name, the fellow-of-course gate, an assessment write, refusals                                                                                                                                                     | 5b                                                     |
| `portal-palette`        | e2e, unit and int | rows per role and route, editor Cmd+K, Site group and its error row, applicant search by role, keyboard, focus, phone, counts agree. Unit: `when(ctx)`, stable order                                                                               | 6                                                      |
| `onboarding`            | int and e2e       | hide flag per account, steps from data, spaces off                                                                                                                                                                                                 | 6                                                      |
| `portal-admin-lock`     | e2e               | each role's old admin tasks in the portal, including a fellow's assessment, and `/admin` closed                                                                                                                                                    | 7                                                      |

Every e2e spec runs as admin, fellow and student, in English and Arabic, at 1440px and 390px. In Arabic at 390px there is no horizontal scroll, the lanes mirror, directional icons mirror, and the calendar starts on Saturday on the right. Arabic runs test whole forms as journeys: direction, validation text, dates and numbers. break-ui checks use long Arabic strings, because Arabic text is often 20 to 30 percent wider than English. The shell, Home, the board and both editors also run at 320px and at 200% zoom. axe runs on every route. The undo window comes from an env value that only test builds read, so e2e waits 1.5 s, not 5 s.

## Phases

Each phase ships alone and keeps the site working. Every phase ships its pages complete at 1440px and 390px, with their empty states and the reduced-motion branch of each animation. The last task of each phase is its review task, named in its Review line (see [UI skills](#ui-skills-which-one-when)).

A nav item, a button or a link that opens a portal page ships in the phase that ships that page. Before that phase it is not shown, or it opens the admin page that does the task today. No flag holds this: each phase's PR adds its own items and changes its own links.

| Target                                                                | Before its phase                                                     | Phase |
| --------------------------------------------------------------------- | -------------------------------------------------------------------- | ----- |
| Home (`/spaces`)                                                      | today's page, inside the new shell, with its shortcuts into `/admin` | 1c    |
| Articles, Courses                                                     | not shown                                                            | 1b    |
| Inbox                                                                 | not shown                                                            | 1c    |
| Calendar                                                              | not shown                                                            | 1d    |
| Home's **Open the calendar** (admin, no session)                      | not shown                                                            | 1d    |
| Profile and settings in the account menu                              | `/settings`                                                          | 1d    |
| To review, and an admin's `documentHref` for a waiting document       | `/admin/reviews` and the document's admin URL                        | 2     |
| An owner's `documentHref`                                             | the document's admin URL                                             | 2     |
| Applicants, "{n} applicants wait. View list", the `application` links | `/admin/applicants`                                                  | 3     |
| **Propose a course**, course **Edit**                                 | the admin create and edit pages                                      | 4e    |
| **New article**, article **Edit**                                     | the admin create and edit pages                                      | 5     |
| "Participants"                                                        | not shown                                                            | 5b    |

**Phase 0. Security baseline.**
Scope: the [Security baseline](#security-baseline-phase-0). No visible change.
Ends when: `portal-access` passes, and the audit snapshot is committed.
Depends on: nothing.
Review: code-review, then security-review.

**Spike. Editor round-trip.** Runs in parallel with phase 1.
Scope: the seven checks in [Article editor](#article-editor), over article bodies, course descriptions and assessments.
Ends when: the report gives go or no-go with the numbers.
Depends on: the local prod clone.
Review: code-review, then security-review.

**Phase 1a. Frame and shell.**
Scope: the `(site)` and `(portal)` route groups (D11), the `(rooms)` group with the one spaces-off check and the `@dialog` catch-all, `portalNav` with Home, the reader's spaces and, for admins, **Open dashboard**, the sidebar, the bottom bar (Home and More) and the More sheet, the account menu, the shared parts of the [Accessibility baseline](#accessibility-baseline) (skip link, landmarks, live region and `announce()`, focus ring token), the `ToastStack` edit that shows toasts above an open `<dialog>`, `SuccessCheck` with its text-only reduced-motion branch, the reduced-motion tokens, the empty-state component, the `empty` seed (`pnpm db:seed:empty`), and the contrast table. `/spaces` shows today's page inside the shell, and with spaces off that page skips `mySpaces` (see [Frame](#frame-d11)). The shell has no pending provider yet. Phase 2 mounts it and adds the **Sign out** flush.
Ends when: `portal-shell` and `portal-spaces-off` pass. Every nav item and every account menu row opens a page that loads. A post link from Home opens the full page, and inside a space it opens the dialog. A smoke e2e visits the home page, an article, `/login`, a `/welcome/{token}` link and a missing path, and each shows the same site header, main and footer as before the move. The contrast unit test passes. Unit: `announce()` reads a repeated message twice. In `portal-shell`, a toast raised while a modal sheet is open shows above it. Its text is in the accessibility tree, and its action is reachable by keyboard. If the browser keeps the toast inert, the e2e checks the fallback instead: the text shows in the modal's status line. `SuccessCheck` with `reducedMotion: 'reduce'` shows its text and no drawing. The folded state survives a reload for the same account and not for another. At 390px, with a toast shown, a focused row near the bottom is not covered. In `portal-spaces-off`: with spaces off, `/spaces` loads and lists no space. `pnpm db:seed:empty` runs on an empty database, and the three accounts sign in.
Depends on: phase 0.
Review: ux-auditor and better-interface on the shell, then break-ui.

**Phase 1b. Status and lists.**
Scope: `statusOf`, `reviewed-fields.ts`, `waitsOn(key)` and `neverPublished(doc)` in `src/lib/review-status.ts`, the `request` change with its hook test table, `statusBadge` and `nextAction`, `documentHref` (every link gives the admin URL), the Articles and Courses lists and their nav items with their empty states and paging, and the access change that lets an owner delete a declined, never-published item (the Delete button ships with the editors). The Needs you group of a list holds the rows whose `waitsOn(key)` names the reader. The header buttons open the admin create pages. A course row has no applicant link and no Participants link yet.
Ends when: `review-status`, `document-href` and `portal-lists` pass.
Depends on: phase 1a.
Review: ux-auditor and better-interface on the lists, then break-ui.

**Phase 1c. Tasks, Home and Inbox.**
Scope: task 1 measures today's `/spaces` TTFB at p75 per role on the prod clone and writes the number in the plan. Then `needs()` on `waitsOn`, `needsCounts()`, `countWaitingApplicants`, `countReviewQueue`, the sidebar counts, the Inbox nav item, live refresh, Home (without the checklist) and Inbox. Home replaces today's `/spaces` page and its shortcuts into `/admin`.
Ends when: `needs` and `portal-home` pass. The total of `needs(admin)` matches the admin queue on the prod clone. Home TTFB at p75 per role is no slower than the task 1 number, and under 800 ms when that number is under 800 ms.
Depends on: phase 1b.
Review: ux-auditor and better-interface on Home and Inbox, then break-ui.

**Phase 1d. Calendar and account.**
Scope: the Calendar tab and its nav item, with the gated read of the reader's own sessions, and `/spaces/account` with the redirects (D5). The account menu row opens `/spaces/account`. The plan reads the ui-sdk skill before it sets the legend preset of the calendar component.
Ends when: `portal-calendar` and `portal-account` pass.
Depends on: phase 1a.
Review: ux-auditor and better-interface on the Calendar and Account pages, then break-ui.

**Phase 2. To review, history and the pending provider.**
Scope: the pending provider and its state machine, mounted in the shell, with the **Sign out** flush, `review-events` (M1), `withdrawn` (M3), withdraw (D3), Discard with **Restore them**, the review endpoint with its move table, lock and stale check, the To review nav item, list and pane with history and diff (D9), Publish as (D6), course approval with cycle and tier (D10), and the admin and owner links in `documentHref` with the email and notification rewrite and the one-off link script. `/spaces/articles/[id]` and `/spaces/courses/[id]` render read-only (see Read-only views in [Review and history](#review-and-history)) with the status banner, the history, and the state buttons that are not edits: **Withdraw**, **Withdraw changes**, **Request removal** and **Discard my changes**. **Edit** opens the admin editor until phases 4e and 5.
Ends when: `pending`, `review-events` and `portal-review` pass, and an owner's email link opens the portal.
Depends on: phase 1c, M1, M3.
Review: ux-auditor and better-interface on To review and the read-only pages, then break-ui, then security-review of the review endpoint.

**Phase 3. Applicants board.**
Scope, in order: task 1 is the half-day check of ui-sdk `createTransfer`, with its pass lines (see [Applicants board](#applicants-board)) and the fallback of **Move to** only. Then the board and its nav item, **Move to** with Reopen, the pending card on the phase 2 provider, `commitCourseDecision`, the "View list" link on course rows, the `application` links in `documentHref` with a second run of the link script, and the D12 projection change with its edit to `docs/decisions/applicants-review.md`. Only when the check passed: pointer drag, the ADR 0011 amendment, the lint change and the `AGENTS.md` line (D13).
Ends when: `portal-applicants`, `application-commit` and the extended `applicants` int spec pass.
Depends on: phase 2.
Review: ux-auditor and better-interface on the board, then break-ui.

**Phase 4a. Shared schedule host.**
Scope: move `SpaceCalendarEditor` to `schedule-host.tsx` with a calendar parent, and add **Add session**.
Ends when: the space calendar e2e passes, with a session created through **Add session** and placed through the drawer.
Depends on: phase 1a.
Review: ux-auditor and better-interface on the space Calendar tab, then break-ui.

**Phase 4b. Session lock.**
Scope: the sessions access constraint for `submitted` and `rejected` proposals (D2).
Ends when: the session-lock cases of `course-proposal` pass.
Depends on: phase 0.
Review: code-review, then security-review.

**Phase 4c. Submit gate.**
Scope: `courseSubmitGaps` and its `beforeChange` hook (D4).
Ends when: the gate cases of `course-proposal` pass.
Depends on: phase 0.
Review: code-review, then security-review.

**Phase 4d. Rich-text core.**
Scope: the portal Lexical editor core in `src/portal/rich-text/` that reads and writes the stored JSON, with one feature set per field. Authors insert paragraphs, headings, lists, links, bold and italic. Every other node that a stored value holds round-trips locked, as D17 says. The D17 server guard as one function, `guardRichText`, with `ADMIN_ONLY_BLOCKS`, applied to every owner-writable rich text field except the article `body` (see [Article editor](#article-editor)). Phase 5 applies it to the article `body`.
Ends when: the round-trip script shows zero differences on every course description and assessment, and the `rich-text-guard` cases of every field except `body` pass.
Depends on: a go from the spike, and phase 0.
Review: code-review, then security-review of `guardRichText`.

**Phase 4e. Course form.**
Scope: the course form, proposals, `saveCourse` with its save states, the live-session line, the announcement offer (D1), the notes hints (D7), **Delete** and **Duplicate as a new draft**, and the **Propose a course** and course **Edit** links.
Ends when: `portal-course-form` passes, and the space calendar e2e still passes.
Depends on: phases 2, 4a, 4b, 4c and 4d. On a no-go from the spike, 4e ships without 4d: the Basics section shows the description read-only with **Edit description in the dashboard**, which opens the admin course editor. `/admin` stays open on a no-go, because phase 7 does not start.
Review: ux-auditor and better-interface on the course form, then break-ui.

**Phase 5. Article editor.**
Scope: the article feature set on the phase 4d core, per-locale autosave with the stale check, uploads with alt text, footnotes, mentions, the locked admin-only blocks, `guardRichText` on `body` (D14, D17), the version pin, **Delete** and **Duplicate as a new draft**, and the **New article** and article **Edit** links.
Ends when: the round-trip script shows zero differences on every article, `portal-article-editor` and the `body` cases of `rich-text-guard` pass, and the editor chunk is under 150 KB gzip.
Depends on: phases 2 and 4d.
Review: ux-auditor and better-interface on the editor, then break-ui.

**Phase 5b. Participants and assessments (D18).**
Scope: the [Participants](#participants-and-assessments-d18) page with `participantsFor`, the assessment sheet, and the "Participants" link on course rows and in the course page header.
Ends when: `portal-participants` passes.
Depends on: phase 4d (the editor that writes the assessment JSON) and phase 2 (the course page). It needs nothing of the course form or the article editor.
Review: ux-auditor and better-interface on the page and the sheet, then break-ui.

**Phase 6. Palette and onboarding.**
Scope: the palette and its entry points (the sidebar search button, the More sheet's Search row, the phone header Search button), `searchMyWork` and `searchApplicants`, the `scope` argument of `rateAllowed` with its budgets, and the checklist (M2) that replaces the space checklist.
Ends when: `portal-palette` and `onboarding` pass.
Depends on: phases 1a to 4e (the palette lists actions from every page), phases 5 and 5b when the spike is go, M2.
Review: ux-auditor and better-interface on the palette and the checklist, then break-ui.

**Phase 7. Close the admin to non-admins, then the Arabic pass.**
Scope: `access.admin` on `users` allows admin roles only. The proxy cannot do this: the token holds no roles (`roles` has no `saveToJWT`, `src/collections/Users.ts:238-245`), and the proxy only sees that the `payload-token` cookie exists (`src/proxy.ts:32`). With `access.admin` closed, Payload refuses the admin to other accounts and shows its unauthorized route (`admin.routes.unauthorized`, default `/unauthorized`). Task 1 of the phase proves a redirect from that route to `/{locale}/spaces`, through a custom admin view at that path. If no redirect works, the unauthorized view keeps Payload's page with a link to the portal. Check that `/api/preview` (`src/lib/preview-url.ts`) works for owners without admin access. Then one native-speaker pass over every `Portal` string (D8), as the last step.
Ends when: `portal-admin-lock` passes, every phase 0 refusal still holds, preview works for owners, no `notifications.link` of a non-admin starts with `/admin`, and the Arabic pass is merged.
Depends on: phases 3, 5, 5b and 6, and the publications decision (D16). If D16 picks a portal list and form for publications, a phase 5c (Publications) is added before phase 7, and phase 7 depends on it too.
Review: ux-auditor and better-interface on every portal page in Arabic, then security-review of the admin lock.

## Decisions log

The owner approved each decision on 2026-11-18, except D16. Each entry gives the answer and the section that holds the rule.

- **D1. Session change notice.** No automatic notice. After **Save schedule** on a live course, the host offers the prefilled space announcement, which the fellow may publish or skip. No notification kind exists for a session change. See [Course form](#course-form-and-the-sessions-calendar).
- **D2. Sessions of a proposal.** A live course's sessions stay live with no review (ADR 0011). On a course that is not live, a non-admin may not change its sessions while the course is `submitted` or `rejected`. See [Course form](#course-form-and-the-sessions-calendar).
- **D3. Withdraw.** An owner may withdraw: `submitted` goes back to `draft`. Admins get `withdrawn`, and the queue row leaves. See [Review and history](#review-and-history).
- **D4. Minimum to submit a course.** A title and a description in the same language, at least one session, and the course type. Other gaps are a warning list. See [Course form](#course-form-and-the-sessions-calendar).
- **D5. Profile and settings.** Inside the portal shell in phase 1, one page with three groups: profile, sign-in, notifications. See [Profile and settings](#profile-and-settings-d5).
- **D6. Publish at another tier.** Yes. **Publish as** starts at the requested tier, and the writer's notification names the tier. See [Review and history](#review-and-history).
- **D7. Audience of course notes.** The content warning, the language note and the facilitator note show on the public course page. Each has one hint line saying so. See [Course form](#course-form-and-the-sessions-calendar).
- **D8. Arabic review.** One native-speaker pass at the end, as the last step of phase 7. Until then, write gender-neutral noun phrases and use `Intl.PluralRules` (through ICU plurals in next-intl). See [Phases](#phases).
- **D9. Diff on resubmission.** Yes, a field-level diff from Payload versions. See [Review and history](#review-and-history).
- **D10. Course approval.** The admin picks the cycle (required) and the tier in the review pane as part of **Approve and publish**. Approval publishes at once. See [Review and history](#review-and-history).
- **D11. Frame.** `(site)` and `(portal)` route groups under one root layout, the inset sidebar shell with the bell and the account menu at its top, a phone bottom bar. The spaces "off" switch hides only space routes. See [Architecture](#architecture).
- **D12. Applicant money fields.** Fellows see the money fields of applicants on their own courses. Fellows see only their own courses, view only, and never decide. This changes `docs/decisions/applicants-review.md` and the fellow projection in `src/forms/applicants.ts`, in phase 3. See [Applicants board](#applicants-board).
- **D13. ui-sdk for the board.** ADR 0011 is amended, if the phase 3 check passes, so that `src/components/board/ui/` may also import ui-sdk, and the lint rule and `AGENTS.md` allow that folder. See [Applicants board](#applicants-board).
- **D14. Close `/admin` to non-admins.** Yes, in phase 7. This rules out Payload's `RenderLexical` on the site, because its server functions call `canAccessAdmin` (`@payloadcms/ui/dist/forms/fieldSchemasToFormState/serverFunctions/renderFieldServerFn.js:20-23`). See [Phases](#phases).
- **D15. Undo window.** A browser timer of 5 s, for applicant decisions and for review decisions, through one pending provider. Undo is on the pending item, in the toast and in **Undo all**, and Esc undoes the focused item. There is no Cmd+Z and no setting for the timer length. A `keepalive` fetch on `pagehide`, on a hidden tab, on leaving the portal and on sign-out commits early. A crashed browser loses the pending decision. Other admins do not see pending decisions. See [Pending decisions](#pending-decisions-and-the-undo-window).
- **D16. Publications.** Open. See [Open questions](#open-questions).
- **D17. Editor blocks.** Our own Lexical editor with the same JSON. Authors insert text, links, images, galleries, footnotes and mentions. CardStack, Columns, Related content, Person profile and Movie are admin-only to insert and round-trip untouched. A server hook enforces it. See [Article editor](#article-editor).
- **D18. Assessments in the portal.** Fellows write assessments on a per-course Participants page, under the existing Enrollments access rules. Phase 7 depends on it. See [Participants](#participants-and-assessments-d18).

## Calls this spec makes that no decision covers

The owner approved D1 to D18, except D16, which is open. This spec also makes the calls below, each forced by a decision or by the code. The owner reviews them with the spec.

- **No `decided` kind, and no fellow row "N accepted. See who".** No decision needs it. The board shows decisions to fellows.
- **Declined items are not in Needs you.** A decline asks for no work. The bell, the email and the Closed group carry it.
- **A live withdraw moves the draft copy to `draft`.** Moving it to `approved` would publish the edits, because `applyReview` publishes every move to `approved` (`review-hooks.ts:175-182`).
- **A repeated review commit is a no-op, not a 409.** The review endpoint checks the newest `review-events` row first, so a retry after a lost response does not tell the admin that someone else decided.
- **A pending-decision toast follows the pending timer, not the 8 s toast rule.** A hidden tab commits it instead of pausing it.
- **An unknown status combination falls back to `draft`.** A document that is not live with `review.status: approved` returns `draft` and logs a warning. `published` would be wrong for a document that is not on the site.
- **Discard is a draft save, not `restoreVersion`.** `applyReview` refuses a restore by an owner in every state. **Restore them** brings the discarded edits back as unsent edits, from the version before the discard.
- **Discard commits at once, with a restore line, not a pending timer.** A pending item would commit early on a tab switch, and the bar copy "{n} emails wait" is wrong for an action that sends no email. The persistent **Restore them** line keeps the rule "undo, not confirm".
- **ADR 0011 wins over U-sessions.** The calendar look and the drawer's Apply and one Save come from the ADR 0011 decision log, which is newer than U-sessions and built.
- **Programme applications stay in `/admin`.** The board holds course choices only.
- **The Sign-in group** holds the account email and **Change password** through the existing reset email. Email changes stay with admins.
- **No Enrollments nav item.** Admins open enrollments in `/admin` from **Open dashboard**. Fellows reach the enrollments of each course from its Participants page (D18).
- **Students have no enrollments page.** A student sees the courses they take as spaces and on the calendar. The enrollment record (status, source) is for admins and for the course's fellows. Today the admin shows a student their own enrollments (`src/plugins/role-nav.ts:21-27`, `readEnrollments` in `src/access.ts:198-204`), and after phase 7 it does not.
- **Reopen has no Undo.** It sends no email, and a new decision is one **Move to** away. An Undo would be a second accept, which sends an email.
- **No success check on the first view of published work.** It would need a stored "seen" fact. The bell cannot stand in, because it marks a row read when the reader opens it (`src/components/site-notifications.tsx:168`).
- **One checklist per account.** The Home checklist replaces the per-space checklist, and its click-only steps go.
- **No admin checklist, and no checklist step without data.** Steps tick from data only. "Open your calendar", "Read the applicant list" and the admin steps have no data to tick from.

## Open questions

- **D16. Publications.** Publications go through review (`src/lib/reviewed-collections.ts`), and fellows and students can edit them in `/admin` today (`src/plugins/role-nav.ts`). After phase 7 they cannot. Before phase 7 the owner decides: a portal list and a simple form for publications, under the same status model, or publications become admin-only to edit. Until then the To review queue lists submitted publications (they are reviewed collections), and owners edit them in `/admin`. A portal list and form add a phase 5c before phase 7 (see [Phases](#phases)).

## Later (not in this spec)

- Article conversations and co-authoring: see the [article collaboration proposal](2026-11-18-article-collaboration-proposal.md). Deferred by the owner on 2026-11-18.
