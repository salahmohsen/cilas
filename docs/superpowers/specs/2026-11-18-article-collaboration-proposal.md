# Article conversations and co-authoring: a proposal

Date: 2026-11-18. Status: deferred by the owner (kept for later). Nothing here is built or planned. It does not change the portal spec.

Labels used below. **Fact** means read in the repo or in a source listed at the end. **Inferred** means reasoned from facts, not tested. **Guess** means an estimate or a prediction.

## Short answer

- Yes, keep the conversation on an article. Build it as our own Payload collection and show it with the Arc `CommentThread` that spaces already use. Start with document-level threads in phase 2. Add comments anchored to text in phase 5, with the anchor stored outside the body.
- Yes, people in one course space can write one article together. The access rule already lets every listed author edit. What is missing is the invite flow, a lock per language, and a "who is here" line. Do that in phase 5.
- Do not build live co-editing (Yjs) now. It needs a second server, it fights the approved editor design, and the cheap version covers the classroom cases. Revisit it when lock data shows real collisions.
- Liveblocks is ruled out by ADR 0009 unless the owner reopens it.

## 1. Problem and users

### What exists today (fact)

- An article has `authors` (hasMany `people`, required) and `credits` (rows of role plus people; roles include `translator`, `editor`, `copy_editor`). `src/collections/Articles.ts`, `src/fields/credits.ts`.
- Every listed author may read, edit and delete the draft. Access is `ownsViaAuthors` (`src/access.ts:85`). A person in `credits` only gets no edit access.
- `canAuthor` lets `member`, `fellow`, `non_degree_seeking` and admins create articles when the account has a linked person (`src/access.ts:167`).
- Articles have drafts with autosave every 2 s (`versions.drafts.autosave.interval: 2000`).
- The body is localized. Saves are per locale.
- The review hooks refuse every non-admin write while the article is `submitted` (`src/lib/review-hooks.ts`, `applyReview`, "This article waits for review").
- The review conversation is one `review_note` textarea that each round overwrites (`src/fields/review.ts`). The spec adds the append-only `review-events` to keep each note.
- An article has no link to a space or a course. A course fellow cannot read a student's draft.
- Spaces already have comments: `space-comments` (plain text, `/people/{id}` mention links, reply depth 2, soft delete), written only through server actions (`src/lib/spaces-write.ts:641`), shown with Arc `CommentThread` (`src/components/space/space-thread.tsx`). Mentions are checked against a space safelist (`mentionSafelist`).
- Notification kinds `comment`, `reply` and `mention` exist (`src/lib/notification-kinds.ts`).
- Realtime is Server-Sent Events fed by Postgres `LISTEN/NOTIFY`, keyed by recipient account (`src/lib/realtime/hub.ts`, `docs/realtime-notifications.md`). There is no WebSocket server.
- The app runs as Next's standalone `server.js` in one container (`Dockerfile`, `CMD ... node ... server.js`). No custom server, so no WebSocket upgrade in process.

### Users and roles

| Role           | Who in CILAS                                                        | What "collaborate" means for them                                                                      |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Student author | `member` or `non_degree_seeking` in a course space                  | Start the piece, write, invite classmates, answer comments, submit                                     |
| Co-author      | Another member of the same space                                    | Write a section, fix language, reply to comments. Gets a byline                                        |
| Translator     | A co-author who owns the other language                             | Writes the Arabic (or English) body while the first author writes the original. Credited as translator |
| Course fellow  | Moderator of the course space (`membershipOf`, `src/lib/spaces.ts`) | Reads drafts from their course, comments as a teacher. Does not publish                                |
| Admin reviewer | `admin`, `super_admin`                                              | Reads the submission, asks for changes with a note, approves at a tier                                 |

### The translation case

Two people work on one article in two locales. They work at the same time but never in the same text. This is the most common real case of parallel work (inferred from the Arabic/English model and the `translation` group on articles). A design that locks the whole document blocks it. A lock per locale does not.

### What classroom research says

Only two abstracts were read, so this stays small. Marttunen and Laurinen observed university groups writing one text. The most common activities were discussing concepts (31%), writing and revising (25%), planning (16%) and steering the group (9%). They found that the profiles they saw are not fixed roles. The profiles depend on how each group talks and works (fact, JoWR abstract). Li and Zhang's research agenda names technology-mediated and multimodal collaborative writing, and assessment practice, as areas that need more work (fact, abstract).

