# The calendar redesign: one new look, then the public calendar

ADR 0011, order of work step 5. Run under pstack poteto-mode ("Sequence Work into Verifiable Units"). The owner approved the start on 2026-11-15. Each screenshot gate still needs the owner's review.

Reference images (`docs/plans/assets/step5/`): `reference-day.png`, `reference-week-popover.png` and `reference-day-popover.png` (desktop; the popover's look, but see decision 1), `reference-week-panel.png` (the side panel open), `reference-phone-3days.png`, `reference-phone-day.png`, `reference-phone-agenda.png` (phones).

## Done means

Every calendar (admin Sessions tab, space Calendar tab, schedule block in posts, public `/calendar`) is the one ui-sdk component in `src/components/calendar/ui/`, with the new look of the owner's reference images (`docs/plans/assets/step5/`). A click on a block opens a popover with the details and, for editors, Edit (the drawer). The public calendar has month, week and day views on the component, a legend that filters, an admin edit mode with one announcement dialog for many spaces, one cached range query, and stable ICS IDs for sessions. Cairo time, weeks from Saturday, right to left in Arabic, server-rendered grid, Arc tokens light and dark, phones with 3 days, Day and Agenda.

## Facts the design rests on (checked 2026-11-15)

- The component has ONE view: the week (hours down), and one day on narrow screens. No month, no agenda, no separate day view. Toolbar: previous and next week, 24h/12h switch.
- `/calendar` does NOT use the component. It renders its own `MonthView`, `WeekView`, `AgendaView` (`components/calendar/calendar-views.tsx`) from `getCachedCalendarItems` (`api/calendar.api.ts`). So the new look reaches admin, space and schedule block at once; `/calendar` needs a move onto the component.
- Events on `/calendar` come from the old `schedule` pattern: `eventItems` (`lib/events.ts`) expands it, keys `e<id>-<index>`. There is no event adapter and no write path. In step 5 events are view only (`readOnly`). The ADR's "admins move any session or event" narrows to sessions until step 6.
- ICS UIDs: sessions `s<session>-<date>-<time>` (`meetingKey`), events `e<id>-<index>`. A moved session meeting gets a new UID today, so calendars copy it. Meeting rows have their own `id`: a stable session UID can use it. Event UIDs wait for step 6.
- Sessions have no place text. They have `delivery` (online / in person, from `LOCATION_OPTIONS`); the course has the location. Sessions have no type of their own; tone comes from the course type.
- The calendar contract carries meeting changes only. Text fields save through `saveSessionEdit` (step 4 unit 5 found that a text seam in the calendar contract is wrong).
- The snapshot script reads `/calendar?view=month` HTML (98 months) and the ICS feed. A new month view must keep the script's readings equal (update its selectors in the same unit), so the compare stays 0.
- Meetings by Cairo weekday, last 365 days (all time): Tue 80 (252), Sat 49 (197), Wed 42 (214), Mon 41 (248), Thu 37 (336), Sun 30 (243), Fri 1 (74). Saturday is the second busiest day; Friday is empty.

## Units, in order (one delegate at a time in this checkout)

1. **New look, week grid** (component only; admin, space, schedule block get it). Tokens, tinted blocks (title, time, delivery), all-day bars across days, day header (short name, large date, today in a circle), muted hour labels, now line with pill and dot, weekend shade, toolbar (month, week label, Today, arrows, view switch, primary action, panel toggle). Check: component and ARIA tests; snapshot 0 differences against `head-step4b` (step 4's final snapshot) (public page untouched); screenshots en/ar, light/dark, 1440 and 390, of the three hosts. **Gate: owner's screenshot review.**
2. **Day view, phone 3-day view and agenda view** in the component, from the switch. Check: tests; screenshots. Gate: owner's review (may join unit 1's review).
3. **Popover.** Details everywhere; Edit opens the drawer for editors. Check: tests, e2e of the step 4 drawer specs updated; screenshots. **Gate: owner's review.**
   **Unit 3b, before unit 4: one transaction for calendar and drawer edits** (decision 11). In edit mode, clicking a saved or new session opens our drawer's Edit form directly in both the space and admin. Apply stages details; Cancel discards only the current form changes. One Save submits meeting and detail changes together. Check: existing and new session edits, combined move and detail edit, cancellation, pending count and leave guard, stale version rollback, access checks, one announcement offer, and screenshots. **Gate: owner's review.**
4. **Month view in the component.** Real rows, `createGridFocus`, chips with time in the tone, bars across days, "N more". Check: keyboard and ARIA tests; screenshots. Gate: owner's review.
5. **`/calendar` on the component** (view mode): URLs kept, one cached range query, legend filter, popover with link to the course or event, events read only. `calendar-views.tsx` removed. Snapshot script selectors updated. Check: snapshot 0 differences; e2e; screenshots. Gate: owner's review.
6. **Admin edit mode on `/calendar`:** rendered fresh, admin role checked on the server, Save through `saveCalendarChanges`, one dialog with a list of spaces. Check: int (access), e2e.
7. **Drawer Edit form polish** (decision 10). Check: component tests (keyboard, names, dialog validation), e2e `session-edit` updated, screenshots. **Gate: owner's review.**
8. **Stable ICS IDs for sessions** (meeting row id). Check: unit test; snapshot shows only expected UID differences, listed.
9. **Close.** Full checks, cold e2e, snapshot, screenshots, records.

## Owner's decisions (2026-11-15)

1. **The popover shows details only.** It has an Edit button that opens the drawer: the space's session drawer with its Edit form, and Payload's session drawer in the admin. The popover is not an editor; the reference popovers give only its look. Visitors on `/calendar` get the popover with a link to the course or event, and no Edit.
2. **Calendar changes wait for Save.** A drag, a resize or a removal is an unsaved change until Save in the bar sends all of them at once (the ADR's rule). No save on each change.
3. **No type chips.** A session takes its tone from the course type. The place line shows the delivery ("Online", or "In person: <course location>").
4. **No work week option.**
5. **"Week N" is the course week** in course hosts ("Week 3 of 8", from `lib/meetings.ts`). `/calendar` shows no week number.
6. **Phones** follow the phone images: a switch with 3 days, Day and Agenda; an icon-only primary action; the panel toggle. This replaces "phones one day at a time". The phone default is Day (see 9).

7. **12-hour times only.** The 24h/12h switch goes; times always show in the 12-hour form ("11 AM", "10:30 – 11:30 AM"; Arabic with its own AM/PM words). Unit 1 removes the switch, `use-hour12.ts` and its labels, and keeps the time format in one place in `calendar-time.ts`.

8. **Unscheduled sessions are split buttons** (reference `reference-split-button.png`; Arc `split-button`, already installed in `src/components/arc/split-button`). The main part shows the session and opens it (the popover, as a block does), and in edit mode is still the drag handle onto a day. The arrow part opens the menu of days to place it on (today's `placeOnDay` list). Not editable (view mode, or `readOnly`): no arrow part, the main part only. This replaces today's separate button plus `DropdownMenu` in `unscheduled-tray.tsx`. Read the component with the Arc MCP (`get_component`) before use.

9. **The rest, from the orchestrator's recommendations, adopted with the owner's "start" (2026-11-15):**
   - Desktop switch: Month / Week / Day / Agenda in every host. Phones: 3 days / Day / Agenda; **Day is the phone default** (a 3-day column is about 80 px at 390 px). URLs `?view=month|week|day|agenda` stay.
   - Month view: popover only, no docked day panel; "N more" opens the Day view.
   - Panel (toggle at the toolbar's end, closed by default, never open on phones): Up next, the legend filter, and the Unscheduled tray in the admin. No time zones.
   - Dashed outline: an unsaved change in edit mode. Cancelled stays hatched.
   - Primary action: "New session" in edit mode; Edit for editors in view mode; nothing for others.
   - No menu button at the start of the phone toolbar (it opens Arc's left sidebar, which is excluded). No avatars on blocks.
   - Weekend shade: Friday only (Saturday is the second busiest day: 49 meetings in the last year; Friday 1).
   - Order of units as listed below. The step 4 e2e specs that click a block (`session-drawer`, `space-calendar-edit`, `session-edit`, `course-calendar`) change in unit 3: a click opens the popover, Edit opens the drawer.
   - The split buttons (decision 8) land in unit 3.
10. **The drawer's Edit form** (owner, 2026-11-15, after a better-interface review of `session-form.tsx`): materials show as cards in a grid; a card opens a dialog with its fields (Type, Title, Note, Link; Remove, Cancel, Done; Done checks the fields, so a card never holds an invalid material); the list ends with a "+" tile with a dashed border, the same size and radius as a card, that opens the same dialog empty. All fields well aligned. Orchestrator's recommendations from the review, in the same unit: activities as the same cards (owner to confirm); meeting rows get a header line ("Meeting 2" at the start, the remove X at the end), which aligns the X and names the row (`role="group"`); Save and Cancel stay fixed at the drawer's bottom; section titles one step larger than field labels; Arabic time pickers in the 12-hour form (decision 7); the All day checkbox on the fields' edge; space instead of a line between rows.

11. **Edit mode edits everything in one transaction** (owner approved, 2026-11-15). In edit mode, a click on a saved or new, unsaved block opens the drawer's Edit form directly. Apply keeps the detail changes as unsaved; the Save bar counts them, the leave guard asks, and the block has a dashed outline. Cancel drops only the current form changes. Save sends one request, `saveScheduleEdits({ calendar, details })`, in one Payload transaction. It applies calendar changes through the existing adapter, details (title, description, materials, activities, cancelled) through the shared session writer, and creates new sessions with their details and meetings. Existing sessions carry their starting `updatedAt`; a stale version stops the whole save. The announcement offer opens once. The calendar component stays domain-free and holds meeting changes only; the host holds detail changes and joins them at Save. Outside calendar edit mode, the form saves at once through the same action with one detail change. The admin Sessions tab uses our form in edit mode in place of Payload's drawer. This supersedes decision 1 for edit mode and removes the step 4 drawer-versus-calendar save conflict there. Build in unit 3b, before month view and form polish.

## Decision trail

| Unit | Commit | Check | Result |
| ---- | ------ | ----- | ------ |
