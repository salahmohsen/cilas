# 0011. Course sessions are a collection, placed on a calendar; the schedule pattern goes

Accepted, 2026-11-13. Supersedes [0002](0002-schedule-pattern-drives-session-dates.md) for courses and events.

This ADR is a working draft. It covers courses, events, the course space calendar and the public calendar. The open questions are near the end.

## Context

A course stores a **pattern** (start date, weeks, weekly slots in Cairo time). Sessions are an array inside the course. They hold content, and the site _computes_ each meeting from the pattern (`expandSchedule`). Sessions also carry `order`, a `meetings` count and optional `dates` that replace their share of the pattern.

This works for "Tuesdays, 7–9pm, 8 weeks". It is hard for everything else:

- An admin fills in four field groups in two tabs ("Course flow" and "Schedule") to say when a session meets, and cannot see the result.
- A session's time is the product of its place in the order, the `meetings` counts of every session before it, and the pattern. A change to one session can move all the sessions after it.
- A visual editor cannot write its changes back. "Move this one meeting" or "move this one and the ones after it" have no clean place in a pattern.
- Later, fellows will update the syllabus and its sessions while the course runs, also from the course space. Inside one course document, every save writes the whole course, so a fellow's session edit and an admin's course edit overwrite each other, and a fellow cannot change a session without the course review.

The data (local copy of production, 2026-11-13):

| Fact                                                             | Count                                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Courses                                                          | 343 (339 published, 4 drafts)                                         |
| Sessions                                                         | 1,606                                                                 |
| Courses with weekly slots                                        | 194 (174 one slot a week, 20 two, 3 six)                              |
| Courses with a start date but no slots (first day only)          | 63                                                                    |
| Courses with no sessions                                         | 130                                                                   |
| Courses with slots but no sessions                               | 41                                                                    |
| Courses whose pattern makes more meetings than its sessions take | 18                                                                    |
| Courses whose sessions take more meetings than the pattern makes | 7                                                                     |
| Sessions with a `meetings` count                                 | 53                                                                    |
| Sessions with their own `dates`                                  | 5                                                                     |
| Courses with a schedule note                                     | 203                                                                   |
| Courses with `weeks`                                             | 235                                                                   |
| Space posts that point to a session                              | 8 posts with session tokens in the body; `course_session` set on none |

## Decision

**Sessions become their own collection. Each session stores its own meetings. An admin places them on a calendar field. The pattern, `order`, the `meetings` count and the session `dates` are removed.**

### The model

```
sessions                     new collection: what is taught, and when
  course                     relationship, required, indexed
  title, delivery, bibliography, activities   (localized as today)
  description                Markdown, localized (was Lexical)
  cancelled
  meetings[]                 when it meets
    date                     Cairo day, YYYY-MM-DD, indexed
    start_time, end_time     Cairo wall-clock, HH:MM; both empty = all day
  position                   hidden; keeps the order of sessions with no meeting

course
  syllabus                   join field (course → sessions), shown in the Sessions tab
  first_day, last_day        read-only, kept up to date from its sessions' meetings
  syllabus_tentative, course bibliography, notes   unchanged
  (removed: timing_note, announced, session_unit, summary; see "Fix: the timing fields are removed")
```

- **Why a collection.** Each session saves on its own, so two people who edit different sessions, or the course and a session, do not overwrite each other. Sessions get their own access rules, so fellows can later edit the sessions of their running course without the course review. Payload gives a built-in document drawer for a related document, so a click on a block opens the full session form with no custom form code. The public calendar and the space calendar become one indexed query on `sessions.meetings.date`. Space posts point to a session by a real relationship.
- **A session is public when its course is public.** Read access on sessions follows the course: published course → anyone; draft course → its fellows and admins. So a course in review does not show its sessions early. This is one rule in the access function, not a draft system for sessions.
- **A session has its own content.** Title, description, delivery, bibliography (its materials) and activities stay on each session, as today.
- **A session can have several meetings.** 20 courses meet twice a week and their session is a week ("Week 3" = Tuesday and Thursday). The calendar shows each meeting as a block, and every block opens its session.
- **Order comes from time.** Sessions sort by their first meeting. Sessions with no meeting sort by the hidden `position`, after the placed ones, and show in the "Unscheduled" tray. Nobody types an order.
- **Times stay Cairo wall-clock.** The rule from 0002 stays: no UTC instants, so changes to Egypt's daylight-saving rules do not move a meeting.
- **Dates in code are Temporal values.** A meeting's day is a `Temporal.PlainDate` and its times are `Temporal.PlainTime`, as the strings are stored. When a meeting needs an instant (the ICS feed, "next meeting" from now, showing the time to a visitor in another zone), it becomes a `Temporal.ZonedDateTime` in the IANA zone `Africa/Cairo`, never a fixed offset, with `disambiguation: 'compatible'` for the hour Egypt's daylight-saving change skips or repeats. No `Date` built from a hand-made ISO string such as `${day}T00:00:00Z`. Node on the server has `Temporal`; the browser calendar loads `temporal-polyfill` only where `Temporal` is missing (Safari). Source: the modern-web-guidance guides `capture-location-agnostic-data` and `coordinate-global-events`.
- **`first_day` and `last_day` are stored on the course.** Lists sort and filter by start date today (`courses.api`, `programmes.api`, `people.api`, article cards, email cards, spaces). A session afterChange (and afterDelete) hook writes the course's two fields straight to its row (`lib/course-days.ts`), so readers do not query sessions; the course's own beforeChange recomputes them on every course save, so its versions carry them too. Both are `YYYY-MM-DD` text, like `meetings.date`.
- **One module reads time.** `src/lib/meetings.ts` replaces `src/lib/schedule.ts` for courses. It gives `sessionsOf(course)`, `meetingsOf(course)`, `nextMeeting`, `firstDay`, `lastDay`, `weeks` and the summary. 0002's rule "one function makes every date" stays true.
- **Deleting a course deletes its sessions.** In the course's beforeDelete (`deleteCourseDependents`), with its enrollments: `sessions.course_id` is required, so the database refuses to delete a course that still has sessions.
- **Who edits.** Admins edit every session. The course's fellows edit its sessions, times included, while the course is published, with no review. Members read.
- **Sessions keep history.** Versions are on (no drafts), so an admin can see who changed what and restore a session after a harmful edit.