What this means for the design (inferred). Do not hard-code roles that decide who may edit what. Let roles be credit labels (writer, translator, editor) and let the group decide how to divide the work. Keep a record of who wrote what (Payload versions and `lastEditedByField`), because a teacher may want to see each person's part.

## 2. Two separate features

**(a) The conversation.** Comments between the authors, the fellow and the reviewer, kept per article. Some are about the whole piece. Some point at a sentence.

**(b) Co-authoring.** Several people edit one article.

They share nothing in storage. The conversation never writes the body. Co-authoring never writes comments. They meet only in the UI: the editor shows the comments rail beside the body.

### How the conversation relates to `review-events`

- `review-events` stays as the spec has it: append-only, written by the hook, one row per review move, with the note. It is the record of decisions.
- Comments go in a new collection. They are the talk around those decisions.
- The conversation view reads both and merges them by time. A review move shows as a system row ("Admin asked for changes, round 2" with the note). It is not copied into the comments table.
- **Do review notes become comment threads?** Recommended: yes, as the root of a thread, by reference. A reply to a review note creates a comment thread with `review_event` set to that row. The note itself stays in `review-events`, so the history and the D9 diff base stay one source. The banner still shows the latest note.

## 3. Options

Effort is for one developer who knows the repo. Every effort figure is a guess.

### 3a. The conversation

#### C1. Document-level threads

- **UX.** A "Conversation" panel on the article page (`/spaces/articles/[id]`). New thread, reply, resolve, reopen, @mention a co-author, the fellow or "the reviewers". Review moves appear inline as system rows. Resolved threads fold into a chip (Arc `CommentThread` already does this).
- **Data.** New collection `article-comments`:
  ```
  article-comments
    article        articles, indexed
    parent         article-comments, null for a thread root
    review_event   review-events, null unless it answers a review note
    author         people
    body           textarea, plain text with /people/{id} mention links (same serializer as space comments)
    resolved_at    date, roots only
    resolved_by    people
    edited_at, deleted_at   as space-comments
  ```
- **Access.** Read: admins, the article's authors, and (if the owner agrees, see open questions) the fellows of the linked course. Create, update, delete: server actions only, like `space-comments`. REST writes refused. Comments stay writable while the article is `submitted`, because they never touch the article row.
- **Realtime.** None needed. New comments reach people through the bell (`comment`, `reply`, `mention` kinds already exist, SSE already pushes them). The open panel refetches when its own bell event arrives.
- **Lexical round-trip and versions.** No effect. The body is untouched.
- **Hosting and cost.** Nothing new.
- **Risks.** Low. Comment volume on one article is small. Mention safelist needs a new source (authors plus fellows plus admins), not the space safelist.
- **Effort.** 4 to 6 days (guess). Most parts exist: `CommentThread`, the mention serializer, `notify`.

#### C2. Anchored comments, anchor stored outside the body

- **UX.** Select text, press "Comment" (or Ctrl+Alt+M). The quote shows at the top of the thread. The text gets a soft highlight while the thread is open. Clicking a thread scrolls to its text. If the text changed so much the anchor is lost, the thread stays with the label "The text this was about has changed" and its quote.
- **Data.** Add to `article-comments` roots:
  ```
    anchor  group, null for a document-level thread
      locale   'en' | 'ar'
      quote    the selected text
      prefix   up to 32 characters before it
      suffix   up to 32 characters after it
      block    index of the top-level block when created, a hint only
  ```
  On load, the client finds the quote in the body of that locale, using prefix and suffix to pick between repeats, and draws a highlight with a decoration, not a node.
- **Access.** As C1.
- **Realtime.** None.
- **Lexical round-trip and versions.** No effect (inferred). The body JSON never holds the anchor, so the spike's zero-difference check, the public renderer, the markdown converters (`articleBodyFeatures` is shared with `src/lib/llms-document.ts`) and the D9 diff never see it.
- **Why not in the body.** See C3.
- **Works on the read-only page too.** The reviewer reads a rendered body in phase 2. Selecting text in rendered HTML gives the same quote, prefix and suffix. So reviewers can anchor comments before the portal editor exists (inferred, needs a check in the spike: Arabic text with diacritics must match between the HTML text and the Lexical text).
- **Hosting and cost.** Nothing new.
- **Risks.** Anchors drift after big rewrites. That is acceptable: the quote keeps the meaning. Right-to-left selection and bidi text need testing.
- **Effort.** 5 to 8 days on top of C1 (guess). The editor half waits for phase 5.

