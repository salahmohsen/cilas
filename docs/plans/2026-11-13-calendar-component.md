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
2. In edit mode the grid always shows 06:00 to 24:00, and starts earlier only to hold a meeting before 06:00 (owner's decision of 2026-11-14, which replaces "one hour either side of the meetings"). The hours scroll in a fixed-height area under sticky day headers and open on the week's first meeting, or 09:00. View mode shows the earliest to the latest meeting, with no scroll area.
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
3. **Edit mode.** `createSpans` draw, move, resize and delete; keyboard; the save bar and dots; ghosts with Restore; the working-day hour range; the tray with drag and "Place on day"; touch selection. `onSave` gives one list of changes. Check: keyboard and ARIA tests with the ui-sdk testing kit; a pointer test; the T3 device preview at phone size.
4. **Save action.** `lib/calendar-sources.ts` (session adapter: session to items, change to session) and `actions/save-calendar-changes.ts`. Check: int tests for access, all or nothing, stale; adapter unit tests.
5. **Admin Sessions tab.** A custom field hosts the component above the course-wide fields; a click opens Payload's document drawer; "Repeat weekly" in the session form makes the next N meetings or N new sessions. The current join list stays only if the calendar cannot show something (decide in the unit). Check: the e2e tests in "Done means"; the dev server check.
6. **Close.** Snapshot compare on a production build; full checks; this plan's decision trail.

## Decision trail

| Unit                             | Commit                                                     | Check                                                                                                                                                                                                                                              | Result                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Temporal and tokens            | `e48c5245`                                                 | Unit tests of the time module; typecheck.                                                                                                                                                                                                          | Pass. `temporal-polyfill` 1.0.6 is pinned. Node 22 in production has no `Temporal`, so the server uses the polyfill. 19 time tests.                                                                                                                                                                              |
| 2 View mode                      | `fd6307d2`, `4dd73aec`                                     | Render and ARIA tests.                                                                                                                                                                                                                             | Pass. 17 render and ARIA tests. `4dd73aec` removes a stray copy of the prototype's span file.                                                                                                                                                                                                                    |
| 3 Edit mode                      | `bac1b615`, `e49338fe`                                     | Keyboard and ARIA tests with the ui-sdk testing kit; change-list tests.                                                                                                                                                                            | Pass. 10 change-list tests, 11 ui-sdk kit tests, 16 component tests. Six injected faults were caught. `e49338fe` removes the temporary dev page.                                                                                                                                                                 |
| 4 Save action                    | `fdaac56b`                                                 | Int tests for access, all or nothing and stale; adapter unit tests.                                                                                                                                                                                | Pass. 12 int tests, 6 adapter tests. The rollback and stale tests fail without the transaction.                                                                                                                                                                                                                  |
| 5 Admin Sessions tab             | `228ffadb`, `289f7c33`, `8135de55`                         | The e2e tests in "Done means"; typecheck; lint; unit, int and old-path checks; the dev server check.                                                                                                                                               | Pass. See "Unit 5" below.                                                                                                                                                                                                                                                                                        |
| 5b After the owner's review      | `ca27271e`, `04b8d25b`, `f1bd5547`, `2eee7f20`, `f291f6c1` | Unit tests of each menu item (mouse, Shift+F10 and Menu key, arrows, Escape, long press); `create-item` with several blocks (unit, int); the e2e tests in "Done means" with the menu; typecheck; lint; unit, int and old-path checks; screenshots. | Pass. "Repeat weekly" is removed. Each block has a menu (Open, Add meeting, New session next week, Delete meeting). `create-item` takes several blocks. The admin calendar is always editable, with its own "Save schedule" bar and a leave warning. See ADR 0011, "The admin" and the first Decision log entry. |
| 5c Working day and drawer reload | `0b523e7a`, `f7f0080b`                                     | Unit tests of the hour rule, the scroll and the carry-over of edits; the e2e tests in "Done means", with a 06:00 to 23:00 grid, a draw at 07:00 and a drawer save; typecheck; lint; unit tests; screenshots.                                       | Pass. Edit mode shows 06:00 to 24:00 in a scroll area. A save in the drawer keeps the unsaved changes of the other sessions, and the save bar names a session whose own changes it dropped.                                                                                                                      |

## Unit 5: what was built and decided

Commits, in order:

- `228ffadb` fixes the tone. `CalendarItem.tone` is now a `CalendarTone` (`yellow`, `blue`, `pink`, `green`, `neutral`), exported from `lib/calendar-items.ts`. `toneOf` in `lib/calendar.ts` maps a course or event type to one name, and the adapter uses it. The old public views turn a name into a colour with `toneColor`, from the same `--calendar-*` tokens. There is one tone system. Before, the adapter gave hex colours and the component drew every block as neutral.
- `289f7c33` adds the calendar field, and the drawer with it. The field cannot work without `onOpen`, so items 2 and 3 of the brief are one commit.
- `8135de55` adds "Repeat weekly" to the session form.

Decisions:

- **Who may edit.** `loadCalendarItems` asks the sessions collection's own create access (`createSession`) for the course. It returns `canEdit` with the items. The page has no copy of the rule. The save still checks access.
- **Labels.** The admin builds its labels from the shared `CalendarUi` messages with `calendarLabelsFrom`, the same builder as the site. Admin-only words are in a new `CalendarAdmin` namespace, in English and Arabic.
- **Buttons.** The calendar's own buttons now have `type="button"`. Inside Payload's form, a button with no type submits the course.
- **Draft state.** The adapter reads the course with `draft: true`, as the admin shows it. Sessions have no drafts, so a save is public at once on a published course. The Sessions tab already says so.
- **Opening week.** The field opens on the week of the next meeting, or of the last meeting when the course is over.
- **The drawer.** `useDocumentDrawer` fixes the document when it is called, so the field shows one `SessionDrawer` for each session it opens. Payload's drawer is not a native dialog, so the field puts focus back on the block when the drawer closes. The calendar reloads when the drawer saves, deletes or closes.
- **Repeat weekly.** The rule is `weeklyRepeats` in `lib/meetings.ts`. The tool starts from the saved meetings and is off while the form has unsaved edits. After it adds meetings, it loads the saved ones into the form with `reset`, so a later save does not undo them. It makes 1 to 52 weeks.
- **A new course.** A course with no id shows a note, not the calendar.

### The old join list

**Decision: keep it, unchanged.**

The week calendar shows seven days. A course runs 8 to 12 weeks. An admin who needs to find a session by its title, see which are cancelled, or see the whole syllabus in order has to page through the weeks. The join list shows every session in one table, with its title, cancelled flag and last change. Its "Create new" button opens the full session form before any time is chosen. It also still works when the calendar cannot load.

The calendar covers the rest: times, overlaps, and sessions with no meeting (the tray). So the list stays as the overview, under the calendar. We can revisit this when the course space has its own syllabus view.

### Checks

- `pnpm test:e2e tests/e2e/course-calendar.e2e.spec.ts`: 4 tests pass. On a test course made for the run and deleted after: draw a session and move a meeting, Save, reload, and find the meetings in the database; make a change, Cancel, and find no change; open a block and see the session drawer, then Escape puts focus back on the block; Repeat weekly adds meetings and makes sessions.
- `pnpm typecheck`, `pnpm lint` and `oxfmt --check`: pass.
- `pnpm test:unit`: 191 files, 1613 tests pass.
- `pnpm test:int tests/int/save-calendar-changes.int.spec.ts tests/int/course-sessions.int.spec.ts`: 22 tests pass, 4 of them new for `loadCalendarItems`.
- `pnpm tsx scripts/check-old-course-paths.ts`: pass.
- Dev server, course 296 and a test course: English and Arabic, light and dark, desktop and phone width; view, edit, a save, the drawer and Repeat weekly.

### Known gaps

- The admin's own language is English only today: `i18n.supportedLanguages` in `payload.config.ts` lists only English. The Arabic labels show when that is turned on. They were checked with it turned on locally, then reverted.
- The calendar does not know about a session added with the join list's "Create new". It shows it after the next reload.
- ~~"Done editing" drops unsaved changes without asking.~~ Fixed in 5b: there is no "Done editing" in the admin, and the component tells the host how many changes wait (`onUnsavedChange`), so the page warns before leaving.
- Saving a session in its drawer reloads the calendar, which drops calendar changes that were not saved yet. Those changes were made from the old version of that session and would fail as stale, so dropping them is safe, but it is silent.
- A session with an all-day meeting (none exist in the local copy of production) has the pill but no block menu, and "New session next week" copies only its timed meetings.
