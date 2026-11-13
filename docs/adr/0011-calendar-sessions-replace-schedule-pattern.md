# 0011. Course sessions are a collection, placed on a calendar; the schedule pattern goes

Proposed, 2026-11-13. Supersedes [0002](0002-schedule-pattern-drives-session-dates.md) for courses. Events follow in a later phase of this ADR.

This ADR is a working draft. We expand it together before any code: events and the public calendar redesign are open sections at the end.

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
  title, description, delivery, bibliography, activities   (localized as today)
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

When a session moves, is cancelled or is restored, these people get a notice: **space members and applicants accepted to the course**, each person once. `schedule-notice` compares a session's meetings before and after, in the session's own afterChange hook.

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
| Change notices      | `lib/schedule-notice.ts`                                                                                                                                                                                                 | Runs on a session's own change; recipients include accepted applicants                                   |
| AI assistants (MCP) | `plugins/mcp/course-validation.ts`, `draft-write.ts`, `guides.ts`, `instructions.ts`, `field-registry.ts`, `accepted-fields.json`, `tools/course.ts`                                                                     | Assistants write sessions with meetings; guides explain it; validation checks times and overlaps         |
| Seeds and scripts   | `seed/*`, `seed/data/live/*`, `scripts/verify-event-*.ts`                                                                                                                                                                | New shape; a new verify script for this migration                                                        |
| Tests               | about 28 unit files                                                                                                                                                                                                      | Follow the new shape                                                                                     |

## Migration

Every course moves to the new model, published and draft. We test on the local copy of production until it is polished, then go live once.

1. **Add** the `sessions` collection, the join, `timing_note`, `first_day`, `last_day`. The old fields stay.
2. **Fill** with a script that runs today's `expandSchedule` for every course:
   - each session row becomes a session document with the same content and the meetings it has today;
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

## Open questions

1. **Fellows editing live.** Later, fellows edit the sessions of their running course from the space. Which fields may they change without an admin: content only, or times too?
2. **Recipients.** Are accepted applicants always space members already? If yes, the notice list is simply the space members.
3. **Session history.** Do sessions need versions (history and restore) on their own?

## Later phases (to write together)

### Events

Events use the same `schedule` field today (single day, or a pattern). Proposal: the same `meetings[]` on the event itself (an event is one session), the same calendar field, and the end of `fields/schedule.ts` and `lib/schedule.ts`.

### Course space

The space shows the course's sessions in the same calendar, read-only for members and editable for its fellows (see open question 1).

### Public calendar redesign

`/calendar` reads meetings with one indexed query. Open: a week view with hours in the same visual language as the admin field, the month grid's keyboard and ARIA fix (`role="grid"` without rows or arrow keys today), and conflicts by place.

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

Fix: one module, `lib/meetings.ts`, reads course time.

- 0002 requires that every date comes from one function.
- 24 source files read the schedule today.

Fix: ui-sdk only inside one generic calendar component, pinned.

- The library is in beta.
- Events and the course space need the same editor later.
