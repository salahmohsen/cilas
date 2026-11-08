# Spaces: design

Date: 2026-10-21
Status: approved

## Goal

Give each course, each Bridge cohort and the whole community a closed place on the
site to discuss, ask, share files and stay in touch, instead of WhatsApp groups.
The design follows the research in `research_notes/Course groups versus WhatsApp
groups/`: structure and visible fellows matter more than an open feed, most
members read more than they write, and privacy and boundaries are the main
weaknesses of WhatsApp groups. Why we build it in the site: ADR 0009.

Terms (CONTEXT.md): space, course space, cohort space, community space, post,
announcement, comment, highlight, moderator, pulse, place.

## Decisions

| Question                | Decision                                                                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name                    | Space, with three kinds. The physical sites become places first (ADR 0007).                                                                                                                                                                                 |
| Where                   | The website's signed-in area, built with Arc. The Payload admin stays for writing articles, proposing courses and publications, not for spaces.                                                                                                             |
| Course space members    | The course's fellows and its `ENROLLED` people (`accepted`, `confirmed`, `completed`), the rule the mailing lists use. Payment does not decide.                                                                                                             |
| Cohort space members    | One space for each Bridge programme record, for the people with a membership on it. Not for Women's Studies or Residency yet; the rule allows them later.                                                                                                   |
| Community space members | Every account linked to a person. Accounts are closed: only an admin or an accepted application makes one.                                                                                                                                                  |
| Admins                  | Read and moderate every space; not listed as members.                                                                                                                                                                                                       |
| Posting                 | Everyone who can see a space posts and comments. Moderators can narrow a space to "members comment only" or "only fellows and admins post", and lock one post.                                                                                              |
| Post kinds              | Discussion, Question (a label and a filter), Announcement (fellows and admins: pinned, notifies all, emails at once).                                                                                                                                       |
| Highlights              | The post's author and moderators can highlight any number of comments. No "the answer".                                                                                                                                                                     |
| Reply first             | "Reply before you see others" on a post: any author on their own post, moderators on any post.                                                                                                                                                              |
| Editors                 | Posts: Arc `rich-text-editor` with an added @mention trigger, stored as Markdown. Comments: Arc `mention-input` in `comment-thread`, plain text with mentions.                                                                                              |
| Rendering               | `react-markdown`, `allowedElements` limited to what the editor makes, `remark-gfm` for strikethrough only.                                                                                                                                                  |
| Mentions                | Only members of the same space; stored by person id as `/people/{id}` links and shown as chips; no mass mentions.                                                                                                                                           |
| Reactions               | One set for posts and comments, with Arc `reactions`: Agree, Thank you, Insightful, Same question. Counts and names; no points, no "seen by", no notifications.                                                                                             |
| Files                   | Private `space-files` collection (ADR 0008). PDF, Word, images; 10 MB; 5 per post, 1 per comment.                                                                                                                                                           |
| Edit                    | Any time, marked "edited"; moderators see earlier versions.                                                                                                                                                                                                 |
| Delete                  | `hold-to-confirm`. An author's delete of a post or comment with replies leaves a placeholder and keeps the replies. Only a moderator deletes a whole thread.                                                                                                |
| Moderation              | Pin, lock, hide with a reason, delete a thread, mute a member in one space; reports go to moderators and Admin → Reviews.                                                                                                                                   |
| Retention               | Deleted and hidden content restorable for 30 days, then purged with its files.                                                                                                                                                                              |
| Anonymity               | "Anonymous to members" on Questions and their comments in course and cohort spaces only. Fellows of the space and admins see the name.                                                                                                                      |
| People                  | Members edit their own name, bio, photo and links on the website; only admins decide if a person is public. In a space, members see each other's name and photo; never email or phone.                                                                      |
| Notifications           | Bell at once (mentions, comments on your post, replies, announcements, moderator actions, reports). Email digest at 16:00 Cairo: weekly (Sunday) by default, or daily, or off; one setting stops all space email. Announcements email at once. No web push. |
| Updates                 | The page checks for new posts every 30 seconds while open.                                                                                                                                                                                                  |
| Life cycle              | A course space opens when the course is published (seen from `accepted`), turns read-only 2 weeks after the last meeting, and is kept for its members; `withdrawn` loses access. Cohort spaces stay open. The community space is always open.               |
| Languages               | The interface follows the site language; content is written once, not translated, with `dir="auto"`.                                                                                                                                                        |
| Search                  | Private server-mediated Typesense search across currently readable spaces, with an optional space restriction. See ADR 0010, which supersedes the original Postgres-only choice.                                                                            |
| Privacy                 | Consent before the first post, kept on record; members download and delete their own content; member lists never public.                                                                                                                                    |
| Switch                  | Site settings → Spaces: Off (default at launch), Trial (chosen courses, plus community and cohort checkboxes), On. Enforced on the server; never deletes data.                                                                                              |
| Measuring               | Participation summary for moderators; the pulse with shadcn Questionnaire (Radix); reports with Arc charts.                                                                                                                                                 |