#### C3. Anchored comments as Lexical `MarkNode` in the body

- **UX.** Same as C2, and the highlight moves with edits exactly.
- **Access.** As C1 for the comment rows. The mark itself needs body write access.
- **Realtime.** None.
- **Hosting and cost.** Nothing new.
- **Risks.** See the list below.
- **How.** The Lexical playground wraps the selection with `$wrapSelectionInMarkNode(selection, isBackward, id)`, keeps thread ids on the `MarkNode`, and unwraps the node when its last id goes (fact, playground `CommentPlugin`).
- **Data.** Same comment collection, plus a mark node in `body`.
- **Why it does not fit CILAS (fact plus inferred).**
  - A comment would change the body. While the article is `submitted`, `applyReview` refuses every non-admin write, so an author could not comment. An admin's mark would save a new version of the submitted article, so "what is approved is what was submitted" stops being true, and the D9 diff shows marks as changes.
  - The mark node must be added to `articleBodyFeatures`. Then every converter, the public renderer and the round-trip spike must know it, and the admin editor must know it too.
  - Every new thread is a body save, so every comment is an autosave version.
- **Effort.** 8 to 12 days (guess). Not recommended.

#### C4. Suggestions (track changes)

- **UX.** Like Google Docs "Suggesting": edits show as insertions and strikethroughs that the owner accepts or rejects (search snippets only, see sources).
- **Data.** Either suggestion nodes in the body (all the C3 problems, larger) or a parallel copy of the body per suggester.
- **Lexical.** No suggestion feature in Lexical core or the playground that I found. This would be our own node set (inferred).
- **Access.** Suggesters need a new right: propose but not edit. Authors accept or reject.
- **Effect on versions.** Each suggestion is a body save, so a version per suggestion (inferred).
- **Realtime.** None required. Hosting: nothing new.
- **Risks.** High. A new node set in the round-trip, the converters and the admin editor.
- **Effort.** 4 to 8 weeks (guess). Not recommended.
- **Prior art.** GitBook avoids inline suggestions: a change request is a branch copy that reviewers comment on, approve or send back, then merge (fact, GitBook docs). CILAS already has that shape: a published article's edits are a draft beside it, reviewed with a diff (D9). So the review loop is covered without track changes.
- **Cheap stand-in.** In C2, a thread may carry an optional "Suggest replacement" text. An author clicks **Apply** to replace the anchored quote. One function, no new nodes. 2 to 3 days (guess). Worth it after C2 if reviewers ask.

### 3b. Co-authoring

#### A1. Authors list, invites, a lock per locale, presence

- **UX.**
  - **Invite.** In the editor side panel, "Authors" lists people. **Invite** opens a picker of the space's members (or anyone the author may read, outside a space). The invitee gets a notification and an email: "Lina invited you to write _Title_ with her." **Accept** adds them to `authors`. **Decline** ends it. Substack has a similar confirmation step for guest bylines, per search snippets only. The Substack page I read confirms multiple authors per byline but does not describe the confirmation.
  - **The write path on Accept.** The invitee is not an author yet, so `ownsViaAuthors` refuses their write. Accept is a server action that checks the pending invite, then calls `payload.update` with `overrideAccess: true` and a request context flag such as `INVITE_ACCEPT`, writing only `authors` (and `credits`). On a published article an owner's write saves a draft beside the live row (`src/lib/review-hooks.ts`). Whether a trusted server write with no user also takes that path, and whether adding an author to a live article should need review, is untested. Add an int test: accept an invite on a draft and on a published article, then check the live row, the draft and `review.status`.
  - **Role.** The invite picks a role: co-author (byline), translator, editor. Accept adds the person to `authors` (so they can edit) and, for translator or editor, a `credits` row with that role.
  - **Leave and remove.** An author may leave. Any author may remove a co-author before submit. The last author cannot leave.
  - **Lock.** Opening a locale for writing takes the lock for that locale. A second person opening the same locale sees "Omar is writing the English version. You can read it, or switch to Arabic." and the body is read-only for them. The lock frees after 90 s without a heartbeat, or at once when the holder leaves the page. **Ask to write** sends the holder an in-app notice. **Take over** is shown after 5 min of no typing by the holder.
  - **Presence.** The editor head shows the people on the article now, with the locale each one is in.