### Summary text and weeks (worked out, never typed)

- **Regular** (every week has the same weekdays and times; the last week may end early): "Tuesdays, 7–9pm", "Tuesdays and Thursdays, 7–9pm", plus "8 weeks".
- **Not regular**: the first and last day and the count, for example "12 sessions, 3 March – 28 April". The syllabus lists each session with its own dates.
- **Weeks** = the 7-day periods from the first meeting to the last. Not stored, not typed. Only the calendar view lays out Saturday-to-Friday weeks.
- **No announced timing and no timing note.** A course states its time with meetings alone. A course with no meeting held has no start day, no weeks and no summary of times. Words the dates cannot say ("hybrid for the first 6 weeks") go in the description or in a session's own text.
- **Numbering.** Every untitled session is "Session N". There is no "Week N" and no setting to choose it. A session that is a week of a twice-a-week course is still one session with two meetings.
- **No card summary.** A card, the search index, `llms` and a mention use the subtitle, then the start of the description.

### The admin

- One tab, **Sessions**, replaces "Course flow" and "Schedule".
- On top: a **calendar field**, week view with hours, in the shape of the agreed design: weekdays across, hours down, blocks with title and time, a legend, a 24h/12h switch.
- Draw on an empty slot to make a new session with one meeting. Drag a block to move it. Drag its edge to change its length. The keyboard does the same.
- **A menu on each block** replaces "Repeat weekly". It has four actions, and it opens by right-click, by the "⋯" on a selected or focused block, by Shift+F10 or the Menu key on a focused block, and by a long press on touch. The arrow keys move in it; Escape closes it and puts focus back on the block.
  - **Open** opens the session drawer, as a click does.
  - **Add meeting** adds a meeting to the same session at the same time on the next day. It is an unsaved change; the person then drags it. If the next day is outside the week in view, the block shows when they go there, and the save bar says where it went.
  - **New session next week** makes a new, untitled session with all the meetings of this one moved 7 days later. It copies times only: no title, description, materials or activities, because the next week is a new topic.
  - **Delete meeting** removes only this meeting, as a ghost with Restore until Save. The session and its content stay; a session with no meeting left shows in Unscheduled. There is no "delete session" on the calendar: a whole session is deleted in its drawer.
  - In view mode only Open shows.
- **The calendar is always in edit mode** in the admin, for a person who may edit the course's sessions. There is no View and Edit switch and no "Done editing". A person who may not edit sees view mode.
- **A separate "Save schedule" bar** shows only while calendar changes wait, with Cancel. Payload's own Save button saves the course and nothing else. Sessions are not drafts, and they are not tied to the course's Save. While changes wait, leaving the page warns: the browser's prompt on a reload or a closed tab, and Payload's own confirmation on a link inside the admin. Payload's warning reads only the course form's modified state, and marking that modified would start the course's autosave, so the calendar tells the host how many changes wait (`onUnsavedChange`) and the host warns itself.
- Click a block (or a tray item) to open the **session drawer**: Payload's document drawer with the full session form.
- Under the calendar: the course-wide fields that stay.
- **The calendar field is generic.** It takes "items, each with blocks" and knows nothing about courses. Events and the course space use it later.

### Behaviour library