## 1. Spaces and who belongs

A space is never a stored member list. Who belongs is worked out from the records
that already exist, in one shared access helper used by every space collection
and route:

- Course space: `course.fellows` contains the person, or an enrollment of the
  person in the course has a status in `ENROLLED` (`src/lib/list-members.ts`).
- Cohort space: a membership links the person to the space's Bridge programme
  record. A programme record is one year: it links its two semester cycles.
- Community space: the account has a linked person.
- Admins pass every check but do not appear in member lists or mention
  suggestions.

A `spaces` collection holds one row per space with its kind, its course or
programme, and its settings: posting level, open or read-only, and the
introduction post. Course spaces are created when a course is first published;
cohort spaces when a Bridge programme record is first published; the community
space by seed. Settings, not members, live on the row.

The switch (section 10) is checked first, before membership.

## 2. Pages

All under the signed-in area, `noindex`, in both site languages:

- `/{locale}/spaces`: "My spaces". The community space, the cohort space, then
  course spaces, current first and archived below, each with new posts since the
  last visit. Links to the admin: "Write an article" for every member, "Propose
  a course" for fellows.
- `/{locale}/spaces/community`, `/{locale}/spaces/cohort/{programme slug}`,
  `/{locale}/spaces/course/{course slug}`: a space.
- `/{locale}/spaces/.../posts/{id}`: one post with its comments.
- `/{locale}/profile`: the member's own name, bio, photo and links. For a
  public person it says: "Your profile is public. Changes appear on the website
  at once."

Ways in: a "Spaces" link in the header for signed-in members, with a dot for new
activity; "Open the course space" on a course page for its members; the bell.
After sign-in, a member returns to the `next` page, else to "My spaces". Admins
still land in the admin.

### Space page

- **Header:** Arc `page-header`, changed to take props and to fold on the
  window's scroll. Breadcrumb (My spaces → space), status badge (Open /
  Read-only archive), members (avatar group), course week as progress for a
  course space, tabs with counts (All, Questions, Announcements, No highlights
  yet), actions (New post, Search; Settings for moderators).
- **First steps:** Arc `onboarding-checklist` for a member new to the space,
  stored per account and space: accept the privacy notice, introduce yourself
  (opens the introduction post), read the pinned announcement, check your name
  and photo, choose your email digest. It can be hidden and never blocks the
  space.
- **Feed:** pinned announcements, then posts by latest activity. Each post
  shows kind, author or "Anonymous member", time, text, files, reactions,
  comment count and highlights count.

### Post page

The post, its Highlights strip (collapsible, each with who highlighted it), and
the comments in Arc `comment-thread` with replies (`maxDepth` 2), reactions,
mentions and placeholders for deleted comments.

## 3. Posts

Fields: space, author, kind (`discussion`, `question`, `announcement`), body
(Markdown), files, pinned, locked, reply first, anonymous, hidden (with reason
and moderator), deleted at, edited at, last activity at.

- Announcement: only fellows of the space and admins. Pinned on creation.
- Anonymous: only on questions, only in course and cohort spaces. Its label
  says that the space's fellows and admins can see the name.
- Reply first: until the reader has a comment on the post, they see the post
  and the comment count, not the comments, and a label "Reply to see the other
  replies". Authors of comments and moderators see all.
- Each space gets an introduction post with reply first on when it opens. The
  default prompt: "What question brings you here?" Moderators can edit it.

## 4. Comments, highlights and reactions