- **Data.**
  ```
  article-invites
    article       articles, indexed
    person        people, indexed
    role          'author' | 'translator' | 'editor'
    invited_by    people
    status        'pending' | 'accepted' | 'declined' | 'revoked'
    at            date

  article-locks           (one row per article and locale; unique index on both)
    article       articles
    locale        'en' | 'ar'
    holder        users
    beat_at       date
  ```
  Presence is the set of lock rows plus a light "viewing" heartbeat. It can live in the same table with `mode: 'write' | 'read'`, or in memory. One container makes in-memory presence possible today (inferred), but a table survives a restart and a second instance.
- **Why our own lock, not Payload's.** Payload locks a whole document while one user edits in the admin, with a default of 300 s and a "take over" choice (fact, Payload docs). It is per document, not per locale, so it would block the translator. The Local API ignores locks unless the call passes `overrideLock: false` (fact). The portal save can pass that if we ever want the admin and the portal to respect each other. Recommended: our own per-locale lock for the portal, and the portal save also passes `overrideLock: false`, so a portal author never overwrites an admin who has the document open in `/admin`.
- **Access.** Unchanged for writes: `ownsViaAuthors` already gives every author edit rights. Invites: create by an author of the article; update by the invitee (accept, decline) or an author (revoke). Locks: server actions only. The save action refuses a write to a locale whose lock another user holds.
- **Realtime.** A heartbeat every 20 s from the open editor, answered with the current holders and viewers. No push channel. The "Ask to write" notice goes through the existing bell.
- **Lexical round-trip and versions.** No change to the body. One autosave stream per locale, as the spec already plans.
- **A risk to test (inferred, untested).** Two people autosave the same article in two locales at the same time. Each `payload.update({ draft: true, autosave: true, locale })` updates the latest draft version. If Payload rewrites the whole version row from a stale read, one locale could lose the other's last change. Make this an integration test in the spike: two parallel autosave loops in `en` and `ar`, plus one change to `tags` in the middle, then both locales hold their last text and `tags` holds its new value.
- **Hosting and cost.** Nothing new.
- **Shared fields.** Cover, tags, requested tier, authors, credits and the translation group are not localized. Two lock holders could overwrite each other there. Rule: the autosave sends only the localized fields of its locale (title, body, translation note). Shared fields save on their own, field by field, when a person changes one in the side panel, with an `updatedAt` check that refuses a stale write and shows "Sara changed this. Reload the panel." (inferred design, not tested).
- **Risks.** Two people in one locale must take turns. Whether that suits a class is a guess. The research says groups divide work in their own ways, so the "Ask to write" path must be quick. Lock rows left by crashes clear by timeout.
- **Effort.** 7 to 10 days (guess), on top of the phase 5 editor.

#### A2. Section ownership

- **UX.** Each top-level heading gets an owner. Only that person edits the section.
- **Data.** A section map keyed by heading, or a custom node.
- **Access.** A save check that compares the old and new body per section and refuses changes outside the writer's sections.
- **Realtime.** Same heartbeat as A1.
- **Lexical round-trip and versions.** A custom section node would enter the body JSON and every converter. A map outside the body would not (inferred).
- **Hosting and cost.** Nothing new.
- **Problem.** Sections are not stable objects in the Lexical JSON. A heading rename or a move breaks the map, and a custom node breaks the round-trip goal (inferred). It solves a case A1's per-locale lock plus "Ask to write" already covers.
- **Effort.** 2 to 3 weeks (guess). Not recommended.

#### A3. Live co-editing with Yjs and a self-hosted Hocuspocus