The field uses [ui-sdk](https://ui-sdk.dev) (`@ui-sdk/react`, `@ui-sdk/core`): `createSpans` for draw, move and resize on day tracks, with keyboard, snapping, auto-scroll and screen reader announcements; `stackSpans` for overlapping blocks; `createGridFocus` for the month view later. Writing this by hand with the same accessibility would take far longer. It is in beta (`0.1.0-beta.1`), so:

- the version is pinned exactly;
- it lives only inside our calendar component, so callers never import it and we can replace it;
- tests check the keyboard and ARIA behaviour we rely on.

### Change notices

When a session moves, is cancelled or is restored, the **course space members** get a notice. Accepting an applicant creates an accepted enrollment, and space membership comes from enrollments (`lib/spaces.ts`), so accepted applicants with an account are already members. The person who made the change gets none. How the notice is made: see "Saving and telling people".

## What changes

| Area                | Files                                                                                                                                                                                                                    | Change                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Schema              | new `collections/Sessions.ts`; `collections/Courses.ts`; `fields/schedule.ts` (courses stop using it)                                                                                                                    | Sessions collection; Sessions tab with join and calendar; `first_day`, `last_day`                        |
| Time module         | `lib/schedule.ts` → `lib/meetings.ts`                                                                                                                                                                                    | One reader for courses; the pattern code stays only for events until their phase                         |
| Public course       | `study/[slug]/CourseView.tsx`, `course/course-syllabus.tsx`, `lib/schema.ts` (JSON-LD)                                                                                                                                   | Read `sessionsOf` / `meetingsOf`                                                                         |
| Calendar and feeds  | `api/calendar.api.ts`, `lib/event-calendar.ts` (ICS), `lib/calendar.ts`                                                                                                                                                  | Query sessions by meeting date; ICS gets a stable ID for each meeting                                    |
| Lists by start date | `api/courses.api.ts`, `api/programmes.api.ts`, `api/people.api.ts`, `lib/article-cards.ts`, `emails/cards.ts`, `lib/mentions.ts`                                                                                         | Read `first_day`; weeks and summary from `lib/meetings.ts`                                               |
| Machine readers     | `api/llms-document.ts`, `plugins/typesense/documents.ts`                                                                                                                                                                 | Read `sessionsOf`                                                                                        |
| Spaces              | `lib/space-lifecycle.ts`, `space/next-session.tsx`, `space/space-page.tsx`, `space/session-options.ts`, `lib/session-refs.ts`, `lib/spaces-data.ts`, `space/post-*.tsx`, `space/session-block.tsx`, `space/feed-row.tsx` | Read sessions; `course_session` becomes a relationship to `sessions`; body tokens use the new session ID |
| Change notices      | `lib/schedule-notice.ts` → `lib/schedule-changes.ts`                                                                                                                                                                     | An outbox from the collection hooks; one "Schedule changed" post and notification per space and save     |
| AI assistants (MCP) | `plugins/mcp/course-validation.ts`, `draft-write.ts`, `guides.ts`, `instructions.ts`, `field-registry.ts`, `accepted-fields.json`, `tools/course.ts`                                                                     | Assistants write sessions with meetings; guides explain it; validation checks times and overlaps         |
| Seeds and scripts   | `seed/*`, `seed/data/live/*`, `scripts/verify-event-*.ts`                                                                                                                                                                | New shape; a new verify script for this migration                                                        |
| Tests               | about 28 unit files                                                                                                                                                                                                      | Follow the new shape                                                                                     |

## Migration

Every course moves to the new model, published and draft. We test on the local copy of production until it is polished, then go live once.

1. **Add** the `sessions` collection, the join, `timing_note`, `first_day`, `last_day`. The old fields stay.
2. **Fill** with a script that runs today's `expandSchedule` for every course:
   - each session row becomes a session document with the same content and the meetings it has today; its description is converted to Markdown;
   - **courses with weekly times but no sessions (41)** and **pattern meetings after the last session (18)**: the pattern still makes those meetings, but no session holds them. The script makes new sessions for them by today's default rule, one session for each week of slots (with one slot a week, one session per meeting). Their title is empty, so the page shows "Session N" or "Week N";
   - sessions with no meeting (7 courses) stay unscheduled, in their old order;
   - **courses the pattern gives no meeting** (101 courses with a start date or `weeks`) got no meeting from the fill. They first kept their start date and `weeks` as an `announced` timing; that field is removed (see "Fix: the timing fields are removed"), and `scripts/make-archive-meetings.ts` gives them approximate meetings instead, reading the frozen `schedule` group;
   - the schedule note moved to `timing_note` first; that field is removed too, and its text goes with it;
   - **courses with weekly times the pattern cannot place** (no start date or no `weeks`, 55 courses): first, 37 of them get the start date and length found on the old site, written into the old `schedule` group (`scripts/apply-archive-start-dates.ts`, see `docs/research/2026-11-course-start-dates.md`), so their times become real meetings. The other 18 got no meeting from the fill. They first got their times as words in `timing_note`; that field is removed, and `make-archive-meetings.ts` makes weekly meetings at those real times where a start day is known (17 of the 18; course 7 has none and loses its times);
   - **a published course with a pending draft** (295, 406 and 409 today) is filled from the draft: its sessions and schedule go live, because sessions have no drafts. The draft's other fields stay pending;
   - a map from old row ID to new session ID updates the 8 space posts.
3. **Verify** with a script: for every course, the new `meetingsOf` equals the old `expandSchedule`, meeting by meeting; every session's content is the same; every space post points to a session of its own course. The run must show zero differences, except the new sessions, which it lists.
4. **Move the readers** one area at a time to `lib/meetings.ts`. The site works after each step.
5. **Admin**: the Sessions tab with the calendar field.
6. **MCP**: tools and guides write sessions.
7. **Archive meetings, then drop the timing fields.** After the fill, `scripts/make-archive-meetings.ts` gives every course with no meeting approximate ones (see "Fix: the timing fields are removed"). Migration `20261114_072207_drop_course_timing_fields` drops `session_unit`, `announced_*`, `timing_note` and `summary` (and the `session_unit` enum types) from courses and their versions. The script reads only the frozen `schedule` group, so it runs before or after that migration.
8. **Keep the old fields** (schedule, the sessions array) read-only and hidden until everything is polished. Then a last migration removes them. Old course versions lose their schedule and sessions array at that point; the sessions themselves are kept.

## Considered options

- **Keep the pattern and add drag on top.** Rejected: drags such as "this meeting only" or "this and the ones after it" have no clean place to be stored.
- **Sessions as an array inside the course.** Keeps one draft and review for the whole course. Rejected: every save writes the whole course, fellows could not edit sessions on their own, there is no built-in drawer for an array row, and the public and space calendars could not query meetings directly.
- **One block is one session.** Simpler words, but the 20 twice-a-week courses would turn each "Week 3" into two sessions with copied content.

## Events

10 events today: 5 on one date, 5 repeating. They use the same `schedule` field as courses.

- **An event has meetings directly.** No sessions: an event is one thing, and its `agenda` (the programme inside a day) stays as it is. `meetings[]` comes from one shared field, `fields/meetings.ts`, which sessions use too, so the shape and its validation are written once.
- **The "When" tab** uses the same calendar component with one item, the event. A block's "Add meeting" makes the next meeting of a repeating event.
- **`first_day`, `last_day` and `timing_note`** on the event, as on courses. The summary and "next meeting" come from `lib/meetings.ts`.
- **Readers:** `components/events/event-page.tsx`, `event-attendance.tsx`, `lib/events.ts`, `api/events.api.ts`, `lib/mentions.ts`, `emails/cards.ts`, `api/calendar.api.ts`, `lib/event-calendar.ts`.
- **Migration:** the same expand-and-verify script for the 10 events.
- **After events move,** `fields/schedule.ts` and `lib/schedule.ts` are deleted. Nothing uses the pattern any more.

## Session descriptions are Markdown

Payload's own editor (Lexical) stores JSON, not Markdown. It can convert both ways (`convertLexicalToMarkdown`, `convertMarkdownToLexical`). The space writes Markdown with the Arc editor, which has a toolbar for bold, italic, strike, code, links, headings, lists and quotes, plus undo.

- **Session `description` is stored as Markdown.** In the admin, the field renders the **same Arc editor** as the space. So admins, fellows and the space see one toolbar and one format.
- **Migration:** the 782 current descriptions have no images, blocks, links or tables. A few have headings and lists (courses 405, 407, 410, 411), and some paragraphs start lines with "- " or "1. " by hand, which become real Markdown lists. `convertLexicalToMarkdown` keeps every word: the verify script compares the words before and after (a read-only run of the conversion on the local copy found no difference in all 782).
- The site renders session Markdown with the same renderer as space posts.

## One calendar component, five places

The calendar is one generic component in `components/calendar/ui/`. It knows nothing about courses, events or posts.

```
items: { id, kind, title, tone, cancelled?, blocks: { id, date, start_time?, end_time? }[] }[]
mode: 'view' | 'edit'                 'edit' only where the viewer may edit
onOpen(itemId, blockId)
onSave(changes)                       edit mode: one call with every change, or nothing on Cancel; returns the saved items
onUnsavedChange(count)                edit mode: how many changes wait, so the host can warn before leaving
views: week (hours down, days across), day, month, agenda
labels and direction from the host
```

- **View and edit modes.** In edit mode a viewer draws, drags and resizes, and a block has a menu when the host gives words for it (the labels hold them, so a host with none has no menu). The changes stay on the page, marked as unsaved, until **Save** sends them all at once. **Cancel** drops them. So there is no save on every drag, and no Undo toast: Cancel undoes before saving, and session versions undo after.
- **Look:** the agreed design, in Arc tokens, light and dark. Thin grid lines, hour labels in a mono face, outlined blocks with title and time, a 24h/12h switch, a legend. Tone comes from the course or event type (`toneOf`). A cancelled meeting is hatched.
- **Week view:** weeks start on Saturday. The hours shown run from the earliest to the latest meeting of the week. Meetings with no time go in an all-day row. Overlaps share the day's width (`stackSpans`). A line marks "now".
- **Narrow screens (phones), in every place, the admin too:** one day at a time with a day switcher. The component decides this from its own width, so no host repeats it.
- **Month view:** real rows, one tab stop and arrow keys (`createGridFocus`), which fixes today's `role="grid"` with no rows and no arrow keys.
- **Times:** Cairo wall-clock, labelled "Cairo time".
- **Server rendered:** the grid renders on the server; keyboard and drag connect in the browser.

| Place                          | Shows                                              | Edit mode for              | A click opens                                                         |
| ------------------------------ | -------------------------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| Admin: course, Sessions tab    | the course's sessions, plus the Unscheduled tray   | admins, the course fellows | Payload's document drawer with the session form                       |
| Admin: event, When tab         | the event's meetings                               | admins                     | the meeting's times in place                                          |
| Course space: Calendar tab     | the course's sessions and the space's events       | the course fellows, admins | the space's session drawer: details, and Edit for fellows and admins  |
| Space post: "Schedule changed" | the changed sessions and events, around the change | nobody                     | the same drawer as the Calendar tab                                   |
| Public `/calendar`             | every public session and event in the range        | admins                     | a popover (bottom sheet on phones) with a link to the course or event |

## Saving and telling people

There is **one write path** and **one notice path** for every place, the admin form and the AI assistants included.

1. **Save.** The calendar's `onSave` calls one server action, `saveCalendarChanges(changes)`. It runs Payload with the signed-in user (`overrideAccess: false`) in **one transaction**, so the collections' access rules decide, and either all changes save or none do. Each change carries the `updatedAt` it started from; a stale one fails the whole save, and the calendar reloads.
2. **Record.** Each collection's afterChange hook (sessions, events, space posts with a time) writes a **schedule change** row to an outbox, inside the same transaction: what changed (meetings before and after, cancelled or restored), who changed it, which space, and the save's batch ID. A save from the admin form or an AI assistant has its own batch. This is the pattern the private search already uses (`lib/private-search/outbox.ts`).
3. **Announce.** The worker drains the outbox, groups the rows by space and batch, and for each group:
   - posts **one "Schedule changed" post** in the course space. The post renders the calendar component, read-only, on the weeks around the change, with the changed blocks marked. It reads the current data, so it stays up to date if the schedule changes again;
   - sends **one notification** to every space member (students and fellows), except the person who saved;
   - refreshes the public calendar's cache tags.

So no write path has to remember to notify: the collections do it. And ten drags make one post and one notification, not ten.

## Course space calendar

- **A Calendar tab next to Syllabus.** It opens on the week of the next meeting.
- **Sessions** in the course tone; **space events** (posts with a time, 9 today) in their own tone. Space events store instants; the component shows them in Cairo time.
- **A click on a session opens a drawer** with its title, number, times, delivery, description, materials and activities. The drawer and the syllabus use the same session view.
- **Edit mode** (course fellows and admins): draw a new session, move or resize sessions **and space events**, then Save. The drawer's Edit opens a form for the title, description (Arc editor), materials, activities, meetings and "cancelled". The Syllabus tab has the same Edit.
- **After Save:** the "Schedule changed" post and the notification (see above). Open calendars update through the space's realtime channel (`lib/realtime/publish.ts`).
- **Language:** a fellow edits the text in the space's current language.

## Public calendar redesign

- **Views stay** (month, week, agenda) and so do the URLs (`?view=week&date=…`). Week becomes the hours view.
- **The legend filters:** each type in the legend turns its blocks on and off.
- **A click on a block** opens a popover (bottom sheet on phones) with the title, session number, time, place, cover and a link to the course or event.
- **Admin edit mode.** A signed-in admin sees an Edit button. Edit mode renders the page fresh, not from the cache, and checks the admin role on the server. Admins move, resize and cancel any session or event, then Save through the same server action. Every affected course space gets its "Schedule changed" post.
- **Data:** one cached query for meetings in the range: sessions of published courses, and published events.
- **Feeds:** the ICS feed gives each meeting a stable ID, so a moved meeting updates in people's calendars and does not make a copy.

## Code structure

The [untangle rules](../../AGENTS.md) apply to every step. The aim: a typical change lands in one place, and no module imports anything more volatile than itself.

### Modules, from most stable to most volatile

| Module                                                 | Holds                                                                                                                   | May import                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `lib/meetings.ts`                                      | the `Meeting` type and pure rules: order, first and last day, weeks, next meeting, summary text, Cairo time             | `lib/cairo-day.ts`                    |
| `fields/meetings.ts`                                   | the Payload field for `meetings[]` and its validation                                                                   | `lib/meetings.ts`                     |
| `collections/Sessions.ts`                              | the collection: fields, access that follows the course, hooks                                                           | fields, `lib/*`                       |
| `lib/schedule-changes.ts`                              | the outbox: the afterChange hook that records a change, and the drain that posts and notifies                           | `lib/meetings.ts`, notify, posts      |
| `lib/calendar-sources.ts`                              | one adapter per kind (session, event, space event): how a document becomes calendar items, and how a change writes back | `lib/meetings.ts`, collections' types |
| `actions/save-calendar-changes.ts`                     | the one server action: auth, transaction, call the adapters                                                             | `lib/calendar-sources.ts`             |
| `components/calendar/`                                 | the generic component; the only code that imports ui-sdk                                                                | ui-sdk, Arc                           |
| hosts: admin field, space tab, space post, `/calendar` | data loading and labels for one place                                                                                   | everything above                      |

### Rules for this feature

- **One source of each rule.** Every date rule lives in `lib/meetings.ts`; every shape of `meetings[]` in `fields/meetings.ts`; every "who may edit" in the collections' access. No copy in a component or an action.
- **The component knows no domain.** It takes items and gives changes. Courses, events and posts enter only through `lib/calendar-sources.ts`. A new kind (a cycle deadline, later) is one new adapter.
- **One feature, one folder where it can.** The generic calendar in `components/calendar/ui/`, the public page's parts beside it in `components/calendar/`; the space's calendar tab and post next to the other space components.
- **No order the callers must know.** Notices come from the collection hooks, not from each write path. Grouping comes from the batch ID, not from call order.
- **No pass-through wrappers, no options nothing uses.** The calendar component has only the props the five places need.
- **No special cases.** No `if (kind === 'event')` outside the adapters. No swallowed errors: a failed save shows the error and keeps the unsaved changes.
- **Tests at the seams:** `lib/meetings.ts` (pure, many cases), each adapter (document → items → change → document), the action (access and transaction), the outbox (grouping), the component (keyboard and ARIA from ui-sdk's testing kit).

## Browser agents (WebMCP), a later phase

[WebMCP](https://ui-sdk.dev/docs/agents/connect-an-agent/webmcp) lets the AI agent built into a browser (today: ChatGPT's built-in browser; a draft web standard) read and use ui-sdk components on the page the person has open, as that person. An admin could say "add eight Tuesday sessions, 7–9pm, from 3 March" or "move every session after the 10th one week later", and watch the calendar do it.

- **What it needs:** an `agent` key on the calendar primitive that lists its actions, one `createAgent()` bridge, and `registerTools()`. In a browser without WebMCP, `registerTools` does nothing.
- **Agents change only unsaved edits.** The calendar's agent actions are `createBlock`, `moveBlock`, `resizeBlock` and `cancelBlock`, in edit mode only. They change the page, not the database. **Save** carries `data-agent-confirm`, so only the person saves. No delete action is offered to agents.
- **Same path as people.** The agent drives the component, the component calls `saveCalendarChanges`, and the collections' access rules decide. Nothing new on the server.
- **Untrusted text.** Session titles and descriptions are written by fellows and can contain text that tries to steer the admin's agent. The bridge's `allow` refuses every action outside the calendar, and the person's Save is the last check.
- **Where:** the admin and the course space, in edit mode. Not for visitors of the public calendar.
- **How it relates to our MCP server:** the MCP plugin lets assistants write courses on the server, without a page, through drafts and review. WebMCP is help on the page the person is looking at. Both end in the same collections and rules.
- **When:** after step 5, once the calendar is stable. It is a few lines in the component and one bridge per host, so it does not change the design now. The only thing to do now is to give every calendar control a name, which accessibility needs anyway.

## Order of work

1. **Courses:** sessions collection with Markdown descriptions, migration, verify, readers.
2. **The calendar component** and the admin Sessions tab, then the AI assistant tools (MCP).
3. **Saving and telling people:** the action, the outbox, the "Schedule changed" post.
4. **Course space** Calendar tab with edit mode.
5. **Public calendar** redesign with admin edit mode.
6. **Events.**
7. **Remove** the old fields and the pattern code, after everything is polished.
8. **Browser agents (WebMCP)** for the admin and space calendars.

Each step ships to the dev copy on its own, and the site works after it.

## Open questions

None now.

## Decision log

Fix: the timing fields are removed (`timing_note`, `announced`, `session_unit`, the course `summary`); archive dates are approximate meetings. This reverses the earlier decision against invented all-day meetings, on the owner's call (2026-11-14).

- **New content must not use them.** Three of the four were stopgaps for old data: `announced` held a start and a length with no meeting, `timing_note` held words the dates could not say, and `session_unit` chose "Week N". A course states its time with meetings alone, an untitled session is always "Session N", and a card falls back to the subtitle, then the start of the description (the 12 summaries are replaced this way).
- **Archive courses get approximate meetings** (`scripts/archive-meetings-plan.ts`, one pure function, unit tested; `make-archive-meetings.ts` loads and writes, with `--dry-run`, and a second run changes nothing). A course with no meeting gets:
  - **a start day and weeks, no weekly times (52 courses):** one all-day meeting a week on the weekday of the start day, for that many weeks, starting on the start day;
  - **a start day only (11):** one all-day meeting on that day;
  - **weekly times (17):** weekly meetings at the real times, each slot on its own weekday, from the first one on or after the start day, for `weeks` weeks; with no length, the first meeting only. The start day is the one in the old `schedule`, else the research file's term start, else the cycle's start date (the cycle's date is the semester start and is wrong for the six spring 2022 courses, so the research file comes first). A session holds one week, so a twice-a-week course is one session with two meetings;
  - **a length only (24), or nothing (66):** no meeting; the length goes. **Weekly times and no start day anywhere (course 7):** no meeting; the times go.
- **Where the meetings go.** On the course's existing sessions in their order, one group for each session (a meeting, or a week of meetings); extra groups become new untitled sessions; extra sessions stay unscheduled.
- **The archive dates are approximate.** The week is right where the old site gave one; the weekday of a start day is trusted as written. The block menu now works on all-day meetings (Open, Add meeting, New session next week, Delete meeting), because these meetings are all day.
- **The fill and the importers stop writing the removed fields.** The fill makes sessions only. `check-old-course-paths.ts` fails on any name of a removed field in `src/`, and on the course collection defining one.
- **The course form's SEO fields are a tab.** A plugin listed after the SEO plugin moves its `meta` group into a last tab named SEO. The field stays `meta`: no schema change.

Fix: "Repeat weekly" in the session form goes; each block has a menu instead, the admin calendar is always in edit mode, and it saves with its own "Save schedule" bar.

- **Repeat weekly's two modes did not fit.** A session can hold several meetings in one week: 177 sessions in 17 courses meet twice on the same day (groups), and twice-a-week weeks are common. "The next N weeks of the last meeting" and "N new sessions with one meeting" copy neither shape.
- **One action per week shows its result at once.** "New session next week" copies all the meetings of a session 7 days on, as one new session, so the person sees the result on the calendar and repeats it for the next week. "Add meeting" adds one meeting on the next day, which the person then drags. Neither needs a count or a mode.
- **A new item has several blocks.** `create-item` now takes `blocks` (at least one), so a copy of a two-meeting session is one new session with two meetings, not two sessions.
- **Sessions are not tied to the course save.** Fellows edit running courses without review, and every reader of sessions would need a draft filter if sessions were drafts of the course. So the calendar saves through its own "Save schedule" bar and Payload's Save saves the course only.
- **The leave warning is the calendar's own.** Payload's warning takes no state besides its form, and marking the form modified would start the course's autosave. The calendar reports the count of waiting changes, and the admin warns with the same words and the same confirmation as Payload.

Fix: a course with no meeting keeps its old start date and weeks as an announced timing (`course.announced`), read by one rule (`courseTiming`): meetings when one is held, else the announced start and weeks, and no last day. (Superseded by the fix at the top: the field and the rule are gone.)

- The fill gave the 69 courses with a start date but no meeting one all-day meeting on that day, on their first session or on a new one (30). The site then showed a meeting nobody held: "Session 1" on the calendar and in the feed, a dated first syllabus row, `Meetings: 1` in `llms`, a "Starts" fact on the page and "1 week" on cards.
- 101 courses have a start date or a typed `weeks` and no meeting. The old cards showed the typed weeks ("10 weeks"); the fill dropped them.
- A course page still shows "Starts" only from a meeting, as before: the announced start is a list and calendar fact.
- No last day from a start and a length: a length in weeks says how long a course runs, not on which day it ends, and the old site showed no end for these courses.

Fix: weeks are 7-day periods counted from the first meeting; a course is regular when every period has the same weekdays and times, the last one perhaps ending early.

- Saturday-to-Friday weeks split a course that meets Thursday and Saturday from a Thursday (296): each pair fell in two weeks, so the page lost "Meets" and the card said 3 weeks for 2.
- The calendar view still lays out Saturday weeks: that is how Egypt reads a week, not how long a course runs.

Fix: start dates and lengths from the old site go into the old `schedule` group first, by one rule (`scripts/archive-start-dates.ts`); the fill then reads them like any other date.

- 55 courses have weekly times but no start date (43) or no `weeks` (12). Their meetings exist only on the old site's pages.
- The research proposes a start and a length for 54 of them, with a confidence. The user accepted high and medium, and the low Alexandria winter 2020 cycle on its English term text (week of 30 January, 11 weeks).
- A course with a start but no single length (24, 30, 78, 195: none found; 216, 224: 10 to 12 weeks) stays undated. A guessed length would invent meetings.
- The rule writes only fields a course is missing. Course 48 keeps its typed 9 weeks (research: 10 weeks, 9 meetings).
- The old readers still read the `schedule` group until step 4, so the old site shows the same dates as the new sessions. One source, not a second list of dates in the fill.
- The script writes with SQL on the course row and its latest version: `payload.update` runs the review hooks, which make or publish drafts.

Fix: the fill takes `--refill <ids|file>`: it deletes those courses' sessions and plans them again, and stops before any write when a space post names one of them.

- The 37 dated courses were filled before their dates existed. The fill skips a course that has sessions, so it could not see the change.
- A deleted session's ID dies. A space post that names it (`course_session`, or `session:<id>` and `::session[<id>]` in its body, by old row ID or new ID) would point at nothing. None did.
- The map from old row ID to session ID drops the deleted IDs and takes the new ones.

Fix: weekly times become words only where the pattern places none of them and the language has no note; a written note is kept as it is. (Superseded by the fix at the top: `timing_note` is gone.)

- The first rule wrote the words before every note. 8 of the 18 undated courses have a note, and it already says the times in a person's words ("Mondays 10-12pm, offline, except for the first class will be online."). The words doubled them.
- A course with a start but no `weeks` (30, 78, 195, 216, 224 and 152) also gets no meeting for its times, only an all-day one on its start. The first rule tested the start date alone, so their times were lost. The rule now asks the pattern itself (`expandSchedule`), so both cases follow from one test.
- A course that gets real dates must lose the words again: its note returns to the schedule note. The note is planned from the schedule each run, so this needs no special case.

Fix: weekly times with no start date become words at the start of `timing_note`, written by `lib/meeting-text.ts`. (Superseded by the fix at the top: `timing_note` is gone, and `lib/meeting-text.ts` keeps only the weekday names for the course page.)

- 43 courses have weekly slots but no start date. The pattern makes no meeting for them, so the times live only in the old `schedule` group and go when it is removed.
- The words must read as the course page writes weekdays and times in each language (the weekday's full name, the page's digits), and the summary will need the same words: one formatter, not a copy per caller.

Fix: the fill and the verify read a course's latest version when it is a draft over the published course (`fillSource`, one loader for both scripts).

- 3 published courses (295, 406, 409) have a newer pending draft. Filling from the published data loses a fellow's pending syllabus change without a word.
- Sessions have no drafts, so the draft's sessions go live. The draft's other fields stay pending.
- "Newer" is Payload's `latest` flag, not `updatedAt`: a session save writes the course row (`first_day`, `last_day`), which moves its `updatedAt` past the draft's. The first rule compared times and a second fill run read the published course.
- The verify script must compare against the data the fill used.

Fix: the join on courses is named `syllabus`.

- The old array still holds the name `sessions` until the last migration, so the join cannot take it now.
- A join has no column, but every reader written against a temporary name would change again. "Syllabus" already names a course's list of sessions on the site (the space's Syllabus tab, the search field).

Fix: the course's beforeDelete deletes its sessions, not an afterDelete.

- `sessions.course_id` is NOT NULL with ON DELETE set null, so the database refuses to delete a course that still has sessions.

Fix: a session hook writes `first_day` and `last_day` straight to the course row; the course's beforeChange recomputes them.

- `payload.update` on the course would run the review hooks and could publish a fellow's pending draft.
- A publish copies a version over the course row, so the version must carry the days too.

Fix: meeting days, `first_day` and `last_day` are `YYYY-MM-DD` text.

- A Payload date field stores an instant; a Cairo day is not one, and the old `dates` needed `cairoDay()` on every read.

Fix: the fill's rules are one pure function (`scripts/course-sessions-plan.ts`) that the fill and verify scripts both call.

- The fill and the verify must agree on what a course becomes, and each edge case in the data table needs a test.

Fix: sessions are a collection; each owns `meetings[]`; the pattern is a tool, not stored data.

- A session's time depends on every session before it.
- A visual edit cannot be written back to a pattern.
- Four field groups in two tabs to say when one session meets.
- Fellows will edit sessions while the course runs, without the course review.
- Saving the whole course overwrites other people's session edits.

Fix: session read access follows its course.

- A course in review must not show its sessions early.
- Sessions do not need a draft system of their own for this.

Fix: order comes from the first meeting; a hidden position orders the rest.

- `order` is typed by hand and can disagree with the dates.
- 7 courses have sessions with no meeting; 130 have no sessions.

Fix: `first_day` and `last_day` are stored on the course by a session hook.

- Six readers sort or filter courses by `schedule.start_date`.

Fix: summary and weeks are worked out from the meetings.

- Admins should not type what the dates already say.
- 235 courses store `weeks` by hand today.

Fix: dates in code are Temporal plain values, and instants are `ZonedDateTime` in `Africa/Cairo`.

- A `Date` is an instant; a day stored as one drifts for viewers west of UTC.
- Ten files build `Date` values from hand-made `T00:00:00Z` strings to format days.
- Egypt changes its clocks, so a fixed offset is wrong for part of the year.

Fix: one module, `lib/meetings.ts`, reads time.

- 0002 requires that every date comes from one function.
- 24 source files read the schedule today.

Fix: sessions keep versions; fellows edit their course's sessions, times included.

- Fellows change the syllabus and the times while the course runs.
- An admin must be able to undo a harmful edit.

Fix: session descriptions are Markdown, edited with the Arc editor everywhere.

- The space edits Markdown; the admin edited Lexical JSON.
- Two editors would give two toolbars and a lossy round trip.

Fix: events get `meetings[]` from the same shared field; the pattern code is deleted after them.

- Events use the same pattern field today.
- Two shapes for "when something meets" would drift apart.

Fix: one generic calendar component with view and edit modes; ui-sdk only inside it, pinned.

- Five places show sessions or events in time.
- The month grid claims `role="grid"` with no rows and no arrow keys.
- The library is in beta.

Fix: one server action saves every change in one transaction, with the user's own access.

- Fellows and admins edit from the admin, the space and the public calendar.
- The access rules must live in the collections, not in the UI.
- A save of ten changes must not half succeed.

Fix: browser agents get only unsaved calendar edits; the person saves.

- WebMCP agents act as the signed-in person.
- Fellows' text on the page can try to steer the agent.

Fix: collection hooks write schedule changes to an outbox; the worker posts and notifies per space and batch.

- Every write path (calendar, admin form, AI assistants) must notify, without each one remembering to.
- Ten drags must make one post and one notification.
