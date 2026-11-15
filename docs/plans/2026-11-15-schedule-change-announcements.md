# Schedule changes offer a prefilled announcement

ADR 0011, order of work step 3, as changed on 2026-11-15 (Decision log, first entry: "a schedule change offers a prefilled announcement"). Run under pstack poteto-mode.

## Done means

An admin or a course fellow changes the schedule of a course that has a space, with a meeting today or later, and saves. A dialog opens with an announcement already written: a short text of the changes and one schedule block. They edit it and publish it, or skip it. A published announcement is a normal space announcement: pinned, and every space member gets a notification. The schedule block shows the calendar, view only, on the weeks of the change, with the changed sessions marked, from the current data. The check is falsifiable:

1. Unit tests of `scheduleChanges`: moved, added, removed, cancelled and restored are found; a change with every meeting in the past counts for nothing; a meeting moved from the past to the future counts; the text in English and Arabic.
2. Unit tests of the schedule block token: write, parse, and refusal of a session from another course (as `sessionSafeBody` does for `::session[id]`).
3. Render and ARIA tests of the block: the weeks shown, the marked blocks, view mode only.
4. E2e: move a meeting in the admin calendar, Save schedule, the dialog opens prefilled, Publish; the space has a pinned announcement with the block, and a member has a notification. A second test: Skip makes no post. A third: a change only to past meetings opens no dialog. A fourth: tick Cancelled in the session drawer and save; the dialog opens.
5. Typecheck, lint, unit, int, e2e, snapshot compare with 0 differences (no public reader changes).
6. Screenshots of the dialog and of the post: English and Arabic, light and dark, desktop and phone.

## Facts the design rests on (checked 2026-11-15)

- Space moderators are admins and the course's fellows (`lib/spaces.ts:95-113`), the same people who may edit the course's sessions. Only moderators may post an announcement (`lib/spaces-write.ts:320`).
- `postCreate` with kind `announcement` pins the post and notifies every space person (`lib/spaces-write.ts:303-390`).
- Posts hold session blocks as `::session[id]` lines (`lib/session-refs.ts`), checked by `sessionSafeBody`, at most 3 blocks a post.
- The session hooks drop the `courses` tag, which the public calendar reads, inside the save (`collections/Sessions.ts` `refreshCourse`, `lib/paths.ts`). Nothing more to refresh.
- The admin calendar host is `components/admin/course-calendar.tsx`; it holds the items before a save, and the save returns the saved items.

## Choices for this step

- **One rule on calendar items.** `scheduleChanges(before, after, today)` in `lib/schedule-changes.ts` compares `CalendarItem[]` lists. Both admin paths have the items before (loaded) and after (returned by the save, or reloaded after the drawer save), so the server needs no diff and no table.
- **One dialog, one text.** The dialog and the prefilled text come from one place; each host passes only the changes and the course. Hosts in steps 4 and 5 reuse it.
- **The dialog is lazy.** It shows only after a save, so it loads with `preloadable`, preloaded from the Save button.
- **Publish goes through the existing post path** with the person's own access. No new write path and no new notification kind.

## Units, in order

Each unit ends in a check, and the next unit starts only when that check passes.

1. **The rule.** `lib/schedule-changes.ts`: `scheduleChanges` and the prefilled text (en, ar, the course page's day and time words). Check: item 1 of "Done means".
2. **The schedule block.** A post body token for the block (session IDs and the marked meetings), its check in the post write path, and its render: the calendar component in view mode on the weeks of the change, marked blocks (a new prop in `components/calendar/ui/`; read the ui-sdk skill first), current data with the viewer's access. Run `/modern-web-guidance` first. Check: items 2 and 3.
3. **The offer in the admin.** The announcement dialog (Arc editor, prefilled; Publish to space; Skip) after Save schedule and after a drawer save that changes meetings or Cancelled. No space, or nothing that counts: no dialog. Run `/modern-web-guidance` first. Check: item 4, and screenshots of the dialog.
4. **Close.** Full checks, snapshot compare on a production build, screenshots, this plan's decision trail.

## Decision trail

| Unit | Commit                             | Check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Result                                                                                                                                                                   |
| ---- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `11a57ec4`                         | `tests/unit/schedule-changes.unit.spec.ts`: 18 tests. 3 faults put in (no today filter, before and after swapped, `>` for `>=`): each makes tests fail. Typecheck, lint, 197 unit files pass.                                                                                                                                                                                                                                                                                                        | `scheduleChanges` and `scheduleChangeText` done. No UI, no action, no DB.                                                                                                |
| 2    | `77b07332`, `dfc45fa4`, `c6b09b06` | Part A: an added or removed session lists only meetings from today on; a cancel in the save is the only change of its session. 3 new tests, 2 faults put in: each makes a test fail. Part B: token tests in `session-refs.unit.spec.tsx` (7), `scheduleBlock` tests (5), `calendar-marked.unit.spec.tsx` (6), `schedule-block.unit.spec.tsx` (5), schedule cases in `spaces-write.int.spec.ts` (48 pass). 6 faults put in: each makes tests fail. Typecheck, lint, 199 unit files (1720 tests) pass. | Token `::schedule[<Saturday>+<weeks>:<ids>]`, one check, `marked` prop, view-only render from current data. Cancel and restore now count by the meetings after the save. |
