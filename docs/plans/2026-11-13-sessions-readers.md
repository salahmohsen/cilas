# Move course readers to the sessions collection

ADR 0011, Migration steps 4 to 6 for courses. Run under the figure-it-out skill of pstack poteto-mode.

## Done means

Every page, feed, list, space view and AI assistant tool that shows or writes a course's time reads or writes the `sessions` collection through `src/lib/meetings.ts`. The check is falsifiable:

1. `rg` finds no course code that imports `expandSchedule`, `sessionsInOrder`, `scheduleEndDate`, `nextSession`, `isOnCalendar` or `hasDayPrecision`, and no course code that reads `course.sessions` (the old array) or `course.schedule`. Events still use `src/lib/schedule.ts` until their own phase.
2. A snapshot script records, for every course, what each reader produces, before the change and after it. The diff is empty, except for a listed set of expected changes.
3. Typecheck, lint, unit tests and integration tests pass.
4. On the dev server, a course page, the calendar and a course space show the same dates in English and Arabic as before.

## Expected changes (the only diffs the snapshot allows)

- New untitled sessions (147) show as "Session N" or "Week N".
- 37 courses with archive start dates now have real meetings on the calendar and the course page.
- 18 courses show their weekly times as words where the note was empty.

## Rigor

High. The public course pages, the calendar and the spaces show these dates, and the AI assistants write courses. The old database columns stay until ADR step 7, and a database backup exists, so each unit can be reverted.

## Units, in order

Each unit ends in a check, and the next unit starts only when that check passes.

1. **Harness.** `scripts/snapshot-course-readers.ts` captures each reader's output per course as JSON. Run it on the current code and commit the baseline. Check: the script runs twice with an identical result.
2. **Time module surface.** Settle the functions the readers need in `src/lib/meetings.ts` and one loader that fetches a course's sessions in order. No reader changes yet. Check: unit tests.
3. **Public readers.** The calendar data and ICS feed, the course page, syllabus and JSON-LD, the lists by start date (`first_day`), `llms` and the search index. Check: snapshot diff equals the expected changes; tests pass.
4. **Spaces.** Next session, session options, session references and the space lifecycle. `course_session` becomes a relationship to `sessions`. A one-time script rewrites the 8 posts' session tokens from the ID map. Check: snapshot diff for space outputs; the 8 posts render their session.
5. **Writers.** In the admin, the old `sessions` array and `schedule` group become hidden and read-only, and the `syllabus` join edits sessions in Payload's drawer until the calendar field arrives. The MCP tools and their validation write sessions. Seeds write sessions. Check: an MCP draft-course test creates sessions; the admin course form shows the join; seed run works on a fresh database.
6. **Delete the old course code paths.** Remove course use of the pattern code and the old change-notice hook. Check: the `rg` predicate above returns nothing.

## Known gap

The old change notice compares the old array. After unit 6, schedule changes send no notice until ADR step 3 (the outbox). Production is in beta with no real users, so this gap is acceptable on the dev copy, and step 3 comes next.

## Decision trail

Each unit adds a row here when it lands: the unit, the commit, the check that ran and its result.

| Unit | Commit | Check | Result |
| ---- | ------ | ----- | ------ |
