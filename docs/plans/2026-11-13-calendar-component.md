# The calendar component and the admin Sessions tab

ADR 0011, order of work step 2. Run under pstack poteto-mode.

## Done means

An admin opens a course, goes to the Sessions tab, and sees the course's sessions on a week calendar. In edit mode the admin draws, moves, resizes and deletes meetings with the mouse, the keyboard and touch, places an Unscheduled session on the grid, and saves every change at once, or cancels them. A click on a block opens Payload's drawer with the session form. The check is falsifiable:

1. An e2e test draws a session, moves a meeting, saves, reloads and finds the new meetings in the database; a second test cancels and finds no change.
2. The snapshot compare (`scripts/snapshot-course-readers.ts --compare head-unit6-prod <head>`) exits 0: the public readers show the same dates as before.
3. `saveCalendarChanges` int tests: a fellow cannot change another course's sessions; one bad change saves nothing; a stale `updatedAt` fails the whole save.
4. The component's keyboard and ARIA tests pass (ui-sdk testing kit).
5. On the dev server, course 296 in English and Arabic (right to left), light and dark, desktop and phone width.

## Decisions from the prototype (accepted 2026-11-13)

The prototype is branch `t3/calendar-week-view-prototype` (commits `b927ef0d`, `dbf53e6a`). It is a reference, not merged. Its dev page goes away with it.

1. A sticky save bar (count, Cancel, Save) plus a dot on each changed block.
2. In edit mode the hour range is fixed when edit mode opens: one hour before the earliest meeting to one hour after the latest. View mode shows the earliest to the latest meeting.
3. A deleted block stays as a dashed ghost with "Restore" until Save or Cancel.
4. A draw makes a new session with one meeting. An Unscheduled session goes on the grid by a drag from the tray, or by its "Place on day" action from the keyboard.
5. Touch: in view mode the grid scrolls; in edit mode a tap selects a block, and a selected block shows resize handles of at least 24 px. Tested on a real phone size in the T3 device preview.
6. Tones are calendar tokens in Arc's `foundation.css`, light and dark. The component mixes no colors.
7. A cancelled block is hatched with the word "Cancelled", with no strikethrough.
8. The 24h/12h choice is kept in the browser for each viewer.

Also from the prototype: the page width is the site's `page-frame`; the now line is under the blocks; a "+" button on each day header draws by keyboard (ui-sdk has no keyboard draw); a keyboard move to another day puts focus back on the block.

## Choices for this step

- **The save action comes in this step, the outbox in step 3.** The admin calendar needs a way to save. `saveCalendarChanges` (one transaction, the user's own access, a stale check) and the session adapter in `lib/calendar-sources.ts` are built now. Step 3 adds the outbox to the collection hooks, so this action needs no change then.
- **Month view waits for step 5.** The admin needs only the week. The public calendar is the first place that needs a month (`createGridFocus`). Building it now would be code that nothing uses.
- **Temporal now, in the calendar only.** The component works on `Temporal.PlainDate` and `PlainTime`. `temporal-polyfill` (pinned exactly) loads in the browser only where `Temporal` is missing. The rest of `src/` moves in the separate Temporal unit (open item 5).
- **Right to left.** Arabic weeks run right to left. The component takes the direction from the host and uses logical CSS properties, so it needs no `if` for Arabic.

## Units, in order

Each unit ends in a check, and the next unit starts only when that check passes.

1. **Temporal and tokens.** Add `temporal-polyfill` and its types; a small time module in `components/calendar/ui/` on Temporal; calendar tone tokens in `foundation.css`. Check: unit tests of the time module (week start Saturday, Cairo now, the skipped and repeated daylight-saving hour); typecheck.
2. **View mode.** The week view, rendered on the server: days across, hours down, all-day row, legend, 24h/12h, now line, overlaps (`stackSpans`), cancelled, one day at a time in a narrow container, right to left. Props as the ADR gives. Check: render and ARIA tests; screenshots light and dark, en and ar, desktop and phone.
3. **Edit mode.** `createSpans` draw, move, resize and delete; keyboard; the save bar and dots; ghosts with Restore; the fixed hour range; the tray with drag and "Place on day"; touch selection. `onSave` gives one list of changes. Check: keyboard and ARIA tests with the ui-sdk testing kit; a pointer test; the T3 device preview at phone size.
4. **Save action.** `lib/calendar-sources.ts` (session adapter: session to items, change to session) and `actions/save-calendar-changes.ts`. Check: int tests for access, all or nothing, stale; adapter unit tests.
5. **Admin Sessions tab.** A custom field hosts the component above the course-wide fields; a click opens Payload's document drawer; "Repeat weekly" in the session form makes the next N meetings or N new sessions. The current join list stays only if the calendar cannot show something (decide in the unit). Check: the e2e tests in "Done means"; the dev server check.
6. **Close.** Snapshot compare on a production build; full checks; this plan's decision trail.

## Decision trail

| Unit | Commit | Check | Result |
| ---- | ------ | ----- | ------ |
