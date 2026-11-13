# 0011. Course sessions are placed on a calendar; the schedule pattern goes

Proposed, 2026-11-13. Supersedes [0002](0002-schedule-pattern-drives-session-dates.md) for courses. Events follow in a later phase of this ADR.

This ADR is a working draft. We expand it together before any code: events and the public calendar redesign are open sections at the end.

## Context

A course stores a **pattern** (start date, weeks, weekly slots in Cairo time). Sessions hold content, and the site _computes_ each meeting from the pattern (`expandSchedule`). Sessions also carry `order`, a `meetings` count and optional `dates` that replace their share of the pattern.

This works for "Tuesdays, 7–9pm, 8 weeks". It is hard for everything else:

- An admin fills in four field groups in two tabs ("Course flow" and "Schedule") to say when a session meets, and cannot see the result.
- A session's time is the product of its place in the order, the `meetings` counts of every session before it, and the pattern. A change to one session can move all the sessions after it.
- A visual editor cannot write its changes back. "Move this one meeting" or "move this one and the ones after it" have no clean place in a pattern.

The data (local copy of production, 2026-11-13):

| Fact                                                             | Count                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Courses                                                          | 343 (339 published, 4 drafts)                                            |
| Sessions                                                         | 1,606                                                                    |
| Courses with weekly slots                                        | 194 (174 one slot a week, 20 two, 3 six)                                 |
| Courses with a start date but no slots (first day only)          | 63                                                                       |
| Courses with no sessions                                         | 130                                                                      |
| Courses with slots but no sessions                               | 41                                                                       |
| Courses whose pattern makes more meetings than its sessions take | 18                                                                       |
| Courses whose sessions take more meetings than the pattern makes | 7                                                                        |
| Sessions with a `meetings` count                                 | 53                                                                       |
| Sessions with their own `dates`                                  | 5                                                                        |
| Courses with a schedule note                                     | 203                                                                      |
| Space posts that point to a session row                          | 8 posts with session tokens in the body, plus the `course_session` field |

## Decision

**Each session stores its own meetings. An admin places them on a calendar field. The pattern, `order`, the `meetings` count and the session `dates` are removed.**

### The model

```
course
  sessions[]                 content: what is taught
    id                       unchanged (space posts point to it)
    session_title, description, delivery, bibliography, activities, cancelled
    meetings[]               time: when it meets
      date                   Cairo day, YYYY-MM-DD
      start_time, end_time   Cairo wall-clock, HH:MM; both empty = all day
  timing_note                localized free text, from today's schedule note
  first_day, last_day        read-only, set by a hook from the meetings
  session_unit, syllabus_tentative, course bibliography, notes   unchanged
```

- **Sessions stay an array inside the course.** Drafts, review ("a fellow saves, an admin publishes"), versions and the space-post references keep working with no extra design. A separate collection would publish sessions on its own and needs a review across two collections.
- **A session can have several meetings.** 20 courses meet twice a week and their session is a week. The calendar shows each meeting as a block, and every block opens its session.
- **Order comes from time.** Sessions sort by their first meeting. Sessions with no meeting keep their array order and show after the placed ones, in the "Unscheduled" tray.
- **Times stay Cairo wall-clock.** The rule from 0002 stays: no UTC instants, so changes to Egypt's daylight-saving rules do not move a meeting.
- **`first_day` and `last_day` are stored.** Lists sort and filter by start date today (`courses.api`, `programmes.api`, `people.api`, article cards, email cards, spaces). A beforeChange hook sets them from the meetings, so readers do not scan sessions.
- **One module reads time.** `src/lib/meetings.ts` replaces `src/lib/schedule.ts` for courses. It gives `meetingsOf(course)`, `sessionsInOrder(course)`, `nextMeeting`, `firstDay`, `lastDay`, and a summary ("Tuesdays and Thursdays, 7–9pm, 8 weeks") worked out from the meetings when they are regular. 0002's rule "one function makes every date" stays true.

### The admin

- One tab, **Sessions**, replaces "Course flow" and "Schedule".
- On top: a **calendar field**, week view with hours, in the shape of the agreed design (see the screenshot in the thread): weekdays across, hours down, blocks with title and time, a legend, a 24h/12h switch.
- Draw on an empty slot to make a new session with one meeting. Drag a block to move it. Drag its edge to change its length. Keyboard does the same.
- **"Repeat weekly"** in the session drawer makes the next N meetings, for one session or for "one session a week" across new sessions. This replaces the pattern as a _tool_, not as stored data.
- Click a block (or a tray item) to open the **session drawer** with all its fields. Payload has no built-in drawer for one array row, so the field renders the row's fields itself (`RenderFields` from `@payloadcms/ui` with the row's path, inside a drawer). This must be proven in the spike.
- Under the calendar: the course-wide fields that stay.
- **The calendar field is generic.** It takes "items, each with blocks" and knows nothing about courses, so events can use it later.

### Behaviour library