- **UX.** Google Docs style. Everyone types at once, with live cursors.
- **How.** `@lexical/react`'s `CollaborationPlugin` binds the editor to a Yjs document over a provider. The editor's own `editorState` must be `null`, the server must bootstrap the document, and client bootstrap is "dev-testing only" (fact, Lexical docs). Hocuspocus is a Node Yjs server. `onAuthenticate` can set `connection.readOnly`, `onLoadDocument` loads state, `onStoreDocument` saves it and is debounced by default (fact, Hocuspocus docs). Its database extension takes your own fetch and store functions, so Postgres works (fact).
- **Data.** A table for the Yjs binary per article and locale. A server job that turns Yjs state back into Lexical JSON and saves it to Payload with `payload.update`.
- **Access.** `onAuthenticate` checks the Payload session cookie and article ownership. When the article is `submitted`, every connection is read-only.
- **Realtime.** A WebSocket server. The standalone Next server has no upgrade handler (fact, Dockerfile), so this is a second container on Dokploy with its own domain or path routing (inferred).
- **Effect on the approved design.**
  - The spike's go criteria change. Initial content comes from a server bootstrap, not from loading JSON in the browser.
  - Undo moves from Lexical history to the Yjs undo manager. The spec's undo provider and spike check 4 (footnote undo) need a redo. A GitHub issue reports that `HistoryPlugin` must not be used with `CollaborationPlugin` (search snippet).
  - Payload inline blocks (Footnote, Mention) and blocks (Gallery, locked admin blocks) are decorator nodes with JSON fields. How `@lexical/yjs` merges two edits inside one footnote is not documented in anything I read. My guess: the whole field value is one attribute, so the last writer wins inside a footnote.
  - Payload versions: the server writes drafts, so the "who saved" stamp (`lastEditedByField`) becomes the server unless we pass the user (inferred).
- **Hosting and cost.** A second Node container and its memory. No license cost (Hocuspocus is MIT per its site; not verified this session).
- **Risks.** High. Two sources of truth (Yjs and Payload). Right-to-left cursors and IME in Arabic with live sync are untested.
- **Effort.** 5 to 8 weeks (guess), plus a new spike.
- **Alternatives in the same tier.** `y-websocket` is the provider the Lexical docs name. Y-Sweet is a Rust Yjs server with S3 or filesystem persistence and per-document client tokens from your backend (fact, GitHub README). It would sit beside RustFS or R2 rather than Postgres. Same design costs as Hocuspocus.

#### A4. Liveblocks

- **UX.** The richest kit: `@liveblocks/react-lexical` gives anchored threads, a floating composer, cursors and version previews (fact, Liveblocks docs). It initializes the editor state on the server and persists the document in its cloud (fact).
- **Cost.** Free (500 active rooms), Pro $30 a month (1,000 rooms), Team from $600 a month. Comments are metered past the included credits. EU region and self-hosting are Enterprise only (fact, pricing page, 2026-11-18).
- **Data.** The document lives in Liveblocks' store. A write-back job copies Lexical JSON into Payload. Comments live in Liveblocks too.
- **Access.** A Liveblocks auth endpoint in our app issues room tokens after the Payload ownership check.
- **Realtime.** Liveblocks' own service.
- **Lexical round-trip.** Same write-back and bootstrap problems as A3.
- **Risks.** Vendor lock-in and data outside CILAS's database.
- **Fit.** ADR 0009 rejected Liveblocks for spaces: content in the vendor's store, Egypt's PDPL, and price. Article bodies are more sensitive than chat. Ruled out unless the owner reopens ADR 0009.
- **Effort.** 2 to 3 weeks to wire (guess), plus the same write-back problem as A3.

### Options at a glance

| Option                                | New server | Body JSON changes  | Works while submitted | Phase fit                            | Effort (guess) |
| ------------------------------------- | ---------- | ------------------ | --------------------- | ------------------------------------ | -------------- |
| C1 document threads                   | No         | No                 | Yes                   | Phase 2                              | 4 to 6 days    |
| C2 anchored, outside body             | No         | No                 | Yes                   | Read-only: phase 2b. Editor: phase 5 | 5 to 8 days    |
| C3 MarkNode                           | No         | Yes                | No for authors        | Phase 5                              | 8 to 12 days   |
| C4 suggestions                        | No         | Yes                | No                    | Later                                | 4 to 8 weeks   |
| A1 invites, per-locale lock, presence | No         | No                 | n/a (locked)          | Phase 5                              | 7 to 10 days   |
| A2 sections                           | No         | Maybe              | n/a                   | Not recommended                      | 2 to 3 weeks   |
| A3 Yjs + Hocuspocus                   | Yes        | No, but write-back | n/a                   | After phase 7 at earliest            | 5 to 8 weeks   |
| A4 Liveblocks                         | Vendor     | No, but write-back | n/a                   | Ruled out by ADR 0009                | 2 to 3 weeks   |

