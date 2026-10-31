# Spaces layout: research and proposal

Date: 2026-10-24. Input to the layout work before Task 14. Decided and built on 2026-10-24: the side rail layout, with the UX rules below.

## What other products do

Sources were read on 2026-10-24. "(search)" means a search summary, not a full page read. "(unverified)" means from memory.

- **Facebook Groups.** Admins pin posts as Featured near the top. A one-time intro shows rules and a prompt to post on first open (https://www.facebook.com/help/android-app/2063362980550205). The ranked default feed hid posts, and Facebook added a chronological option after complaints (search: https://www.boston.com/news/technology/2022/07/21/facebook-gives-users-new-way-to-see-all-their-friends-posts/). Collapsed "Write something" composer, cover and tab row, "See more" truncation, and a comment box under each post (unverified).
- **Circle.** A "Start Here" landing space and a native "Get started" checklist on first sign-in. Order tasks from low to high effort, and treat the introduction as the first win (https://circle.so/blog/community-onboarding).
- **Discourse.** A dot for new topics, a count for unread replies, and a "Dismiss new" action (search: https://forum.sailfishos.org/t/discourse-new-user-guide/817). Side panels only at 767px and wider (search: https://meta.discourse.org/t/topic-list-sidebars/107561/3).
- **Discord forums.** The admin chooses "Recent activity" or "Creation time". Recent activity suits discussion, creation time suits announcements (search: https://blog.communityone.io/discord-forum-channels-setup-guide/).
- **Google Classroom Stream.** Three posting levels, the same as ours. Announcements get lost on a busy stream (https://senecalearning.com/en-US/blog/how-to-keep-your-google-classroom-stream-organised).
- **Mighty Networks.** Conversations get hard to find as groups grow (search: https://supplygem.com/reviews/mighty-networks/).
- **Skool.** Points and leaderboards. Wrong for a graded class.

## Problems in the current space page

Observed on 2026-10-24 in a 1280px and a 390px browser run.

1. The checklist and an open composer fill the first screen. On a phone the first post starts about 1,100px down.
2. The composer and the file dropzone always show, about 350px, also for members who only read.
3. Post cards have no link, no comment entry, four reaction chips that always show zeros, and "0 comments" on every card.
4. Authors show initials only. There is no role marker for the fellow.
5. No space identity: no description, rules, or member count.
6. The page refreshes itself every 30 seconds without a marker. There is no "new since your last visit" line.
7. The participation table sits under the feed.
8. Desktop is one 960px column with no side rail.
9. My spaces is a plain list with no preview.

## Proposal

### Desktop, 1024px and wider

Two columns: the feed at 640 to 720px, a rail at 300px.

Header (`page-header`): title, open or archived `badge`, `avatar-group`, and a `segmented-control` for All and Announcements (Questions in step 2). Moderators keep the settings `popover`.

Feed column, top to bottom:

1. **Pinned zone.** The pinned announcement or intro post, body clamped with `expandable-text`.
2. **Collapsed composer.** One line: the member's `avatar` and "Write a post". It opens in place. Files, post type and Publish (`action-swap`) show only when it is open. The dropzone shows after "Add files".
3. **Feed.** Recent activity, the order we have now, with no ranking. A divider line "New since your last visit" at the previous `last_visited_at`.
4. **Post card.** `avatar` with `hover-card`, name, a "Fellow" `badge` for moderators, time, edited mark. Body in `expandable-text`. Attachments. `reactions`, with zero counts hidden. A "Comment" link with the count, to the post page. A `dropdown-menu` for edit, pin, lock, delete (`confirm-morph`), and copy link (`copy-button`).
5. **Freshness.** The 30 second check shows a `toast` "3 new posts" with a "Show" action. It does not reflow the page while the member reads or types.

Rail (`card` for each block):

1. **First steps.** Arc `onboarding-checklist`, in place of the hand-built one. Order from low to high effort: accept the notice, choose the digest, check your profile, read the pinned post, introduce yourself. It hides when all are done.
2. **About.** The course summary for course spaces, the programme summary for cohorts, the intro text for the community. Posting level in plain words. Rules in an `accordion`.
3. **Members.** Count, `avatar-group`, and "See all" opening a `drawer`.
4. **Moderators only.** "Participation" opens a `drawer` with `metric-card`s (posts this week, members who never visited) and the `sortable-data-table`.

### Phone, below 1024px

One column. Header, then a compact first steps row ("2 of 5 done", opens in place), then the pinned zone, then the feed. "Write a post" opens the composer in a `bottom-sheet`. About and Members sit behind an "About" button in the header that opens a `bottom-sheet`.

### My spaces

One divided list per section (community, cohorts, courses). Each row: title, a one-line preview of the latest post, relative time, unread `badge`. Archived course spaces last, with their badge.

### Deliberately not doing

- No ranked or "most relevant" feed.
- No points, levels, or leaderboards.
- No sort control yet. One fixed order is clearer at 10 to 60 members.
- Per-space notification levels (all, announcements, off) wait for step 3 with the digest.

## Data the proposal needs

- **Previous visit time** for the divider: read the visit row before `visitRecord` stamps it. `memberState` already reads that row.
- **Moderator ids** in the feed, for the "Fellow" badge: from the course fellows or the programme, as `membership()` decides it.
- **Author photos** in `FeedRow`: `spaceFeed` reads authors at depth 0 now.
- **About text**: course and programme summaries exist. The community uses its intro post. No new field.
- **Latest post preview** for My spaces: `mySpaces` already loads the posts it counts.

## UX best practices (second round)

Read in full on 2026-10-24: NN/g on infinite scrolling, confirmation dialogs, progressive disclosure, empty states and bottom sheets; the W3C ARIA feed pattern; WCAG 4.1.3 and 2.2.2; W3C on `dir`. Other lines are search summaries or our own reasoning, marked.

- **Load in batches.** "Load more" with a shown/total count, not endless scroll. It keeps the footer reachable and posts findable (https://www.nngroup.com/articles/infinite-scrolling-tips/).
- **Never move the feed under the reader.** A periodic check updates a "N new posts" control; the reader loads them (https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).
- **Announce politely.** New posts and "Published" go to a `role="status"` region without moving focus (https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- **Feed semantics.** `role="feed"`, each post an `article` named by its author and described by its body, with `aria-posinset` and `aria-setsize` (https://www.w3.org/WAI/ARIA/apg/patterns/feed/).
- **Progressive disclosure.** A one-line composer; files and the post type appear on request, two levels at most (https://www.nngroup.com/articles/progressive-disclosure/).
- **Confirm only what is serious, offer a way back.** Name the item and the outcome on the buttons (https://www.nngroup.com/articles/confirmation-dialog/).
- **Empty states teach.** Say what will appear and how to start (https://www.nngroup.com/articles/empty-state-interface-design/).
- **Bottom sheets for short tasks only,** with a visible close (https://www.nngroup.com/articles/bottom-sheet/).
- **Bidirectional text.** `dir="auto"` on user text, `<bdi>` around names, logical CSS properties (https://www.w3.org/International/questions/qa-html-dir).
- **Timestamps.** Relative for a week, then the date, with the exact time on hover (search: https://uxmovement.com/content/absolute-vs-relative-timestamps-when-to-use-which/).
- **Checklists.** Five items or fewer, least effort first, each doing its step in place (Circle, above; the rest is our reasoning).

## What was built

| Rule                         | In the space page                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Batches                      | 20 posts, then `LoadMore` with "N of M posts".                                                                                                                               |
| Feed never moves             | `FreshPosts` checks every 30 s while visible and shows "Show N new posts".                                                                                                   |
| Status region                | The banner and "Published" are `role="status"`.                                                                                                                              |
| Feed semantics               | `role="feed"`, `article` with posinset, setsize, labelledby, describedby.                                                                                                    |
| Divider                      | "New since your last visit" above the first post older than the previous visit.                                                                                              |
| Collapsed composer           | One line with the member's avatar; inline on desktop, `bottom-sheet` on phones; files behind "Add files"; draft kept in local storage.                                       |
| Notice at the moment of need | "Write a post" opens the privacy notice in a `dialog` first; the checklist step accepts it too.                                                                              |
| Delete                       | `confirm-morph` in countdown mode: 3 seconds to cancel. An undo after the fact is impossible because delete does not keep the body (see open issues).                        |
| Long text                    | `expandable-text` only on bodies that can pass the clamp, so short posts never flash "Read more".                                                                            |
| Roles                        | "Fellow" `badge` and `hover-card` profile; moderators from course fellows or residential fellows.                                                                            |
| Checklist                    | Arc `onboarding-checklist`, least effort first; hidden state in a cookie so the server renders it right.                                                                     |
| Rail                         | About with an `accordion` (posting, privacy, digest); Members with `avatar-group` and a `drawer`; moderators get a participation `drawer` with `metric-card`s and the table. |
| Phone                        | Rail behind an "About" `bottom-sheet`; one column, no sideways scroll at 390px.                                                                                              |
| Timestamps                   | `When`: relative for 7 days, then the date, `tooltip` with the exact time.                                                                                                   |
| Loading                      | `skeleton` in the final layout (`loading.tsx`).                                                                                                                              |
| My spaces                    | Arc `card` per space with the latest post preview, unread `badge`, and last activity.                                                                                        |

## Open issues found on the way

- **Delete and the privacy notice disagree.** The notice promises 30-day restore. `postRemove` deletes a post without comments outright, and blanks the body of one with comments. Either keep deleted bodies until a purge (step 3), or change the notice text, which needs the legal check and a `NOTICE_VERSION` bump.
- **The notice does not say moderators see participation numbers.** Same legal path.
- **Arc `avatar-group` keys by name.** Two people with one name collide; the page passes unique names to it, and the drawer lists everyone.
- **Arc `reactions` always shows zero counts.** Kept as Arc designs it.