Comments: post, parent comment, author, body (plain text with mentions), one
file, anonymous (inherits the question's rule), hidden, deleted at, edited at.

Highlights: the post's author and moderators toggle a highlight on any comment;
it records who and when. The strip on the post lists highlighted comments; the
"No highlights yet" filter finds posts with none.

Reactions: one row per account, target (post or comment) and reaction, unique on
all three. Arc `reactions` everywhere, our copy of `comment-thread` changed to
use it. The four: Agree (thumbs up), Thank you (heart), Insightful (lightbulb),
Same question (hand). Hover or long press shows names.

## 5. Writing and rendering

- Posts: Arc `rich-text-editor` (paragraphs, h1 to h3, lists, quote, code,
  rule, bold, italic, strike, links). We add an "@" trigger beside its "/" menu
  that suggests members of the space and inserts `[@Name](/people/{id})`.
  Stored as Markdown.
- Comments: Arc `mention-input`; stored with `serializeMentions` in the same
  `/people/{id}` link form.
- Display: `react-markdown` with `allowedElements` for the editor's blocks and
  `remark-gfm` for strikethrough. An `a` component turns `/people/{id}` links
  into mention chips with the person's current name; other links open in a new
  tab with `rel="noreferrer"`. Raw HTML is never rendered.
- The server rejects mentions of people who are not members of the space.
- Every post, comment and name has `dir="auto"`.

## 6. Files

`space-files` (ADR 0008): random names, no public URL, read access equals the
space's read access. Types from `FILE_KINDS`: PDF, Word, images. 10 MB each; 5
per post, 1 per comment; enforced on the server. Arc `file-dropzone` to add
them. Images show as thumbnails, others as a list with name, type and size.
Deleted with their post or comment.

## 7. Moderation

Moderators: the course's fellows (course space), the programme's residential
fellows (cohort space), admins (all).

- Pin, lock (no new comments), hide a post or comment with a reason (the author
  sees it marked "Hidden by a moderator" with the reason), delete a whole thread
  (each comment author is notified), mute a member in one space (can read, cannot
  post, comment or react), set the posting level.
- Edit history: every edit keeps the previous text; moderators can see it.
- Reports: any member reports a post or comment with a reason. Moderators of
  the space and admins are notified; reports appear in Admin → Reviews as the
  kind "Report". The author never sees who reported.
- Deleted and hidden content stays 30 days, restorable by admins in the Payload
  admin, then a daily job purges it and its files.
- Author deletes use `hold-to-confirm`. A post or comment with replies becomes a
  placeholder; the replies stay. Without replies it is removed.

## 8. Notifications and email

New notification kinds (a migration on the enum): `mention`, `comment`,
`reply`, `announcement`, `moderation`, `report`. The bell gets them at once with
a link to the post or comment.

Email:

- Announcements: sent at once to every member of the space who can read them,
  once only, outside the request.
- Digest: one email at 16:00 Cairo time (daylight saving follows Cairo) listing
  mentions, replies and new posts in the member's spaces since the last digest,
  only when there is something. Weekly on Sunday by default (no saved choice
  counts as weekly); each member chooses daily, weekly or off. A first digest
  looks back one period only.
- Stop all space email: one account-wide setting (Settings → Notifications) and
  a signed link in every mail (List-Unsubscribe, one-click). The digest choice
  stays saved.
- A schedule calls `POST /api/cron/spaces` hourly (Bearer `CRON_SECRET`); the
  route sends digests in the Cairo digest hour and purges daily at 03:00 Cairo.
- Through the existing Resend setup and the Email settings layout.

No web push in this version.

## 9. Privacy

- Before a member's first post in any space: a short notice in Arabic and
  English on what spaces store, who sees it and how long; acceptance is stored
  with its date and the notice version.
- A member can download everything they wrote (posts, comments, files) and
  delete it, following the placeholder rules.
- No page, API or search shows who belongs to a space to anyone outside it.
- The notice text needs a lawyer's check. CILAS's PDPL licence, data protection
  officer and processing register are organisation tasks outside this spec.

## 10. The switch

Site settings → Spaces, a new tab:

- **Off** (the default at launch): space pages return not found, the space API
  refuses, links disappear, no notifications or digests. Data stays. The 30-day
  purge keeps running.
- **Trial:** a list of courses, and checkboxes for the community space and
  cohort spaces. Everything else behaves as Off.
- **On:** every space by the rules above.

Checked on the server in access rules, routes and jobs, not only in menus.
Admins see all space data in the Payload admin whatever the mode.

## 11. Life cycle

- Course space: created when the course is first published; a person sees it
  from `accepted`; read-only from 2 weeks after the last meeting (computed from
  the schedule), then kept for its fellows and enrolled people. `withdrawn`
  removes access. Moderators or admins can reopen it.
- Cohort space: created with its Bridge programme record; stays open as the
  cohort's alumni space.
- Community space: always open.
- Read-only: no posts, comments or reactions; reading and downloads still work.

## 12. Search

The site search panel has a private My spaces scope over posts and comments,
with independently selected currently accessible spaces, validated per-space
counts, and relevance/newest/A–Z sorting. Arabic and English text is indexed in a separate private Typesense
collection. The server derives current permissions from Postgres and validates
all matches against current Payload reads and content revisions. Private keys,
text and totals never enter the public search adapter. Author and kind filters
remain deferred. See [ADR 0010](../../adr/0010-private-spaces-search.md) for the
security boundary, durable indexing, disabled-by-default rollout and tests.

## 13. Measuring

- **Participation summary** (moderators only): for each member, posts,
  comments, reactions and last visit, in Arc `sortable-data-table`. Members
  never see others' numbers.
- **Pulse:** shadcn Questionnaire, Radix version (the project's style is
  `base-luma`, so the install must name the Radix variant). Same items at week 2
  and at the end; optional; one invitation per round. Items are editable by
  admins in Site settings → Spaces, in both languages, stored as numbers:

  | Measures          | Item (1 strongly disagree to 5 strongly agree)                                   |
  | ----------------- | -------------------------------------------------------------------------------- |
  | Belonging         | I feel part of this course's group.                                              |
  | Belonging         | I feel comfortable sharing an unfinished idea here.                              |
  | Social presence   | Through the space I got to know other members.                                   |
  | Teaching presence | The fellow's posts helped me see what to focus on.                               |
  | Learning          | Discussion in the space helped me think more deeply about the readings.          |
  | Learning          | I used an idea from someone else's post in my own thinking or work.              |
  | The tool          | The space was easy to use on my phone.                                           |
  | The tool          | For this course, I prefer the space to a WhatsApp group.                         |
  | Use               | How often did you read the space? (Rarely / Weekly / A few times a week / Daily) |
  | Suggestions       | What helped you most? (free text)                                                |
  | Suggestions       | What should we change? (free text)                                               |

  Adapted from the research constructs, not a validated scale. Answers are
  confidential: the account is stored only to prevent a second answer; reports
  show totals and free text without names, and hide scale results below 5
  answers. If the Questionnaire cannot hold a text-only question, those two steps
  use our own textarea in the same flow. Test the flow right to left.

- **Report** for each space (admins, and fellows for their space), with Arc
  charts: `metric-card` with `sparkline` (active members, posts, comments this
  week), `line-chart` (weekly activity), `slope-chart` (each pulse item, week 2
  to end), stacked `bar-chart` (answer spread per item), `waffle-chart`
  (readers, light and regular contributors, no names), `activity-heatmap`
  (weekday by hour), `usage-meter` (share of questions with a highlight), the
  free text as a list with `filter-toolbar`. Load the dataviz skill before
  building them.
- Opening spaces more widely is a human decision from this report and the
  pilot fellow's view.

## 14. Order of work

Each step ships on its own.

0. **Preparation.** Rename spaces to places with a migration (ADR 0007).
   Profile editing on the website.
1. **Core spaces.** Spaces and membership, the switch, posts (discussion,
   announcement), comments, reactions, files, mentions, "My spaces", header and
   course links, the bell, consent, the onboarding checklist, read-only
   archives, the participation summary. Pilot: Trial with one course.
2. **Learning.** Questions, highlights, reply first and introduction posts,
   anonymity, search.
3. **Care and reach.** Hide, mute, reports in Admin → Reviews, thread delete,
   30-day purge, edit history, digests, data download and delete, the pulse and
   its report. Spaces open widely only after this step.

## Later, not in this version

Weekly prompts with deadlines, automatic threads for each session, polls,
summary posts, turning a thread into an article, web push,
cohort spaces for Women's Studies and Residency.

## Open checks for the build

- The exact shadcn command for the Radix Questionnaire under `base-luma`, and
  whether it takes a text-only question.
- Whether `findVersions`-style edit history fits posts, or a small history
  collection is simpler.
- Our changes to Arc copies (`rich-text-editor` mention trigger,
  `comment-thread` reactions, `page-header` props and window scroll) are ours to
  keep in step if Arc updates them.
