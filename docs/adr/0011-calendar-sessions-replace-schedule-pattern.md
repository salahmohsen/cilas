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
  sessions                   join field (course → sessions), shown in the Sessions tab
  timing_note                localized free text, from today's schedule note
  first_day, last_day        read-only, kept up to date from its sessions' meetings
  session_unit, syllabus_tentative, course bibliography, notes   unchanged
```

- **Why a collection.** Each session saves on its own, so two people who edit different sessions, or the course and a session, do not overwrite each other. Sessions get their own access rules, so fellows can later edit the sessions of their running course without the course review. Payload gives a built-in document drawer for a related document, so a click on a block opens the full session form with no custom form code. The public calendar and the space calendar become one indexed query on `sessions.meetings.date`. Space posts point to a session by a real relationship.
- **A session is public when its course is public.** Read access on sessions follows the course: published course → anyone; draft course → its fellows and admins. So a course in review does not show its sessions early. This is one rule in the access function, not a draft system for sessions.
- **A session has its own content.** Title, description, delivery, bibliography (its materials) and activities stay on each session, as today.
- **A session can have several meetings.** 20 courses meet twice a week and their session is a week ("Week 3" = Tuesday and Thursday). The calendar shows each meeting as a block, and every block opens its session.
- **Order comes from time.** Sessions sort by their first meeting. Sessions with no meeting sort by the hidden `position`, after the placed ones, and show in the "Unscheduled" tray. Nobody types an order.
- **Times stay Cairo wall-clock.** The rule from 0002 stays: no UTC instants, so changes to Egypt's daylight-saving rules do not move a meeting.
- **`first_day` and `last_day` are stored on the course.** Lists sort and filter by start date today (`courses.api`, `programmes.api`, `people.api`, article cards, email cards, spaces). A session afterChange hook updates the course's two fields, so readers do not query sessions.
- **One module reads time.** `src/lib/meetings.ts` replaces `src/lib/schedule.ts` for courses. It gives `sessionsOf(course)`, `meetingsOf(course)`, `nextMeeting`, `firstDay`, `lastDay`, `weeks` and the summary. 0002's rule "one function makes every date" stays true.
- **Deleting a course deletes its sessions.** An afterDelete hook on courses.
- **Who edits.** Admins edit every session. The course's fellows edit its sessions, times included, while the course is published, with no review. Members read.
- **Sessions keep history.** Versions are on (no drafts), so an admin can see who changed what and restore a session after a harmful edit.

### Summary text and weeks (worked out, never typed)

- **Regular** (every week has the same weekdays and times): "Tuesdays, 7–9pm", "Tuesdays and Thursdays, 7–9pm", plus "8 weeks".
- **Not regular**: the first and last day and the count, for example "12 sessions, 3 March – 28 April". The syllabus lists each session with its own dates.
- **Weeks** = the calendar weeks from the first to the last meeting. Not stored, not typed.
- `timing_note` stays for words the dates cannot say ("hybrid for the first 6 weeks").

### The admin

- One tab, **Sessions**, replaces "Course flow" and "Schedule".
- On top: a **calendar field**, week view with hours, in the shape of the agreed design: weekdays across, hours down, blocks with title and time, a legend, a 24h/12h switch.
- Draw on an empty slot to make a new session with one meeting. Drag a block to move it. Drag its edge to change its length. The keyboard does the same.
- **"Repeat weekly"** in the session drawer makes the next N meetings for that session, or N new sessions, one a week. This replaces the pattern as a _tool_, not as stored data.
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
| Schema              | new `collections/Sessions.ts`; `collections/Courses.ts`; `fields/schedule.ts` (courses stop using it)                                                                                                                    | Sessions collection; Sessions tab with join and calendar; `timing_note`, `first_day`, `last_day`         |
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
   - courses with a start date but no slots (63) get one all-day meeting on that day, on their first session (a new one if none);
   - the schedule note moves to `timing_note`;
   - a map from old row ID to new session ID updates the 8 space posts.
3. **Verify** with a script: for every course, the new `meetingsOf` equals the old `expandSchedule`, meeting by meeting; every session's content is the same; every space post points to a session of its own course. The run must show zero differences, except the new sessions, which it lists.
4. **Move the readers** one area at a time to `lib/meetings.ts`. The site works after each step.
5. **Admin**: the Sessions tab with the calendar field.
6. **MCP**: tools and guides write sessions.
7. **Keep the old fields** (schedule, the sessions array) read-only and hidden until everything is polished. Then a last migration removes them. Old course versions lose their schedule and sessions array at that point; the sessions themselves are kept.

## Considered options

- **Keep the pattern and add drag on top.** Rejected: drags such as "this meeting only" or "this and the ones after it" have no clean place to be stored.
- **Sessions as an array inside the course.** Keeps one draft and review for the whole course. Rejected: every save writes the whole course, fellows could not edit sessions on their own, there is no built-in drawer for an array row, and the public and space calendars could not query meetings directly.
- **One block is one session.** Simpler words, but the 20 twice-a-week courses would turn each "Week 3" into two sessions with copied content.

## Events

10 events today: 5 on one date, 5 repeating. They use the same `schedule` field as courses.

- **An event has meetings directly.** No sessions: an event is one thing, and its `agenda` (the programme inside a day) stays as it is. `meetings[]` comes from one shared field, `fields/meetings.ts`, which sessions use too, so the shape and its validation are written once.
- **The "When" tab** uses the same calendar component with one item, the event. "Repeat weekly" makes the meetings of a repeating event.
- **`first_day`, `last_day` and `timing_note`** on the event, as on courses. The summary and "next meeting" come from `lib/meetings.ts`.
- **Readers:** `components/events/event-page.tsx`, `event-attendance.tsx`, `lib/events.ts`, `api/events.api.ts`, `lib/mentions.ts`, `emails/cards.ts`, `api/calendar.api.ts`, `lib/event-calendar.ts`.
- **Migration:** the same expand-and-verify script for the 10 events.
- **After events move,** `fields/schedule.ts` and `lib/schedule.ts` are deleted. Nothing uses the pattern any more.

## Session descriptions are Markdown

Payload's own editor (Lexical) stores JSON, not Markdown. It can convert both ways (`convertLexicalToMarkdown`, `convertMarkdownToLexical`). The space writes Markdown with the Arc editor, which has a toolbar for bold, italic, strike, code, links, headings, lists and quotes, plus undo.

- **Session `description` is stored as Markdown.** In the admin, the field renders the **same Arc editor** as the space. So admins, fellows and the space see one toolbar and one format.
- **Migration:** the 782 current descriptions are plain paragraphs (no images, blocks, links, lists or tables), so `convertLexicalToMarkdown` loses nothing. The verify script compares the text before and after.
- The site renders session Markdown with the same renderer as space posts.

## One calendar component, five places

The calendar is one generic component in `components/calendar/ui/`. It knows nothing about courses, events or posts.

```
items: { id, kind, title, tone, cancelled?, blocks: { id, date, start_time?, end_time? }[] }[]
mode: 'view' | 'edit'                 'edit' only where the viewer may edit
onOpen(itemId, blockId)
onSave(changes)                       edit mode: one call with every change, or nothing on Cancel
views: week (hours down, days across), day, month, agenda
labels and direction from the host
```

- **View and edit modes.** In edit mode a viewer draws, drags and resizes. The changes stay on the page, marked as unsaved, until **Save** sends them all at once. **Cancel** drops them. So there is no save on every drag, and no Undo toast: Cancel undoes before saving, and session versions undo after.
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

None for now. New ones go here as the work finds them.

## Decision log

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
