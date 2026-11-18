# Portal research

Outside sources behind the portal spec rules. Collected 2026-11-18. Where this file and the spec differ, the spec wins.

# Feature research (for spec round 2). Rules from outside sources, mapped to spec sections. Quality: mostly design blogs and vendor docs; standards marked.

## Applicants kanban (drag and drop)
- Every drag has a keyboard path: Space lifts, arrows move, Space drops, Esc cancels (dnd-kit docs, Frontkit). Plus our Move to menu (WCAG 2.5.7).
- Announce lift, move, drop and cancel in a polite live region; customize the text per app; debounce move announcements (dnd-kit default 500 ms).
- Do not capture plain arrow keys outside drag mode: screen readers use them (GitHub engineering post on accessible sortable lists). Test with real screen-reader users.
- Jira had closed bugs where boards could not be operated by keyboard; fix was off-screen instructions + live region.
Sources: https://docs.dndkit.com/guides/accessibility, https://github.blog/engineering/exploring-the-challenges-in-creating-an-accessible-sortable-list-drag-and-drop/, https://primer.style/accessibility/patterns/drag-and-drop

## Undo instead of confirm
- Reversible actions: act at once, offer Undo; keep confirm dialogs only for unrecoverable actions (several sources). Our delete session (hold + confirm) fits that exception.
- 5 s is a convention, not research; WCAG 2.2.1 Timing Adjustable applies. The toast must not dismiss while it has focus. Undo must not live only in the toast: also reachable in the main UI (our "Undo all" bar and the pending card).
- A toast with a button needs real focus handling (Scott O'Hara): never move focus into the toast automatically; give a keyboard path to it.
Sources: https://www.scottohara.me/blog/2019/07/08/a-toast-to-a11y-toasts.html, https://blog.logrocket.com/ux-design/toast-notifications, https://www.saasui.design/blog/saas-destructive-actions-confirmation-ux-patterns

## Bell (events) vs Needs you (tasks)
- Keep notifications distinct from a task center (SAP Fiori). GitLab found users did not expect notifications inside a to-do list.
- Read is not resolved: a task leaves only when the work is done; a notification can be read.
- One task has one task row. The bell may hold an event row for the same item: it says what happened and links to the task. Do not show one task as two task rows (WooCommerce guidance).
- A notification says who, what, why in about 2 s (Courier).
Sources: https://www.sap.com/design-system/fiori-design-web/v1-148/ui-elements/notification-center/usage, https://gitlab.com/groups/gitlab-org/-/epics/11609, https://developer.woocommerce.com/docs/extensions/ux-guidelines-extensions/task-list-and-inbox/, https://www.courier.com/guides/how-to-build-a-notification-center/chapter-3-best-practices-for-notification-centers

## Onboarding and empty states
- Empty state = clear instruction + one visible action (+ an example when useful) (Appcues).
- Put the checklist where the empty space is. Avoid misleading demo data.
- Measure real use, not checklist completion (Rework).
Sources: https://www.appcues.com/blog/user-onboarding, https://userpilot.com/blog/empty-state-saas/

## Review and approval
- Actions: approve, request changes (with a note), decline. A per-item timeline of who decided what and when (ButterCMS, Assembly, Abstract).
- Diff toggle with added/edited/removed marks (GitBook change requests); word-level highlight in text.
- Status changes must be enforced on the server, not by hidden buttons.
Sources: https://docs.gitbook.com/collaboration/change-requests, https://buttercms.com/docs/create-content/collaborating-with-teams/content-approval-workflows

## Autosave (article editor, course form)
- One small persistent status near the content with honest states: Saving, Saved, Not saved (retrying). Never a stale "Saved". Do not flicker on every keystroke.
- Debounce (example: 1.5 s after typing stops, plus a 30 s fallback).
- Stale save from another tab or person: refuse and offer Reload / keep mine / see changes; never overwrite silently. (Matches the existing `saveScheduleEdits` updatedAt check.)
- Relative time ("Saved 2 min ago") reads better than a clock time.
Sources: https://www.saasui.design/blog/saas-autosave-save-states-ux-patterns, https://github.com/grafana/design-system/blob/main/docs/06-patterns/save.mdx

## Shell and navigation
- Phone bottom bar: 3 to 5 destinations with icon + label, More for the rest (Material, HIG).
- Collapsed rail: icons with tooltips; same item order on desktop and phone; remember the folded state per user (Apple HIG).
- Mark the current item (aria-current), aria-expanded on the fold toggle.
Sources: https://www.uxpin.com/studio/blog/mobile-navigation-examples/, https://app.uxcel.com/courses/apple-hig/navigation-architecture-159/sidebar-patterns-8728

## Arabic and English (RTL)
- Test forms as whole journeys in Arabic: direction, validation text, dates, numbers.
- dir="auto" on user-entered fields and user text; isolate Latin names and numbers inside Arabic (bdi).
- Logical CSS properties only. Arabic strings are often 20 to 30 percent wider: test overflow. Choose images per language; do not mirror photos.
Sources: https://www.argosmultilingual.com/blog/planning-for-rtl-languages-how-layout-content-and-qa-fit-together

## Article editor on the site (Lexical)
- Payload docs: features go through lexicalEditor({ features }); custom features start from the server feature; JSX converters can share node logic between editor and front end (isEditor flag). No official guide for a site-side editor: the spike stays required.
Sources: https://payloadcms.com/docs/rich-text/overview, https://payloadcms.com/docs/rich-text/custom-features

## Command bar
See palette-rules.md.

# Command bar rules (for the spec's palette section, phase 6)

Sources: Superhuman blog (2021), Retool blog (2022), Nextjournal blog (2021), W3C APG combobox list example (2025), a secondary benchmark spec (get-design-done). Our own choices are marked "ours".

## Sources (5 groups, one surface)
1. On this page (local actions from the route), 2. Go to (portalNav), 3. My work (Local API, overrideAccess false; admin: review queue; admins and fellows: applicant names, a fellow on own courses only), 4. Space posts (/api/spaces-search), 5. Site (Typesense: courses, articles, people, events; reuse the site-search adapter; public key for courses, people and events, community key for the community articles index only; adapter chunk loads on open, preloaded on hover/idle). Applicant data never enters Typesense.

## Rules
- One palette for actions and content. No modes, no second palette (Superhuman, Retool).
- Trigger: Cmd/Ctrl+K everywhere in the portal, same key closes. Visible search button in the sidebar and phone header (no hover-open).
- Editor conflict: inside the article editor and rich fields, Cmd+K inserts a link (Lexical convention). A second Cmd+K, or the search button, opens the palette (Superhuman pattern).
- Context: each command declares `when(ctx)` (route, role, selection). Irrelevant commands are hidden; relevant ones are boosted, not the only ones (Superhuman, Nextjournal).
- Ranking: Arc's default matcher (ruling r1) over label + aliases, both languages (an Arabic UI still matches English labels and the reverse; ours). Each command has aliases ("archive" finds the right verb). Stable order for the same query (muscle memory). A "Top result" row when the best match is in a lower group (Retool).
- Empty query: Recent (last 5 used, per account, client storage; ours, no frecency math), then On this page, then Create, then Go to.
- Result count: up to 5 per network group with "Show all in {group}" (Nextjournal, Superhuman). Local groups show all matches.
- Shortcuts: each row shows its key in keycaps (aria-hidden); the palette teaches shortcuts. Only real shortcuts are shown.
- Nested: flat. No drill-down level (ruling r2, dec2-M7).
- Async: local groups render on every keystroke; network groups wait 150 ms after typing stops and min 2 characters (ours), cancel stale requests (AbortController), keep old results until new ones arrive (no flicker), `aria-busy` on the listbox while loading, a per-group error row ("Site search is not available. Try again.") that never blocks local results.
- Budget (ours): local filtering under 16 ms per keystroke for up to 500 commands; first network results under 400 ms p75 on the prod clone. No virtualization needed under 2-3k items (cmdk README).
- ARIA (APG): native <dialog> showModal with an accessible name; input role=combobox, aria-autocomplete=list, aria-controls, aria-expanded; listbox of options grouped by role=group with labels; DOM focus stays in the input, aria-activedescendant moves; scroll the active option into view in script; aria-selected only on the active option. Results count and "No results for X" go to the shared polite live region after typing pauses.
- Keys: Up/Down move (wrap), Enter runs, Cmd/Ctrl+Enter opens in a new tab for links, Esc as above, Home/End stay with the text cursor (APG).
- Focus: record the element focused before opening; restore it on close. If a command navigates, focus goes to the new page's h1.
- Motion: open and close with a fade of 80 to 150 ms and no movement, the same for key and pointer (ruling r2). No animation of result reordering while typing, no `transition: all`. Reduced motion: none.
- Phone: full-height dialog with a visible Close button, 44 px rows, icons on every row, opened from the header Search button and the More sheet.
- Anti-patterns: navigation-only palette; mode pickers; hover-open; covering the field being edited; two palettes.

## Tests
- portal-palette e2e: per role rows; context rows change per route; Cmd+K in the editor inserts a link and the second press opens the palette; Typesense group fills after the pause and a failure shows the group error while local rows stay; an applicant name search returns rows only for admins and for the fellows of that course; keyboard-only run; focus returns; phone layout.
- Unit: command `when(ctx)` table; ranking stability for a fixed query.