The field uses [ui-sdk](https://ui-sdk.dev) (`@ui-sdk/react`, `@ui-sdk/core`): `createSpans` for draw, move and resize on day tracks with keyboard and announcements, and `stackSpans` for overlapping blocks. It is in beta (`0.1.0-beta.1`). It is used **only in this admin field**, behind our own component, so the public site does not depend on it and we can replace it.

## What changes

| Area                | Files                                                                                                                                                                         | Change                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Schema              | `collections/Courses.ts`, `fields/schedule.ts` (courses stop using it)                                                                                                        | Sessions tab; `meetings[]`; remove `schedule`, `order`, `meetings` count, `dates`; add `timing_note`, `first_day`, `last_day` |
| Time module         | `lib/schedule.ts` → `lib/meetings.ts`                                                                                                                                         | One reader for courses; the pattern code stays only for events until their phase                                              |
| Public course       | `study/[slug]/CourseView.tsx`, `course/course-syllabus.tsx`, `lib/schema.ts` (JSON-LD)                                                                                        | Read `meetingsOf`                                                                                                             |
| Calendar and feeds  | `api/calendar.api.ts`, `lib/event-calendar.ts` (ICS), `lib/calendar.ts`                                                                                                       | Read stored meetings; ICS gets a stable ID for each meeting                                                                   |
| Lists by start date | `api/courses.api.ts`, `api/programmes.api.ts`, `api/people.api.ts`, `lib/article-cards.ts`, `emails/cards.ts`, `lib/mentions.ts`                                              | Read `first_day`; "8 weeks" from the summary                                                                                  |
| Machine readers     | `api/llms-document.ts`, `plugins/typesense/documents.ts`                                                                                                                      | Read `meetingsOf`                                                                                                             |
| Spaces              | `lib/space-lifecycle.ts`, `space/next-session.tsx`, `space/space-page.tsx`, `space/session-options.ts`, `lib/session-refs.ts`, `lib/spaces-data.ts`, `space/post-session.tsx` | Read `meetingsOf`; session IDs do not change                                                                                  |
| Change notices      | `lib/schedule-notice.ts`                                                                                                                                                      | Compare each session's meetings before and after, by session ID. Simpler than today                                           |
| AI assistants (MCP) | `plugins/mcp/course-validation.ts`, `draft-write.ts`, `guides.ts`, `instructions.ts`, `field-registry.ts`, `accepted-fields.json`, `tools/course.ts`                          | Assistants write `sessions[].meetings`; guides explain it; validation checks times and overlaps                               |
| Seeds and scripts   | `seed/*`, `seed/data/live/*`, `scripts/verify-event-*.ts`                                                                                                                     | New shape; a new verify script for this migration                                                                             |
| Tests               | about 28 unit files                                                                                                                                                           | Follow the new shape                                                                                                          |

## Migration

1. **Add** `meetings[]`, `timing_note`, `first_day`, `last_day`. Old fields stay for now.
2. **Fill** them with a script that runs today's `expandSchedule` for every course and every draft:
   - each pattern meeting goes to the session it belongs to today;
   - pattern meetings after the last session (18 courses), and courses with slots but no sessions (41), get **new untitled sessions**, which the page shows as "Session N";
   - sessions with no meeting (7 courses) stay unscheduled;
   - courses with a start date but no slots (63) get one all-day meeting on that day, on their first session (a new untitled one if none);
   - the schedule note moves to `timing_note`.
3. **Verify** with a script: for every course, `meetingsOf` (new) equals `expandSchedule` (old), meeting by meeting, and every session ID still exists. The run must show zero differences, except the new untitled sessions, which it lists.
4. **Move the readers** one area at a time to `lib/meetings.ts`. The site works after each step.
5. **Admin**: the Sessions tab with the calendar field.
6. **MCP**: tools and guides write meetings.
7. **Remove** the old fields and columns with a last migration.

Old course **versions** keep the old shape in their tables until step 7. At step 7 their schedule columns are dropped. Decide before step 7: accept that old versions lose their schedule (production is in beta), or migrate the version tables too.

## Considered options

- **Keep the pattern and add drag on top.** Rejected: drags such as "this meeting only" or "this and the ones after it" have no clean place to be stored.
- **A separate sessions collection.** It gives Payload's built-in document drawer. Rejected for now: sessions would publish apart from their course, review would span two collections, and the 8 space posts' references would need a migration.
- **One block is one session.** Simpler words, but the 20 twice-a-week courses would turn each "Week 3" into two sessions with copied content.

## Open questions

1. **Review.** A move of a meeting in a published course: live at once (admins), or a draft for review (fellows)? Today any course change by a fellow is a draft.
2. **Notices.** `schedule-notice` tells space members about moved and cancelled sessions. Keep it as is, or also notify registered applicants?
3. **Summary text.** Is a summary worked out from the meetings enough, with `timing_note` for the exceptions, or do admins want to write the summary by hand?
4. **Old versions.** See Migration, step 7.
5. **Weeks.** 235 courses store `weeks`. After the migration it comes from the meetings. Courses with weeks but no dates lose it: is that acceptable?

## Later phases (to write together)

### Events

Events use the same `schedule` field today (single day, or a pattern). Proposal: the same `meetings[]` on the event itself (an event is one session), the same calendar field, and the end of `fields/schedule.ts` and `lib/schedule.ts`.

### Public calendar redesign

`/calendar` reads stored meetings directly with one indexed query. Open: a week view with hours in the same visual language as the admin field, the month grid's keyboard and ARIA fix (`role="grid"` without rows or arrow keys today), and conflicts by place.

## Decision log

Fix: sessions own `meetings[]`; the pattern is a tool, not stored data.

- A session's time depends on every session before it.
- A visual edit cannot be written back to a pattern.
- Four field groups in two tabs to say when one session meets.

Fix: sessions stay an array inside the course.

- Drafts and review cover the course as one document.
- Space posts point to session row IDs.

Fix: order comes from the first meeting; the tray keeps unscheduled sessions in array order.

- `order` is typed by hand and can disagree with the dates.
- 7 courses have sessions with no meeting; 130 have no sessions.

Fix: `first_day` and `last_day` are stored by a hook.

- Six readers sort or filter courses by `schedule.start_date`.

Fix: one module, `lib/meetings.ts`, reads course time.

- 0002 requires that every date comes from one function.
- 24 source files read the schedule today.

Fix: ui-sdk only inside one generic admin field.

- The library is in beta.
- Events need the same editor later.