## 4. Recommendation and phases

**Build C1, then C2, then A1. Defer A3. Skip C3, C4, A2 and A4.**

Reasons. The cheapest options cover every case named: the reviewer conversation, the fellow's teaching comments, the translator working in parallel, and two classmates taking turns. None adds a server, none touches the body JSON, and none weakens the review lock. A3 is the only option that changes the go criteria of the round-trip spike, and the spike is the riskiest item in the spec already.

### Phase 2 (add to the spec's phase 2): the conversation, document level

- Scope: the optional `space` field on articles (see "Course spaces" below), `article-comments` (C1), the Conversation panel on the read-only `/spaces/articles/[id]`, review moves merged in as system rows, a reply to a review note links `review_event`, bell kinds `comment`, `reply`, `mention` reused with links from `documentHref`.
- Ships alone: yes. It needs no editor. It survives a spike no-go, because authors can still write in `/admin` and talk in the portal.
- Ends when: an int test runs submit, ask for changes, author reply, reviewer reply, approve, and both authors and the admin read the same timeline; another member reads none.
- Spec change: add a migration (M-next) for `article-comments`. Add the Conversation panel under "Review and history". The review pane's History `<details>` becomes the same timeline.

### Phase 2b (new, small, after phase 2): anchored comments on the read-only body

- Scope: C2 for the reviewer on the rendered body.
- Ships alone: yes.
- Check to add to the spike: the quote found in rendered HTML equals the text in Lexical JSON for every article in both locales.

### Phase 5 (extend the spec's phase 5): writing together

- Scope: C2 in the editor (highlights and the comments rail), A1 (invites with roles, per-locale lock, presence by heartbeat), the save action passing `overrideLock: false`.
- Spike addition: the two-locale parallel autosave test from A1.
- Ends when: an e2e runs author A in English and author B in Arabic at once, both reload, both texts are there; a third person on English sees the lock line.

### Course spaces (field in phase 2, UI in phase 5)

- Add an optional `space` relation on `articles`, set when the article is started from a space. It ships in phase 2 so the fellow can join the conversation then. Before phase 5 an admin sets it in `/admin` for articles that already exist. The **Start a group article** button comes in phase 5.
- The field grants read access, so it is set once, on the server, to a space the creator is a member of (`membership` in `src/lib/spaces.ts`). Authors cannot change it later. Admins can. It drives three things: the invite picker lists that space's members, the fellows of that course may read and comment (if the owner agrees), and the space shows a "Writing" list of its group drafts to their authors and fellows only.
- Spec change: the Article editor section gains the `space` field and the invite panel. The data access rule gains "fellows of the linked course read drafts and comments".

### Later: live co-editing

- Trigger to revisit A3: lock data. Count "Ask to write" and "Take over" events per week. If they are frequent in one locale, two people want the same text at the same time, and the lock is the bottleneck. Until then A3 costs more than it gives.

### What changes in the current spec, in one list

1. Phase 2 gains `article-comments` and the Conversation timeline.
2. A new small phase 2b for anchored comments on the read-only body.
3. Phase 2 gains the `space` field. Phase 5 gains invites, the per-locale lock, presence, the comments rail and the Start button.
4. The round-trip spike gains two checks: the quote match, and the parallel two-locale autosave.
5. The access rules gain fellow read of linked drafts (if approved).
6. No change to `review-events`, the D9 diff, the undo provider or the version pin.

### Open questions for the owner

1. **Fellow's role.** May a course fellow read and comment on drafts started in their space? Recommended: yes, comment only. Is the fellow a gate before the admin (a "fellow approved" step)? Recommended: no gate. It adds a state to the review model and a handoff to the matrix.
2. **Who sees the conversation.** Authors and admins only, or the fellow too (depends on 1)? Never public.
3. **Co-author consent.** Must an invitee accept before they are listed? Recommended: yes.
4. **Translator credit.** A translator who also co-writes: in the byline (`authors`), in `credits` as translator, or both? Recommended: both, because `authors` is also the edit right.
5. **Comments after publish.** Keep the thread for authors and admins, read-only? Recommended: keep, read-only.
6. **Who may remove a co-author.** Any author, or only the one who started the article? Recommended: any author before submit, nobody after.
7. **Reopen ADR 0009 for Liveblocks?** Recommended: no.

