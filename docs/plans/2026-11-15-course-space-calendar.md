# The course space Calendar tab, with edit mode

ADR 0011, order of work step 4. Run under pstack poteto-mode ("Sequence Work into Verifiable Units").

## Done means

A student opens a course space, goes to the Calendar tab, and sees the course's sessions and the space's events on the week of the next meeting. A click on a session opens a drawer with the session. A fellow or an admin clicks Edit, moves, draws or resizes sessions, and saves; the step 3 announcement dialog opens. In the drawer, a fellow or an admin edits the session (title, description, materials, activities, meetings, cancelled) and saves; a change to meetings or Cancelled opens the same dialog. The check is falsifiable:

1. Adapter unit tests and loader int tests: a student, a fellow of the course, a fellow of another course, an admin; space events show and are never editable.
2. Render and ARIA tests of the tab; snapshot compare against `head-noarchive` with 0 differences.
3. E2e: a click on a block in the tab, in the syllabus and in a post's schedule block opens the same drawer.
4. E2e: a fellow moves a session, saves, the dialog opens; Cancel changes nothing; a student sees no Edit; leaving with unsaved changes warns.
5. E2e: a drawer edit saves; a change to meetings or Cancelled opens the dialog; a stale save keeps the changes and offers "Reload and lose my changes".
6. Typecheck, lint, unit, int, one cold e2e run, `CI=1 pnpm build`, snapshot compare against `head-noarchive` (delete `.next/cache/fetch-cache` first; check for left fixture courses first), screenshots: en and ar, light and dark, desktop and phone.

## Owner's decisions (2026-11-15)

- **Space events do not drag.** They show on the calendar in their own tone and stay editable from their post. 9 space events exist, none in the future. Drag can come later if fellows ask.
- **The drawer has a full Edit form** in the space: title, description (Arc editor), materials, activities, meetings, cancelled. Its components come from the Arc skill, chosen for the simplest clear UI. The form uses TanStack Form (`@tanstack/react-form` 1.33.5, already pinned), in the pattern of `components/profile/profile-form.tsx` (array fields, `focusFirstError`). Meeting checks come from `meetingProblem` in `lib/meetings.ts`, never a copy.
- **No live update** of open calendars in this step. The stale-save message protects against overwrites.
- **The Events tab stays** as it is, next to the Calendar tab.
- **Cohort spaces get no Calendar tab** for now (they have no course).

## Facts the design rests on (checked 2026-11-15)

- `lib/calendar-sources.ts` has one adapter, `course` (sessions). There is no adapter for space events.
- The course adapter reads the course with `draft: true`, as the admin shows it. A student must see only what the published course shows.
- `loadCalendarItems` (`actions/load-calendar-items.ts`) returns items and `canEdit` from the adapter, which asks the sessions collection's own access.
- Space events are `space_posts` with `event_starts_at` and `event_ends_at` (instants).
- The schedule block (`components/space/schedule-block.tsx`) links to the session's filtered feed until the drawer exists.

## Units, in order

Each unit ends in a check, and the next unit starts only when that check passes. One delegate at a time in this checkout.

1. **Read side.** A space parent for the calendar: the course's sessions plus the space's events (read only), and `canEdit` from the sessions collection's access, no copy of the moderator rule. Students get the published course. Check: item 1.
2. **Calendar tab, view mode.** Next to Syllabus, server rendered, opens on the week of the next meeting (else the last). Course spaces only. Check: item 2.
3. **Session drawer.** One session view for the drawer and the syllabus, loaded with `preloadable`. The tab, the Syllabus tab and the schedule block open it. Check: item 3.
4. **Edit mode.** Edit and Done, save through `saveCalendarChanges`, leave warning from `onUnsavedChange`, stale save, then `scheduleChanges` and the step 3 dialog. Check: item 4.
5. **Drawer Edit form.** TanStack Form, Arc components (Arc skill first). Check: item 5.
6. **Close.** Item 6 and this plan's decision trail.

## Decision trail

| Unit         | Commit                                | Check                                                                                                                                                                                                                                                                                                                                                                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Read side | `9f384af8` (code), `0be905a9` (tests) | `pnpm typecheck`; `pnpm lint` (existing unrelated warnings); `pnpm test:unit`: 202 files, 1732 passed, 1 expected failure; space calendar int: 11 passed; related save-calendar-changes and course-sessions int: 24 passed. Local Docker DB only. Faults: unconditional draft read failed the pending-draft test; editable event flag failed the adapter test; both restored by editing. | Passed. Fix: the `space` source composes the course source and access-checked, neutral, read-only event items; existing server loader serves both. Course draft reads use sessions' own edit access. Cohorts return `invalid` with typed reason `no-calendar`. Problems solved: no combined space parent, events stored as instants, unconditional draft reads hiding the published calendar from readers. Raw draft read: member and unrelated fellow get 404 for a pending draft, course fellow and admin get the draft; the adapter now gives readers published data and editors draft data. Sessions have versions but no drafts. Fixture cleanup verified. UI, tab wiring and drag suppression using the generic `readOnly` flag belong to later units. |

| 2. Calendar tab, view mode | `58fa109a` (code); tests and this row committed together | `pnpm typecheck`; `pnpm lint` (existing unrelated warnings); `pnpm test:unit`: 203 files, 1738 passed, 1 expected failure; touched `space-calendar.int.spec.ts`: 11 passed. Faults: opening on the first meeting failed 3 of 6 focused tests; showing Calendar for a cohort failed 1 of 6; both restored by editing, all 6 pass. Visual: local course 405, space 10, next meeting 2026-11-16; en/ar, light/dark, 1440×900 and 390×844. Eight PNGs and capture script in `~/Backups/cilas/screenshots/step4/unit2/`; no horizontal overflow or browser page errors. Local Docker DB only. | Passed. Fix: course-only URL view loads reader-authorized items on the server; shared `openingDay(items, today)` in `lib/calendar-items.ts` serves admin and space hosts; the space supplies sessions so events never shift its opening week. `ScheduleCalendar` owns both hosts' view rendering and block navigation; sessions use the existing filtered-feed link, events open their post. Plain `invalid` replaces unused `reason: no-calendar`. Feed grid uses a bounded column. Problems solved: no space Calendar view; duplicated opening-week rule; no shared block routing for events; implicit feed track overflow at phone width. Existing Arc segmented navigation, alert and calendar reused. Throwaway local user, person and visits deleted; dev server stopped. Drawer, editing and live updates remain later units. |
