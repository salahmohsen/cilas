# Spaces are built in the site, not adopted or embedded

Course, cohort and community discussion is built in the site on Payload and Postgres, not run on WhatsApp groups, a community platform (Discourse, Circle, Mighty Networks) or an embedded SDK (Stream, Liveblocks). Membership comes from enrollments and programme memberships through access rules with no sync, discussion sits next to courses and sessions, the site already reads both languages right to left and left to right, phone numbers stay hidden, and all data stays in CILAS's own database under its own retention rules (Egypt's PDPL).

Research notes: `docs/research/notes/Course groups versus WhatsApp groups/`.

## Considered options

- WhatsApp groups: what members already use, but no threads, no archive the institution keeps, every member's phone number visible to all, and the 24-hour "always on" pressure on fellows.
- Discourse, self-hosted with DiscourseConnect: the strongest platform option, but a second stack, a second design and a second notification system, with unverified right-to-left quality.
- Stream or Liveblocks: content in the vendor's store, little forum moderation, and pricing that jumps past a small institute's budget.

## Consequences

The site carries the moderation, notification and privacy work itself. An admin switch (Off, Trial, On) lets the feature be paused or piloted without code changes.