## 5. The best user experience

### Flow

1. **Start.** In a course space, the student opens the Writing tab and presses **Start a group article**. The editor opens with the space set and the student as first author.
2. **Invite.** In the side panel, **Invite** shows the space's members with avatars. The student picks Omar as co-author and Sara as translator. Each gets a bell row and an email with **Accept** and **Decline**.
3. **Write.** Omar writes English. Sara opens Arabic. Each holds the lock for their locale. The head shows both, with "EN" and "AR" under the avatars. If Lina opens English while Omar writes, she reads, and can press **Ask to write**.
4. **Comment.** Sara selects an English sentence and asks "Is this a quote? I need the source to translate it." Omar gets a `mention`. He replies and resolves. The thread folds to a chip.
5. **The fellow.** The course fellow reads the draft from the space and leaves a document-level comment on the argument. The authors get a `comment` row.
6. **Submit.** Any author presses **Submit for review**. Everyone's editor turns read-only with the line "Submitted. An admin reviews it." Comments stay open.
7. **Review.** The admin reads the read-only body, selects a paragraph, comments "Cut this, it repeats the intro", then presses **Ask for changes** with a note. The note shows in the timeline as a system row. The authors get `changes_requested`.
8. **Revise.** Authors reply to the note. The reply links to that review event. They edit, resolve the threads, and submit again. The reviewer sees "Round 2", the diff, and which threads were resolved.
9. **Publish.** The admin approves at a tier. The byline shows every author. Credits show "Translated by Sara". Every author gets `approved`.

### Wireframe: the editor, wide screen

```
+--------------------------------------------------------------------------------------------+
| < Articles      The river and the city                     (O)EN (S)AR  +1   Saved 2s ago  |
|                                                            Omar  Sara                      |
|  [ English | Arabic ]   You are writing English. Sara is writing Arabic.  [Submit for review]|
+---------------------------------------------------------------+----------------------------+
|                                                               | Comments (3 open)    [+]   |
|  The river and the city                                       | [Open v]  [This text v]    |
|                                                               |----------------------------|
|  Cairo has always faced the Nile, but the city we know        | > "never once turned its   |
|  ========never once turned its back========  on the water.    |    back"                   |
|                                                               |   Sara  2m                  |
|  [footnote 1]  The first maps ...                             |   Is this a quote? I need  |
|                                                               |   the source.              |
|  ## Bridges                                                   |   Omar  1m                  |
|  ...                                                          |   Yes, from Abu-Lughod.    |
|                                                               |   [Reply]      [Resolve]   |
|                                                               |----------------------------|
|                                                               |  Whole article              |
|                                                               |   Dr. Hana (fellow)  1h     |
|                                                               |   The second half needs     |
|                                                               |   one clear argument.       |
|                                                               |   [Reply]      [Resolve]   |
|                                                               |----------------------------|
|                                                               |  -- Admin asked for        |
|                                                               |     changes, round 1 --    |
|                                                               |   "Cut the repeated intro" |
|                                                               |   [Reply to this note]     |
|                                                               |----------------------------|
|                                                               |  2 resolved threads  >     |
+---------------------------------------------------------------+----------------------------+
| Side panel (below on phone): Cover | Who can read it | Authors: Lina, Omar, Sara(translator)|
|                              [Invite]  Pending: Ziad (co-author)                            |
+--------------------------------------------------------------------------------------------+
```

When another person holds the lock for the open locale:

```
+--------------------------------------------------------------------------------------------+
|  Omar is writing the English version.  You can read it, or switch to Arabic.               |
|                                            [Ask to write]   [Switch to Arabic]              |
+--------------------------------------------------------------------------------------------+
```

### UX rules

- **Phone.** The comments rail becomes a bottom sheet opened from a "3 comments" chip. Selecting text shows a floating "Comment" action.
- **Resolve.** Any author or the reviewer may resolve. Resolved threads fold and stay reachable (Notion keeps resolved comments behind a filter, fact).
- **Notifications.** A new thread tells all authors (`comment`). A reply tells the thread's people (`reply`). An @mention tells that person (`mention`), only if they can read the article (Notion does the same, fact). No notification for your own action. Resolving tells no one.
- **Right to left.** The rail follows the locale being viewed. An Arabic quote shows right to left in an English UI.
- **Arc parts.** `CommentThread` (free, already installed and used in `space-thread.tsx`), `mention-input`, `avatar-group` for the presence line, `bottom-sheet` for the phone rail. `presence-stack` and `agent-cursor` are Arc Pro. I did not read their source and the proposal does not need them: `avatar-group` with a small locale badge covers presence.

## 6. Sources

Read this session:

- Lexical, collaboration with React: https://lexical.dev/docs/collaboration/react
- Lexical playground `CommentPlugin` (page was truncated, so the resolve logic was not visible): https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/CommentPlugin/index.tsx
- Hocuspocus database extension: https://tiptap.dev/docs/hocuspocus/server/extensions/database
- Hocuspocus hooks: https://tiptap.dev/docs/hocuspocus/server/hooks
- Y-Sweet README: https://github.com/jamsocket/y-sweet
- Liveblocks pricing: https://liveblocks.io/pricing.md
- Liveblocks React Lexical API: https://liveblocks.io/docs/api-reference/liveblocks-react-lexical
- Payload document locking and Local API `overrideLock`, via Context7 from https://github.com/payloadcms/payload/blob/main/docs/admin/locked-documents.mdx and https://github.com/payloadcms/payload/blob/main/docs/local-api/overview.mdx
- GitBook change requests: https://gitbook.com/docs/collaborate/change-requests
- Substack group publishing tools: https://on.substack.com/p/group-publishing-tools-on-substack
- Notion comments and mentions: https://www.notion.com/help/comments-mentions-and-reminders
- Marttunen and Laurinen, participant profiles in collaborative writing: https://www.jowr.org/jowr/article/view/712
- Li and Zhang, collaborative writing in L2 classrooms, a research agenda (abstract only): https://www.cambridge.org/core/journals/language-teaching/article/collaborative-writing-in-l2-classrooms-a-research-agenda/F2AA945AFCB875D8344E21F933507DD8
- Arc `comment-thread` (free) and `presence-stack`, `agent-cursor` (Pro), via the Arc MCP: https://uiarc.dev/components/comment-thread and https://uiarc.dev/components/presence-stack

Search snippets only (the page was not read; claims from these are labelled):

- Google Docs suggesting mode, comments and editors accepting suggestions: https://businessinsider.nl/how-to-track-changes-and-add-comments-in-google-docs-using-suggesting-mode/
- Substack guest byline approval: https://support.substack.com/hc/en-us/articles/360039016832-Can-my-Substack-publication-have-multiple-authors-or-contributors (fetch refused, 403)
- Soft locking in a CMS: https://docs.magnolia-cms.com/product-docs/6.2/modules/list-of-modules/soft-locking-module (fetch failed)
- `HistoryPlugin` with `CollaborationPlugin`: https://redirect.github.com/facebook/lexical/issues/6271
- A community Payload comments plugin (`payload-lexical-collaboration`), comments only, not co-editing: https://www.pkgstats.com/pkg:payload-lexical-collaboration (fetch failed, 503)

Repo files read: `src/collections/Articles.ts`, `src/access.ts`, `src/lib/review.ts`, `src/lib/review-hooks.ts`, `src/lib/review-ownership.ts`, `src/fields/review.ts`, `src/fields/credits.ts`, `src/lexical/article-body.ts`, `src/lexical/legacy-features.ts`, `src/lib/notification-kinds.ts`, `src/lib/realtime/hub.ts`, `src/lib/realtime/events.ts`, `src/lib/realtime/publish.ts`, `docs/realtime-notifications.md`, `src/collections/SpaceComments.ts`, `src/collections/Spaces.ts`, `src/collections/Memberships.ts`, `src/lib/spaces.ts`, `src/components/space/space-thread.tsx`, `docs/adr/0009-spaces-built-in-the-site.md`, `Dockerfile`, and the portal spec.
