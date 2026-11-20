# Portal phase 1a: frame and shell. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the frontend into `(site)` and `(portal)` route groups under one root layout, put the space pages and their `@dialog` slot in a `(rooms)` group with the one spaces-off check, and give every `/spaces` page a portal shell (sidebar, phone header, bottom bar and More sheet, account menu) built on shared accessibility and feedback parts. `/spaces` keeps today's page inside the shell.

**Architecture:** PR A moves route files; `SiteFrame` holds the public chrome. PR B fixes the failing contrast tokens and the focus ring where Arc defines them (`foundation.css`), so every page gets them, and sets the space pages' own tokens (Arc radii, unread, motion) in the existing `:root:has([data-page='spaces'])` scope. PR F adds a `ToastLayer` that Arc's modal primitives render, so toasts show inside an open modal. PR D adds `pnpm db:seed:empty`. PR C adds `src/portal/feedback/` and replaces `SiteFrame` in the portal layout with `PortalShell` from `src/portal/nav/`.

**Tech stack:** Next.js 16.4.6 App Router (`output: 'standalone'`), React 19.2.6, next-intl 4, Payload 3.91.0 (Postgres), Arc UI (`src/components/arc`), Vitest 4, Playwright 1.58.2, `@axe-core/playwright` (new, PR C), postcss 8.

**Spec:** `docs/superpowers/specs/2026-11-18-portal-design.md` (Design language, Accessibility baseline, Architecture, Navigation, Tests, Phase 1a). It wins where they differ.

**Status.** Nothing is built. Every "Expected" line is a prediction: when a run differs, find out why first. Unproven until run: the toast layer per Arc primitive (F1), the spaces-off status in dev and production mode (A5, A6), what a post link opens at 390px and from outside `(rooms)` (A4), a `payload.create` notification reaching the open tab (A4, C10), `db:seed:empty` migrating under `tsx` (D3), `(pointer: coarse)` under Playwright touch emulation (C12), the review world resolving packages from the scratchpad (B2, F3, C13).

---

## File structure

- `src/app/(frontend)/[locale]/`: `layout.tsx` (`<html>`, `<body>`, providers); `(site)/` under `SiteFrame`; `(portal)/spaces/` (`layout.tsx`, `(home)/`, `(rooms)/` with the spaces-off check and `@dialog`; from C8 the shell's `main` holds the 1200px frame).
- New: `src/portal/{theme,feedback,nav}/`, `src/components/site-frame.tsx`, `src/lib/sign-out.ts`, `seed/empty*`, `testing/portal.fixture.ts`, three e2e specs and `e2e/portal-axe-known.json`. Each task's **Files** line lists the rest.

## PRs

What each reader sees: A, nothing with spaces on, and `/spaces` loads with spaces off. B, darker muted text, warnings and borders and an opaque ring on every page, the public site included, and the spec radii on space pages. F, toasts inside open modals. D, nothing. C, the shell on every `/spaces` page.

| PR                      | Branch                       | Base                 | Tasks     | Gate            |
| ----------------------- | ---------------------------- | -------------------- | --------- | --------------- |
| A. Route groups         | `portal/phase-1a-frame`      | `main`               | A1 to A6  | operator merges |
| B. Portal tokens        | `portal/phase-1a-tokens`     | `main`               | B1, B2    | operator review |
| F. Toast layer          | `portal/phase-1a-toasts`     | `main`               | F1 to F3  | no review hold  |
| D. `empty` seed         | `portal/phase-1a-empty-seed` | `main`               | D1 to D4  | operator merges |
| C. Shell, nav, feedback | `portal/phase-1a-shell`      | `main` after A, B, F | C1 to C13 | operator review |

- C needs A's layouts and fixture, B's tokens, F's `ToastLayer` and `--toast-stack-height`. F reads no B token. D needs nothing; C's e2e does not use `cilas_empty`.
- **Run order: A, B, F, D, C.** Code may be written in parallel; heavy steps, port 3100 and `cilas_dev`'s `spaces_mode` row are shared, so one PR runs heavy steps at a time. `main` deploys after CI.

## Global Constraints

**Production safety. This server runs production.**

- **Env files.** No phase 1a command reads `/home/salah/cilas/.env` (production) except the leak check, which hashes it. That checkout's `.env.local` and `.env.development.local` held the production `PAYLOAD_SECRET` once (`scripts/clone-r2-local.mjs:253-254`); PR #45 rotated them (merged as c4d14342), and the check now finds no production value in either (measured). A worktree copies none of them; each PR generates two from the worktree root, then runs the leak check:
  ```bash
  grep -E '^R2_[A-Z_]+=' /home/salah/cilas/.env.development.local > .env.development.local
  printf 'DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev\nPAYLOAD_SECRET=%s\nPMOAUTH_TOKEN_PEPPER=%s\nNEXT_PUBLIC_SERVER_URL=http://localhost:3100\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
  docker inspect $(docker ps -q --filter label=com.docker.swarm.service.name=cilas-web-qfeky3) --format '{{range .Config.Env}}{{println .}}{{end}}' | node -e '
  const fs = require("node:fs"), dotenv = require("dotenv"), h = (v) => require("node:crypto").hash("sha256", v)
  const read = (f) => dotenv.parse(fs.readFileSync(f))
  const container = Object.values(dotenv.parse(fs.readFileSync(0))).filter((v) => v.length >= 16)
  if (!container.length) { console.error("no production container env"); process.exit(1) }
  const prod = new Set([...Object.values(read("/home/salah/cilas/.env")).filter(Boolean), ...container].map(h))
  const files = process.argv.length > 1 ? process.argv.slice(1) : [".env", ".env.local", ".env.development.local"].filter(fs.existsSync)
  const bad = files.flatMap((f) => Object.entries(read(f)).filter(([, v]) => v && prod.has(h(v))).map(([k]) => f + ":" + k))
  if (bad.length) { console.error("production value in", bad.join(" ")); process.exit(1) }' [files]
  ```
  The container is the running `cilas-web` service, selected by its swarm label (`docker ps --format '{{.Names}} {{.Label "com.docker.swarm.service.name"}}'` lists it; a name filter would also match `preview-cilas-web-…`). The check only reads its env (`docker inspect`); it prints no value. `[files]` is empty in a normal run (the three default files); the negative test passes a file.
  `.env.development.local` holds only the local R2 (`testEnv`, Playwright and `next dev` read it); `.env` the local database, a throwaway secret and pepper, and `NEXT_PUBLIC_SERVER_URL` (build-time; without it `sitemap.ts`, `robots.ts` and `metadataBase` name port 3000, and A6's `check-seo` fails with "Wrong sitemap origin"); there is no `.env.local`. Every other key (Resend, Typesense, Turnstile, Google, VAPID, PostHog) is unset; `.env.example`'s set lines are `src/env.ts` defaults. The check runs after install (`dotenv` is a dependency). It hashes `/home/salah/cilas/.env` (every value) and the production container's env (values of 16 characters or more, so `auto` or `8108` cannot collide), prints key names only and exits 1 when a generated file holds a value with an equal hash; it exits 1 too when the container is not running. It needs no allow-list (measured: nothing matches). Self-test, once per PR: `cp /home/salah/cilas/.env .env.leaktest.local` (ignored by `.env*.local`), run the check with `.env.leaktest.local` as `[files]`: it must exit 1 and list key names; then `rm .env.leaktest.local`. Rerun the check after any env file change. Tests and the review world make their own rows, so a new secret breaks none (inferred).
- **Shorthand** (expand it). `RUN` is `DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev nice -n 19 ionice -c3`, before every Vitest (`pnpm audit:access` too; `vitest.setup.ts:13`), server, Playwright and `tsx` run, so a stray export cannot move it. Vitest reads `.env` (`vitest.setup.ts:1`) and `testEnv` (`testing/local-env.ts:55`). No test needs a production value. No Turnstile secret passes `requireTurnstile` (`src/forms/spam-check.ts:14`; the siteverify int tests mock success only); no Google secret turns `payload-oauth2` off (`src/plugins/google-auth.ts:39`), and `google-sign-in.int.test.ts:30` signs its own JWT; no Typesense key syncs nothing (`src/plugins/typesense/index.ts:319`) and hides search. `course-sessions.int.test.ts:239` skips; on the base it fails against `.env`'s key (nothing on 8108), so no PR lists it. Only D3's sign-in check points at `cilas_empty`.
- **Port 3000 is production.** Servers listen on 3100. Dev server: `RUN pnpm dev --port 3100 --hostname 127.0.0.1` in the background, log in the scratchpad. `next` binds `0.0.0.0` by default (`node_modules/next/dist/bin/next`).
- **Production mode** (A6) skips `.env.development.local`. One shell, the server in the background:
  ```bash
  export $(grep -E '^R2_(BUCKET|PUBLIC_URL|REGION)=' .env.development.local | xargs)
  export R2_ENDPOINT=https://e2e.invalid.r2.cloudflarestorage.com R2_ACCESS_KEY_ID=e2e R2_SECRET_ACCESS_KEY=e2e
  RUN pnpm build && RUN pnpm start --port 3100 --hostname 127.0.0.1
  ```
  The R2 endpoint and keys are `playwright.config.ts` `webServer.env`'s: under `NODE_ENV=production` `src/env.ts:152-156` refuses any endpoint but `https://*.r2.cloudflarestorage.com`, and the build imports it (`next.config.ts:2`). Nothing uploads; covers do not load (`next.config.ts:17` allows the local image host in development only). The secret and the 32-character pepper `next start` needs (`src/plugins/mcp/pepper.ts`) come from the generated `.env`. The "does not work with output: standalone" warning is expected (it serves `.next` from the repo root); never `node .next/standalone/server.js`. Afterwards `rm -rf .next`.
- **E2E.** Playwright never starts a server: outside CI `webServer` is `undefined` (A1). `playwright.production.config.ts` throws outside CI (A1). `E2E <file> [flags]` means, in a fresh shell (not the production block's: its exported `R2_ENDPOINT=https://e2e.invalid…` makes `playwright.config.ts:12` throw): `curl -fs -o /dev/null http://localhost:3100/en || exit 1`, then `PLAYWRIGHT_BASE_URL=http://localhost:3100 RUN pnpm test:e2e <file> --workers=1 --reporter=list [flags]`.
- **Review world (B2, F3, C13).** A throwaway, uncommitted `<scratch>/review-world.mts` (`.mts`: top-level await), run in the background from the worktree root as `RUN npx tsx <scratch>/review-world.mts <profile>`; log in the scratchpad. No e2e runs meanwhile. Static imports, by absolute worktree path, are only `testing/payload.fixture.ts` (`createTracker`, `lockSpacesMode`, `uniq`, `uniqEmail`) and `requireLocalStorage` (`testing/local-env.ts`), which do not reach `src/env.ts` (it needs the R2 keys of (1)). `consentAccept` (it does, via `link-preview.ts`), `src/payload.config.ts` and `getPayload` (`node_modules/payload/dist/index.js`) are dynamic, after (1).
  1. `process.loadEnvFile('.env.development.local')`; `requireLocalStorage(process.env)` and the `localhost:5433` check.
  2. `getPayload`, `createTracker()`, `lockSpacesMode()`; print `spaces_mode` and `spaces_trial_community`.
  3. Profile `main` (B2, F3): a member (`uniqEmail`, printed password, `consentAccept`), a place, a cycle, a published course with dates in 2034 (as `session-drawer.e2e.test.ts`, so the space is not archived) with the member enrolled `accepted` and one session; read its space's `introduction_post` id, set it to null, delete that post; a community space `uniq('Review community')` with audience `all`; one post by the member in each. Profile `portal` (C13): `await import` of `testing/portal.fixture.ts` (absent on `main`, so never static): `portalWorld` with C1's `otherCourse` and `loners`, plus 40 `all`-audience community spaces (`uniq('Review space')`), `poster` posts giving four of them 0, 9, 10 and 120 unread; `course` gets an existing `cilas_dev` `media` id as `cover_image` (read, not created); `otherCourse` and every community have none (a community has no cover, `spaces-data.ts:84-85`); the fixture admin has no person (`ensurePerson` skips admins, `Users.ts:50`). Both: every row, posts too, through `track`; print every id.
  4. `spaces_mode: 'on'`; print each account's email and password and the paths.
  5. Commands. At start it truncates `review-world.control` beside the script (`import.meta.dirname`; after the copy fallback below, at the worktree root) and once a second reads the lines appended since: `n` writes a `notifications` row (`kind: 'comment'`, `title`, `link` to the course post) for every printed account, whose live event raises the toast (`site-notifications.tsx:141`); `off` and `on` set `spaces_mode`; `q` quits. Send one with `echo n >> <scratch>/review-world.control`; the steps below write `echo n` and so on. SIGTERM and SIGINT end the wait as `q` does, with no `process.exit`.
  6. `finally`: restore both settings, release the lock, `cleanup(payload)`, print the restored mode.

  After a SIGKILL (the lock dies with the process): set the two settings back in `/admin/globals/site-settings` and delete the printed ids. If `tsx` cannot resolve a package from the scratchpad, copy the file to the worktree root, run it there, delete it, and check `git status --short`.

- **Database.** The db already runs. Check: `docker port cilas-db-1 5432` prints only `127.0.0.1:5433`, and `docker ps --filter name=cilas-db-1` shows it up. If it is down, start it only from the main checkout: `cd /home/salah/cilas && docker compose -p cilas up -d db`. Never run `docker compose … up` from a worktree: the loopback bind lives only in the main checkout's untracked `docker-compose.override.yml`, so a worktree recreates `cilas-db-1` on `0.0.0.0:5433` (the production clone, on every interface). Do not copy that override. Other output: stop and report. Nothing wipes or migrates `cilas_dev` (a production clone). No task changes the schema or an access rule; if one would, stop and report.
- **Heavy steps** (**[heavy]**): install, a server, `next build`, Playwright, Vitest `browser` or `*.int.test.ts`, `pnpm test:unit|test:int`, over 20 requests to a server, the review world. One at a time, under `nice -n 19 ionice -c3`; stop the server when done. Light: oxlint, `pnpm exec tsgo --noEmit`, `RUN pnpm exec vitest run --project node|dom <one file>`.
- **No streaming boundary above the check.** A not-found under a `loading.tsx` or `<Suspense>` streams with status 200 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`, Status codes). Nothing between `[locale]/layout.tsx` and `(rooms)/layout.tsx` wraps its children in either (A3). A5's 404 asserts guard it in every later PR.

**Per-PR order.** 1. Tasks with their targeted tests. 2. Reviews: a PR that changes a screen gets ux-auditor and better-interface, then break-ui; every PR gets code-review, then security-review. 3. Fixes, with tests. 4. Full suite **[heavy]** once: `RUN pnpm test:unit`, then `RUN pnpm test:int`; a base failure is one line in the PR. 5. `pnpm exec tsgo --noEmit`; `RUN pnpm audit:access && git status --short scripts/access-audit.snapshot.json` prints nothing. 6. Open the PR.

**Spec values** (every task): text 4.5:1, non-text and the ring 3:1; targets at least 24x24, 44x44 under `(pointer: coarse)`; motion 120 to 200 ms with `--ease-standard`, and under reduced motion none; no ring on pointer focus; counts in `tabular-nums`; keys and shortcuts in `<bdi dir="ltr">`; user text `dir="auto"`; logical CSS properties only.

**Code and tests.**

- **Install** `nice -n 19 ionice -c3 pnpm install --frozen-lockfile` **[heavy]** once per worktree.
- **Libraries first.** Before a task builds a module from scratch, its builder checks the installed deps (`package.json`) and maintained libraries, and names the choice in the PR (Decision log, Libraries used).
- **Tests** sit beside their subject (`*.unit.test.ts(x)`, `*.int.test.ts`, `*.dom.test.tsx`, `*.browser.test.tsx`); e2e specs are `e2e/*.e2e.test.ts`. No comments, annotated return types, mocks, fixed sleeps or retries in test code (`testing/README.md`, oxlint).
- **Matrix.** Every e2e test runs as admin, fellow and student, in English and Arabic, at 1440 and 390px, unless Deviation 19 exempts a dimension; the shell also runs at 320 and 720px (Deviation 16). Loop over `ROLES`, `LOCALES`, `WIDTHS` (A4), values in the test name; log in once per role and reuse its `storageState`, except that a test that signs out logs in afresh (logout ends the stored session); paths through `localePath`; copy from `MESSAGES[locale]` (A4). Every UI surface runs in Arabic at least once. axe tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
- **Describes.** Every e2e `describe` in A1, A4, A5 and PR C starts with `test.describe.configure({ mode: 'serial', timeout: 300_000 })` (as `session-drawer.e2e.test.ts:47`): a dev compile under `nice` outlasts Playwright's 30 s default.
- **Locators.** The toast region's name is `Notifications.label` plus ` (Alt+T)` (`toast-stack.tsx:790`; `SiteToasts` keeps the hotkey): `getByRole('region', { name: new RegExp('^' + label) })`, in F1's tests too. The bell popover is the `dialog` with that bare name, `exact: true`; the bell is the `button` whose name matches `^<name>(,|،|$)` (Arabic `triggerUnread` starts with `،`).
- **`spaces_mode`.** A file that depends on it calls `holdSpacesMode` (A4) once in its top-level `beforeAll` (timeout 300 s). Two such files never run at once.
- **Copy** in `messages/{en,ar}.json` under `Portal`, ICU plurals, gender-neutral Arabic (D8). **Components** from `src/components/arc`; never added again. **Lazy UI** (the More sheet): `preloadable`, mounted after the action, `.preload` on `onPointerEnter`, `onFocus`, `onPointerDown`. **Perf**: no threshold; PR C reports `/en/spaces` TTFB per role from the dev server, labelled "dev server, not the 1c baseline".

**Commits and PRs.**

- **One commit per task**, after its tests pass; lint staged files first; never a red test alone. The user is the author; the body says why and, for HTML, CSS or client JS, the modern-web-guidance guides applied. Trailer `Co-Authored-By: Claude <Model> <noreply@anthropic.com>`, the model that did the task.
- **PRs** follow `worker.md` (ready for review, 40-line body, its headings; long lists such as Deviation 14's entries, review checks and findings go in a PR comment the body links); title `type(scope): subject (portal phase 1a, PR <letter>)`.
- **Skills.** Every task has a "Skills:" line from the spec's table. A task that writes HTML, CSS or client JS loads `modern-web-guidance` first.

## Deviations from the spec

The operator may veto any line.

1. **Contrast test path.** Spec: `tests/unit/portal-contrast.unit.spec.ts`. Plan: `src/portal/theme/contrast.unit.test.ts`; Vitest and lint accept only `*.unit.test.ts` beside the subject.
2. **Toast host.** Spec: the top layer, or each modal's status line. Plan: `ToastLayer` in Arc `DialogContent`, `DrawerContent`, `BottomSheet` and any native `<dialog>`; no status line. The top layer fails: a popover above a modal `<dialog>` stays inert (F1's first test; measured again in Chrome 158). Not covered: `src/components/interior/lightbox.tsx` and the expanding card (`src/components/arc/card/card.tsx:326`), raw Radix with no toast. A primitive that fails F1 is added here with "status line in the phase that ships its first portal use".
3. **`PortalNavItem`** adds `external: boolean`: **Open dashboard** goes to `/admin`, its own root layout, a full load.
4. **Folded state.** Spec: client storage keyed by account id. Plan: cookie `portal-folded-<id>=1`, `SameSite=Lax`, `Secure` on https, so the server renders it with no layout shift.
5. **Token home and scope** (spec silent; its Contrast line names no scope). The failing contrast tokens and the ring are fixed where Arc defines them, `src/components/arc/foundation.css` (`--text-muted`, `--border-strong`, `--warning`, `--focus-outline`, and a `prefers-contrast: more` block), so every page gets them: the public site (operator answer, 2026-11-19), the space pages and, through the generated `arc-scope.css`, the admin dashboard's Arc copy (not its ring: the generator drops global focus rules). `src/portal/theme/tokens.css` (a folder the spec's table does not list) holds only what space pages alone use, under `:root:has([data-page='spaces'])`, the scope `styles.css:203` uses, so sheets portalled to `<body>` get it: the Arc radii, `--radius-inner`, the unread colours and `--portal-duration`.
6. **Radius.** Spec: 8, 12, 16, 24px, "no other values". Plan, as the operator answered on 2026-11-19: on space pages Arc's `--radius-control` (18px), `--radius-panel` (26px) and `--radius-surface` (34px) become 12, 16 and 24px, and `--radius-inner` (new, Arc has none) is 8px, all in `tokens.css`. Arc itself, the public site and the admin keep 18/26/34px. There is no `--portal-radius-*`: one rule in one place. `--radius-pill` stays for the round parts. Four fixed radii in `space.module.css` (6px twice, 5px, `1rem`) move to the nearest token (B1).
7. **`Schema` and the root layout's fetches** go into `SiteFrame`: they feed only the public chrome and JSON-LD.
8. **Not-found files.** `(site)/not-found.tsx` and `(portal)/spaces/not-found.tsx` render `NotFoundPage`; `[locale]/not-found.tsx` wraps it in `SiteFrame`.
9. **Home in `(home)`** (spec silent), so no loading boundary sits above the `(rooms)` check and a spaces-off space page answers 404, not a streamed 200 (A3; measured A5 dev, A6 production).
10. **Empty state.** `PortalEmptyState`: an `h2`, one sentence, an optional link action, a `next` line; a heading level or a button action comes with its first consumer. Arc's `EmptyState` hardcodes `<h3>` and a morph animation.
11. **`db:seed:empty`** drops and rebuilds `cilas_empty`, because `cilas_dev` is the production clone.
12. **Brand mark** (spec silent): the rail top and the phone header start with the CILAS mark, a link to `/`, the shell's way back to the public site.
13. **Phone toast offset** (spec silent): `ToastStack` reads `--toast-stack-offset` and writes `--toast-stack-height` on `<html>` for `scroll-padding-block-end`.
14. **axe "no violations".** `/spaces` and the shell: none from C8 on. Space pages, and `/spaces` until C8 deletes its rows: per rule id, no more nodes than `e2e/portal-axe-known.json` (route shape, role, locale, width), taken on `main` (C1); PR C lists each entry as a base problem.
15. **Unread counts.** The layout does not rerun on a soft navigation, so counts stay as the last full load read them, with one rule: a row whose space is open (`isCurrentSpace`, C8) shows 0. After a soft navigation away, that row shows its old count again until a full load. Phase 1c brings live counts.
16. **200% zoom** is a 720px viewport: Playwright has no page zoom.
17. **No-shortcut empty state on `/spaces`.** Not built: `shortcutsFor` always returns three rows or more (`(home)/page.tsx:44-52`).
18. **"A post link from Home opens the full page"** is proved by the bell row, a full load. Home has no `next/link` to a post in 1a; A4's dev-only probe pins what one would show.
19. **Matrix exemptions.** Two kinds. (a) No value of the dimension changes the behaviour:
    - A1 signed-out pages: role. A4 dev-only probe and its dialog-closes test: role, locale, width (the router's route choice has no such branch).
    - A5 "every space page and dialog route is not found": width (an HTTP status). A5 "a signed-out reader is sent to login": role, width (a server redirect).
    - C3 "the site header menu signs out" and C7 "one main": role (no role branch in the sign-out or the markup).
    - C9 "reduced motion: the fold does not animate": role, locale (one media rule; English only). C12 targets: role (one CSS rule per row type). C12 "Arabic mirrors the shell": role, and locale (it compares the two).

    (b) The surface or state does not exist for that value, an extension of the spec's rule:
    - C8 "every nav item and account row opens a page" and the account-menu axe state: 390 (the menu hides under 700px; C10 walks the phone rows). The More-sheet axe state and every C10 test: 1440 (no More sheet at 700px or wider).
    - C9 "the folded state belongs to the account": 390 (no sidebar); roles run as three pairs.
    - C11 empty state: admin (an admin reads every space, `spaces.ts:292`).

20. **The More sheet lists the space rows** (spec: "the other nav items"): under 700px the spaces list has no other place.
21. **`/spaces` empty state** (C11) is replaced by phase 1c's Home. It ships because every phase ships its empty states, and it is `PortalEmptyState`'s one 1a consumer.
22. **`SuccessCheck` ships with no consumer** (C5): the spec puts it in 1a; later phases use it.
23. **Account menu and bell panel load eagerly.** Their triggers are first-render content, and `UserMenu` and `SiteNotifications` render trigger and panel in one component that the public header already loads eagerly; splitting them is an Arc change. C13 writes both chunks' gzip size. Only the More sheet is lazy.
24. **One 1200px frame for every portal page, Home included, held by the shell's `main` (C8), not by A3.** Spec: the frame on space pages only, Home unbounded. Operator answer, 2026-11-19: Home gets it too. Reason: at 1440px with the sidebar the cap rarely binds (inferred: the main is the viewport minus the rail), but on wider screens Home would stretch; one rule in one place beats a cap per page. A3 keeps today's frame in `(portal)/spaces/layout.tsx`: under `SiteFrame` nothing else bounds Home (`.page` has no max-width, `space.module.css:8-13`; `SiteFrame`'s `main` is 90rem), so moving it in A3 would widen Home with spaces on. C8 moves it: the panel is full width and an inner `mx-auto w-full max-w-300` holds the page. `(rooms)/layout.tsx` stays `<>{children}{dialog}</>`.
25. **Only if A4 measures it: a post link at 390px opens the full page.** Ends-when clause 5 then holds at 1440 only; A4 states it in its commit and PR A in its body.

## Ends when

The spec's Phase 1a "Ends when" line, by clause. `portal-shell` is `e2e/portal-shell.e2e.test.ts`, `e2e/site-frame.e2e.test.ts`, and the unit, dom and browser tests under `src/portal/` and `src/components/arc/toast-stack/`; `portal-spaces-off` is `e2e/portal-spaces-off.e2e.test.ts`. CI runs neither, so both are local gates.

1. `portal-shell` passes: B1, F1, F2, C1 to C12.
2. `portal-spaces-off` passes: A3 to A6, C12.
3. Every nav item and account row opens a page: C8 (desktop), C10 (phone).
4. A post link from Home opens the full page: A4's bell row (Deviation 18).
5. Inside a space a post link opens the dialog, and an open dialog closes on a navigation to another space page: A4 (at 1440 only if Deviation 25 applies).
6. Five pages keep header, main, footer: A1, A2, C3.
7. Contrast test: B1.
8. `announce()` reads a repeat twice: C4.
9. A toast in an open modal sheet is above it, in the tree and reachable: F1, C10.
10. `SuccessCheck` under reduced motion shows text only: C5.
11. The folded state survives a reload for the same account only: C9.
12. At 390px with a toast, a focused row is not covered: F2, C10.
13. Spaces off, `/spaces` loads with no space: A5, C12.
14. `pnpm db:seed:empty`, three accounts sign in: D1 to D3.

The spec's Tests rules: landmarks, skip link, live region (C8, C12); nav per role and equal folded names (C2, C9, C12); axe (C1, C12); keyboard walk and targets (C12); 320px and 200% reflow (C9, C10, C12); RTL mirror (C12); reduced motion (C5, C9, C10); spaces off removes the list (C12).

## Review Focus

The five inputs the spec implies and no clause tests, most likely first.

1. **A `next/link` to a post from outside `(rooms)`** (phase 1c's Home). The Next source says it is intercepted with no `(rooms)` children state, so not found may show under the dialog. A4's probe pins it.
2. **Spaces switched off while a reader is on a space page.** The `(rooms)` layout does not rerun on a soft navigation; the space reads must refuse. `spaceLanding` returns null with spaces off for every role, admin included (`src/lib/spaces-data.ts:967-968`), so the read refuses. A5 (post link, Back), C12 (sidebar link).
3. **A signed-out reader on any `/spaces` URL** goes to `/{locale}/login?next=…`. A5.
4. **Worst-case space rows:** a 60-character Arabic name, 0 and 12 unread (`9+`), 40 spaces, 120 unread; no sideways scroll at 320 or 720px, folded or not; the count reads "more than 9". Fixture in C1, `sidebar.browser.test.tsx` in C9, `more-sheet.browser.test.tsx` in C10, e2e reflow in C12.
5. **A toast already showing when a modal opens, and across a route change.** It moves in with one region and its text added once (F1) and survives **Profile and settings** opening `/settings` (C10).

## Decision log (structural)

Each problem, then its fix.

- P1. The root layout holds the public chrome (deadlines bar, header, main, footer, JSON-LD) and the providers. Fix: `SiteFrame` owns the chrome and its fetches; the root layout keeps `<html>`, `<body>`, providers, `SiteToasts`, `PushRegistrar`.
- P2. The check in `spaces/layout.tsx:22` also refuses `/spaces`; also `spaces/loading.tsx` above every space page makes a not-found stream with 200. Fix: `(rooms)/layout.tsx` owns the check; Home and its `loading.tsx` live in `(home)`.
- P3. Inside `(rooms)`, `@dialog/page.tsx` would claim Home's URL; an unmatched URL keeps an open dialog. Fix: `@dialog/[...catchAll]/page.tsx` returns `null`; the four `return null` pages go.
- P4. The site header holds the sign-out sequence (`site-header.tsx:238-245`) and the menu user memo (`:55-69`) inline. Fix: `signOut()` and `menuUser()`, called by both menus; phase 2 adds the flush inside `signOut`.
- P5. `currentReader()` is not cached (`src/lib/reader.ts:14-18`). Fix: React `cache` on it and `mySpaces`; layout and page share the cached user.
- P6. Today's tokens fail WCAG 2.2 AA in light mode on every page; the ring colour is an inline fallback (`foundation.css:520-521`). Fix: the values in `foundation.css` (one source; `arc-scope.css` regenerated), the space pages' own tokens in `tokens.css`, and a test that reads the CSS in both page scopes.
- P7. A toast is inert or covered while a modal is open; three Arc primitives serve 26 files. Fix: `ToastLayer` in each primitive, reading the context directly (no provider, no layer).
- P8. The seed guard is inline (`seed/index.ts:22-27`); scratch and empty databases migrate separately. Fix: `requireLocalSeedDatabase()` and `migrateAll()`, shared.
- P9. A space page stamps a visit (`space-page.tsx:411`), so opening a space changes later counts. Fix: every count test calls `world.resetVisits()` first.
- P10. Space pages render their own `<main>` (`space-page.tsx:534`, `post-page.tsx:73`). Fix: the shell owns the one `main`.
- P11. With no base URL, Playwright targets port 3000 (production) and builds there. Fix: `playwright.config.ts` throws on port 3000 or a non-local host, and starts no server outside CI.
- P12. A course space's intro post gates members and counts as unread (`Spaces.ts:181-187`). Fix: `courseRoom()` clears it in the one place the fixture makes a course space.
- P13. `src/env.ts` loads `.env` on every import, and the main checkout's env files carry production values. Fix: a worktree generates local-only env files, and a hash check proves it.
- P14. A maintained toast library could replace the Arc stack. Fix: keep it and add `ToastLayer`. Sonner 2.0.8, measured and rejected: root toaster inert under Radix and `showModal()`; a per-modal toaster needs `toasterId` routing and a re-raise; loses pause on Tab focus, Esc dismiss and per-kind durations.

**Operator answers, 2026-11-19** (the four product questions that were open):

- Q1. Radius on space pages: yes. Fix: `tokens.css` sets Arc's radius tokens to the spec's 12, 16 and 24px under the space-page scope, plus `--radius-inner` 8px; `--portal-radius-*` is gone (Deviation 6).
- Q2. Contrast on the public site: yes. Fix: the failing tokens change in `foundation.css`, at global scope; the table runs in both page scopes (Deviation 5).
- Q3. PR F's gate: no operator review hold (PR table).
- Q4. Home's width: one 1200px frame for every portal page, held by the shell's `main` (Deviation 24).

**Libraries used** (what each replaces): `colorjs.io` 0.7.1 (dev, B1): colour parsing, mix, clip, WCAG ratio. `postcss`: a CSS reader. `@axe-core/playwright` (C1): hand-written WCAG checks. `dotenv`: env parsing in the leak check. Considered, not used: `@react-aria/live-announcer` (C4: it makes its own regions, the spec wants the shell's one); the Vitest `browser` project (Chromium) as B1's resolver through `getComputedStyle(el).color` and `emulateMedia` (no row depends on what the hand-written resolver skips; the fallback if the Chrome pin disagrees). Radix/Arc: focus trap and modality. `motion`: animation timing.

Done means: a new portal page, space page or Arc modal gets the shell, the check or the toast layer with no code. `src/portal/**` imports from `src/lib/**`, `src/components/**`, `src/i18n/**`; none of those imports `src/portal/**` (C13 checks it with `rg`).

## Open questions (product calls)

None. The operator answered the four on 2026-11-19; the answers are in the decision log.

---

## PR A. Route groups (`portal/phase-1a-frame`)

From `main`. With spaces on no screen changes, so its reviews are code-review and security-review. With spaces off `/spaces` now loads (was 404) with its shortcut list only; C13 reviews that state in the shell. Paths below are under `src/app/(frontend)/`.

### Task A1: Env, install, the port guard, and the smoke e2e on the base

**Skills:** tdd.

**Files:** Modify `playwright.config.ts`, `playwright.production.config.ts`. Create `e2e/site-frame.e2e.test.ts`.

**Interfaces:**

- Consumes: `createTracker`, `uniqEmail` (`testing/payload.fixture.ts`); `consentAccept` (`src/lib/spaces-write.ts`); `login` (`testing/login.test-utils.ts`); the payload setup of `e2e/session-drawer.e2e.test.ts`.
- Produces: `playwright.config.ts` throws `Refusing to run e2e on port 3000 (production) outside CI. Set PLAYWRIGHT_BASE_URL=http://localhost:3100.` when `new URL(baseURL).port === '3000'`, and `Refusing to run e2e against <host>: PLAYWRIGHT_BASE_URL must be a local URL.` when `!isLocalUrl(baseURL)` (`testing/local-env.ts:6`); both only when `CI` is unset. `webServer` is `undefined` when `CI` is unset, so a local run never builds or starts a server. `playwright.production.config.ts` starts with `if (!process.env.CI) throw new Error('playwright.production.config.ts runs in CI only: port 3000 is production here.')` (`.next/standalone` holds a copy of `.env`; CI: `security.yml:174`). The `site-frame` spec that A2 and C3 keep green.

- [ ] **Step 1:** Env files, install, leak check, the database check (Global Constraints, Database; no compose from the worktree) and dev server **[heavy]**. Expected: `curl -fs -o /dev/null -w '%{http_code}' http://localhost:3100/en` prints `200`.
- [ ] **Step 2: Port guard.** `RUN pnpm exec playwright test --list` exits non-zero with the port message; with `PLAYWRIGHT_BASE_URL=http://example.com:3100` with the host message; with `PLAYWRIGHT_BASE_URL=http://localhost:3100` it lists the specs. With `CI` unset, `RUN pnpm exec tsx -e "import('./playwright.config.ts').then((m) => console.log(m.default.webServer))"` (with `PLAYWRIGHT_BASE_URL=http://localhost:3100`) prints `undefined`. With `CI` unset, `pnpm test:production --list` exits non-zero with the CI-only message.
- [ ] **Step 3: Measure the signed-out base** with `curl`, per locale: status, `script[type="application/ld+json"]` count, whether the deadlines bar renders (root selector from `src/components/site-deadlines.tsx`), `html[lang]`, `html[dir]`, for `/{locale}`, an article, `/{locale}/login`, `/{locale}/welcome/e2e-token`, `/{locale}/e2e-no-such-page`.
- [ ] **Step 4: Write the spec.** Per page, locale and width, `<page> keeps the site header, main and footer ($locale $width)`: the status; one visible `header.site-header`; one `main.max-w-page`; `contentinfo` visible; deadlines bar and ld+json counts as measured; `html` `lang` and `dir`. `firstArticlePath(page, locale)` (same file) returns the first `main` link under `/{locale}/articles/`. Signed-in rows (`/{locale}` and the article; the proxy rewrites them to `/signed-in/*`, `src/proxy.ts:96-99`) run per role with tracked `admin`, `fellow` (with a person) and `member` accounts, `consentAccept`, made in `beforeAll`; run them once printing their counts and write those into the table.
- [ ] **Step 5: Run on the base** **[heavy]** (`E2E e2e/site-frame.e2e.test.ts`). Expected: all pass; a failure means the base differs from this plan: stop and report. Commit.

### Task A2: Move the public pages into `(site)` and spaces into `(portal)`

**Skills:** tdd.

**Files:**

- Create: `src/components/site-frame.tsx`, `src/components/not-found-page.tsx`, `[locale]/(site)/layout.tsx`, `[locale]/(site)/not-found.tsx`, `[locale]/(portal)/spaces/not-found.tsx`.
- `git mv` into `(site)/`: every entry of `[locale]/` except `layout.tsx`, `not-found.tsx`, `opengraph-image.tsx`, `site-card.ts`, `spaces`. `git mv` `spaces/` to `(portal)/spaces/`.
- Modify: `[locale]/layout.tsx`, `[locale]/not-found.tsx`, `(portal)/spaces/layout.tsx`, the imports in Step 3.

**Interfaces:**

- Consumes: A1's `site-frame` spec; today's `[locale]/layout.tsx`.
- Produces: `SiteFrame({ children }: { children: React.ReactNode }): Promise<React.JSX.Element>` (server): the four fetches (`getSocialLinks`, `getCurrentPlace`, `newsletterList`, `getPeoplePages`), `Schema`, `SiteDeadlines`, `CILASSiteHeader`, `<main className="mx-auto min-h-[60vh] max-w-page">`, the footer. `NotFoundPage(): Promise<React.JSX.Element>`, today's not-found body.

- [ ] **Step 1: Move.** Expected: `[locale]/` holds `(portal)`, `(site)`, `layout.tsx`, `not-found.tsx`, `opengraph-image.tsx`, `site-card.ts`.
- [ ] **Step 2: Split the root layout.** It keeps `<html>` and its attributes, `<body>`, `ThemeProvider`, `NextIntlClientProvider`, `DirectionProvider`, `SiteArcProvider`, `SiteToasts`, `{pushConfig() && <PushRegistrar />}`. `(site)/layout.tsx` renders `<SiteFrame>{children}</SiteFrame>`. `(portal)/spaces/layout.tsx` keeps metadata, login redirect and the spaces-off check, and renders `<SiteFrame>` around today's `max-w-300` `data-page="spaces"` div with `{children}{dialog}`. The two group not-found files re-export `NotFoundPage`; `[locale]/not-found.tsx` renders `<SiteFrame><NotFoundPage /></SiteFrame>`.
- [ ] **Step 3: Fix imports.** `(site)/(home)/opengraph-image.tsx`: `'../site-card'` to `'../../site-card'`. Add `(site)/` to the `@/app/(frontend)/[locale]/…` paths in `(site)/articles/[slug]/page.tsx`, `(site)/signed-in/articles/[slug]/page.tsx`, `(site)/signed-in/people/[slug]/page.tsx`, `(site)/study/[slug]/course-view-time.browser.test.tsx` (its relative `../../../../../../` imports get one more `../`), `src/api/security-preview.int.test.ts`, `src/lib/side-card-css.unit.test.ts:12`, the comment in `(site)/profile/page.tsx`, and `testing/README.md:35`. Check: `rg -nP '\(frontend\)/\[locale\]/(?!\(site\)|\(portal\))[a-z\[(]' --glob '!docs/**' --glob '!scripts/commit-hooks.test.mjs'` prints nothing.
- [ ] **Step 4:** `pnpm exec tsgo --noEmit && RUN pnpm exec vitest run --project node src/lib/side-card-css.unit.test.ts`. Expected: exit 0.
- [ ] **Step 5** **[heavy]**: `rm -rf .next`, restart the dev server, `E2E e2e/site-frame.e2e.test.ts`. Expected: all pass. Commit.

### Task A3: `(rooms)`, `(home)`, the one spaces-off check, and the `@dialog` catch-all

**Skills:** tdd.

**Files:**

- `git mv` `(portal)/spaces/[kind]`, `community`, `@dialog` into `(portal)/spaces/(rooms)/`; `git mv` `(portal)/spaces/page.tsx` and `loading.tsx` into `(portal)/spaces/(home)/`, fixing their relative imports.
- Create `(rooms)/layout.tsx`, `(rooms)/@dialog/[...catchAll]/page.tsx`.
- Delete the four `return null` pages: `@dialog/page.tsx`, `@dialog/community/page.tsx`, `@dialog/community/[spaceId]/page.tsx`, `@dialog/[kind]/[slug]/page.tsx`. Keep `@dialog/default.tsx`, `layout.tsx`, `loading.tsx` and the `(.)` intercepts.
- Modify `(portal)/spaces/layout.tsx` (drops `dialog` and the check).

**Interfaces:**

- Consumes: `mode`, `spacesSettings` (`src/lib/spaces.ts`); A2's spaces layout.
- Produces: `RoomsLayout({ children, dialog })` calls `notFound()` when `mode(await spacesSettings(payload)) === 'off'`, else renders `<>{children}{dialog}</>`. No other file returns not found for the switch. `CatchAll()` returns `null`. The tree: `[locale]/layout.tsx` → `(portal)/spaces/layout.tsx` (login redirect; `SiteFrame` and today's `max-w-300` `data-page="spaces"` div, Deviation 24) → `(home)/` (`page.tsx`, `loading.tsx`) and `(rooms)/layout.tsx` (check) → `[kind]`, `community`, `@dialog`.

- [ ] **Step 1: Move, delete, write.** `@dialog/page.tsx` inside `(rooms)` would claim `/[locale]/spaces`, Home's URL; the catch-all covers the other three. Check: `find 'src/app/(frontend)/[locale]/(portal)/spaces' -maxdepth 2 -name loading.tsx` prints only `…/(home)/loading.tsx`.
- [ ] **Step 2: Dev boot** **[heavy]**: `rm -rf .next`, start the dev server; signed out, `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n'` of `/en/spaces` and `/en/spaces/community`. Expected: each a 307 to `/en/login?next=…`; no conflicting-route or parallel-page error in the log. Stop the server, `pnpm exec tsgo --noEmit`, commit.

### Task A4: The portal fixture, dialog routes, and the dev-only probe

**Skills:** tdd.

**Files:** Create `testing/portal.fixture.ts`, `testing/portal.fixture.int.test.ts`, `e2e/portal-spaces-off.e2e.test.ts`. Modify `testing/login.test-utils.ts`.

**Interfaces:**

- Consumes: `createTracker`, `uniq`, `uniqEmail`, `lockSpacesMode` (`testing/payload.fixture.ts`); `consentAccept`; `mySpaces` (`src/lib/spaces-data.ts`).
- Produces (`testing/portal.fixture.ts`):
  - `MESSAGES = { en, ar }` from `messages/{en,ar}.json` (not `messagesOf`, which imports Testing Library).
  - `type PortalRole = 'admin' | 'fellow' | 'student'`; `ROLES`; `LOCALES = ['en', 'ar'] as const`, `type Locale`; `WIDTHS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const`; `localePath(path: string, locale: Locale): string` (swaps the leading `/en/`).
  - `type PortalAccount = { id: number; email: string; password: string; person: number | null }`; `type RoomFixture = { space: number; path: string; postPath: string; post: number; label: Record<Locale, string> }` (English paths; `label` is the row label `spaceLabel` gives in each locale).
  - `type PortalWorld = { accounts: Record<PortalRole, PortalAccount>; poster: PortalAccount; course: RoomFixture; community: RoomFixture }` (C1 extends it).
  - `portalWorld(payload: Payload, track: ReturnType<typeof createTracker>['track']): Promise<PortalWorld>`: a place, a cycle, a published course (the fellow's person in `fellows`; student and `poster` enrolled `accepted`) and its space, a community space named `uniq('Portal community')` (`cilas_dev` holds other communities); accounts admin `['admin']`, fellow `['fellow']` with a person, student and `poster` `['member']`. `poster` writes one post per room. `consentAccept` for each; every row through `track`. A course space's intro post counts as unread and gates a member (P12, `space-rules.ts:64-69`): `courseRoom(payload: Payload, track: ReturnType<typeof createTracker>['track'], course: number): Promise<number>` (the space id), the one place that finds a course's space, reads its `introduction_post` id, sets it to null (as `session-drawer.e2e.test.ts:104-109`), then deletes that post (new). C1's `otherCourse` goes through it too. Course and session dates are in 2034 (as `session-drawer.e2e.test.ts`), so no space is archived.
  - `holdSpacesMode(payload: Payload): Promise<{ set: (mode: 'off' | 'trial' | 'on', options?: { trialCommunity: boolean }) => Promise<void>; release: () => Promise<void> }>`: takes `lockSpacesMode()` once and remembers `spaces_mode` and `spaces_trial_community`; `set` writes them on `site-settings` (`overrideAccess: true`); `release` restores both and the lock. Never twice in one file: a second call waits forever.
  - `notifyOf(payload: Payload, account: PortalAccount, link: string): Promise<void>`: a `notifications` row `{ recipient: account.id, kind: 'comment', title: 'E2E comment', link }` (`title` is required, `Notifications.ts:69`), `overrideAccess: true`; the tracker deletes it with its recipient (`payload.fixture.ts:50`).
- Produces (`login.test-utils.ts`): `login({ page, user, next = '/admin' })` opens `/en/login?next=<encoded next>` and waits for `next`. Existing callers are unchanged.

- [ ] **Step 1: Fixture int test** (spaces held `on`): "every role reads both rooms" (`mySpaces(payload, user, 'en')` per role holds `course` and `community`, each with `unread` exactly 1; the student reads `course.post` through `payload.findByID` with `user` and `overrideAccess: false`). `RUN pnpm test:int testing/portal.fixture.int.test.ts` **[heavy]**: FAIL, then PASS after the fixture.
- [ ] **Step 2: Dialog e2e** (spaces held `on`, serial). Paths through `localePath`.
  - "a post link inside a space opens the dialog": on `course.path`, click `a[href="${postPath}"]`; URL is `postPath`; one `dialog`. Run the 390 rows first and record what opens (predicted: the dialog; `post-route-dialog.tsx` uses Arc `Dialog` at every width); assert the recorded result and state it in the commit. If 390 opens the full page, the next three tests assert that at 390, and Deviation 25 is added.
  - "Esc closes the dialog and leaves the space page": Esc; URL `course.path`; no `dialog`; the space `h1` visible.
  - "Back closes the dialog; Forward opens it again": `goBack()` gives `course.path`, no dialog; `goForward()` gives `postPath` with it.
  - "a hard load of a space page shows no dialog" (the catch-all renders the slot).
  - "a bell row on Home opens the full post page": `notifyOf(payload, account, localePath(course.postPath, locale))`; on `/{locale}/spaces` open the bell, click the row; URL `postPath`, no `dialog`, `article` visible.
- [ ] **Step 3: Dev-only probe** (Deviation 19). `describe('dev server only')`, first test: assert `typeof window.nd === 'object'` first; as the fellow on `/en/spaces`, `window.nd.router.push(course.postPath)`. Record: (a) the full post page, (b) the dialog over an empty or not-found page, (c) the dialog over Home; rename the test to the result and assert it. A second test, "an open dialog closes on a navigation to another space page": on `course.path` open the post dialog, then `window.nd.router.push(community.path)`; URL `community.path`, no `dialog`, the community `h1`. The PR states the 1c rule: on (b) a post link outside `(rooms)` is a plain `<a>`; on (a) or (c) 1c may use `next/link`.
- [ ] **Step 4: Run** **[heavy]** `E2E e2e/portal-spaces-off.e2e.test.ts`. Expected: all pass. Commit.

### Task A5: `/spaces` with spaces off, its e2e, and the guards that moved

**Skills:** tdd, modern-web-guidance.

**Files:** Modify `e2e/portal-spaces-off.e2e.test.ts`, `(portal)/spaces/(home)/page.tsx` (lines 89-120 on `main`).

**Interfaces:**

- Consumes: `mode`, `spacesSettings` (`src/lib/spaces.ts`); `portalWorld`, `holdSpacesMode`, `login`, `localePath`, `ROLES`, `LOCALES`, `WIDTHS` (A4).
- Produces: `describe('spaces off')`, whose tests A6 runs in production mode.

- [ ] **Step 1: Tests**, in `describe('spaces off')` (`off` in `beforeAll`, `on` in `afterAll`), per role, locale and width unless Deviation 19 says otherwise:
  - "spaces off: /spaces loads with no space": status 200; one `h1`; `section[aria-labelledby="spaces-shortcuts"]` visible; no other `section[aria-labelledby^="spaces-"]`; no `a[href*="/spaces/course/"]`; no `Spaces.empty` text.
  - "spaces off: every space page and dialog route is not found" (role, locale): `page.request.get`, which carries the role's `storageState` cookie, of `course.path`, `course.postPath`, `community.path`, `community.postPath`, `/{locale}/spaces/community`: each 404, admin too (the check runs before any read).
  - "a signed-out reader is sent to login from /spaces and from a space page" (locale): both reach `/\/{locale}\/login\?next=/`.
  - "a post opened by a soft navigation after spaces go off": `set('on')`, on `course.path`; `set('off')`; click the post link. Student and fellow: the `NotFound.title` heading shows (record whether in the dialog or the page). Admin too: every role, admin included, gets the same not-found heading, because `spaceLanding` returns null with spaces off for every role (`spaces-data.ts:967-968`). `set('off')` in `finally`.
  - "an open dialog closes on Back after spaces go off": `set('on')`, open `community`'s post dialog from `community.path`; `set('off')`; `goBack()`; URL `community.path`, no `dialog`.
- [ ] **Step 2: Run** **[heavy]** on the dev server. Expected: only "/spaces loads with no space" fails, on the `Spaces.empty` text: `mySpaces` returns empty lists when off (`spaces-data.ts:109`), so A3 alone shows today's empty state.
- [ ] **Step 3:** The page reads `const off = mode(await spacesSettings(payload)) === 'off'`; when `off` it skips `mySpaces` and renders only the shortcut list (Deviation 17).
- [ ] **Step 4: Run** **[heavy]**. Expected: all pass; the commit records the dev status of the not-found test (404). Commit.

### Task A6: Production-mode check, review, full suite, open PR A

**Skills:** code-review, then security-review.

**Interfaces:** Consumes A1 to A5 and A5's `describe('spaces off')`. Produces PR A.

- [ ] **Step 1** **[heavy]**, one at a time on the dev server: `E2E` of `site-frame`, `portal-spaces-off`, `session-drawer`, `space-calendar-edit` (they open space pages): all pass. `node scripts/check-seo.mjs http://localhost:3100` exits 0. Stop the dev server.
- [ ] **Step 2: Production mode** **[heavy]**. Build and start (Global Constraints); this is also the branch's final `next build`. `E2E e2e/portal-spaces-off.e2e.test.ts --grep 'every space page and dialog route is not found'`, the one measurement (soft-navigation tests can differ by mode for other reasons, such as prefetch). Expected: pass, so the build answers 404. Write the dev and production codes in the PR; codes that differ by mode: stop and report. Stop the server, `rm -rf .next`.
- [ ] **Step 3: code-review** against `main`, with the spec's Frame section as the issue.
- [ ] **Step 4: security-review.** Write this check in the PR: login redirect for every `/spaces` URL moves to `(portal)/spaces/layout.tsx`, same code; `/spaces`' own redirect (`(home)/page.tsx:91-92`) unchanged; spaces-off refusal moves from every spaces URL to `(rooms)` (space pages and dialog routes), and `/spaces` loads (spec); on a soft navigation inside `(rooms)` the space reads refuse for every role, admin included: `spaceLanding` returns null with spaces off (`spaces-data.ts:967-968`, A5); `noindex` unchanged; `(site)` pages keep their own guards; `Schema` renders wherever `SiteFrame` does: `(site)`, not-found pages and, until C8, `/spaces` pages. One base line: `src/payload.config.ts` sets no `telemetry` (Payload's default is on, `payload/dist/config/defaults.js:76`), so dev servers, e2e and the review world post anonymous telemetry; no production value; Vitest mocks it.
- [ ] **Step 5:** Fix; a fix that touches `app/` or a layout reruns Step 2. Full suite, per-PR step 5, open `refactor(frame): (site), (portal) and (rooms) route groups (portal phase 1a, PR A)`. Blast Radius names A5's change to `/spaces` with spaces off and the port guards (local e2e on port 3000 now throws on every machine, a local run no longer starts a server, and `pnpm test:production` runs in CI only).

## PR B. Portal tokens (`portal/phase-1a-tokens`)

From `main`. Changes the colours of every page (the public site, the space pages, and the admin dashboard's Arc copy) and the radii of the space pages: operator review before merge.

Surfaces that change (the token users are measured by a `var()` grep; what shows on which page is inferred):

- **Public, `--text-muted`:** the home hero and footer (`arc/blocks`), articles and footnotes, person and people pages, the course page, forms (`payload-form.css`), the image gallery and lightbox, rich fields, and the `styles.css` rules for captions and meta lines.
- **Public, `--border-strong`:** every Arc input, textarea, select, tabs, tag input and stepper (so `/login`), the header's account menu, toasts, and the calendar's neutral tone (`--calendar-neutral`).
- **Public, `--warning`:** warning badges, password strength, gauges, and the footer.
- **Every page, the ring:** an opaque `--accent-strong` ring instead of a 72% one.
- **Admin dashboard:** the same muted text, strong borders and warnings, through the regenerated `arc-scope.css` (no ring).
- **Space pages, radius:** controls (buttons, inputs, selects, tabs, tooltips) 18 to 12px; cards, popovers, the account menu, toasts and the space page's panels 26 to 16px; dialogs, sheets, the photo grid and the space page's large blocks 34 to 24px.

### Task B1: The contrast table and the portal tokens

**Skills:** tdd, better-colors, better-accessibility, modern-web-guidance.

**Files:** Create `src/portal/theme/contrast.ts`, `contrast.unit.test.ts`, `tokens.css`. Modify `package.json`, `pnpm-lock.yaml`, `src/components/arc/foundation.css`, `src/components/admin/dashboard/arc-scope.css` (generated: `node scripts/build-arc-scope.mjs`), `src/components/space/space.module.css`, `src/app/(frontend)/styles.css` (one `@import '../../portal/theme/tokens.css';` after the existing `@import` lines).

**Interfaces:**

- Consumes: `postcss` (installed; reads the declarations); `colorjs.io` (`import Color from 'colorjs.io'`; parse, mix, clip, ratio); `src/components/arc/foundation.css` (`--duration-fast: 160ms`, `:162`), `styles.css`, `src/components/arc/badge/badge.module.css`.
- Produces (`contrast.ts`, pure; only the test imports it): `type Context = { theme: 'light' | 'dark'; contrast: 'normal' | 'more'; page: 'site' | 'spaces' }`; `tokenResolver(sheets: string[], context: Context): (token: string) => Color` (colorjs.io `Color`): `postcss.parse` reads `:root` (0,1,0), `:root[data-theme='dark']` (0,2,0), `:root:has([data-page='spaces'])` (0,2,0), `:root[data-theme='dark']:has([data-page='spaces'])` (0,3,0), and `@media (prefers-contrast: more)` when `more`; dark selectors only in dark; the two `:has` selectors only when `page` is `'spaces'`; higher specificity wins, then the later declaration. Hand-written: that cascade, `var(--x[, fallback])`, and `color-mix(in oklab, X p%, Y)` as `Color.mix(X, Y, 1 - p / 100, { space: 'oklab', premultiplied: true })`. Other values: `new Color(value)`, which parses unitless `oklch(1 0 0)` (spaces `--background`) and `/ 10%` alpha (dark `--border`). It throws `Unresolved token --x`. `clip(c: Color): Color` is `c.to('srgb').toGamut({ method: 'clip' })`, never the default `toGamut()`: Chrome clips (CSS mapping gives dark `--danger` 7.24, Chrome 6.64). `over(fg: Color, bg: Color): Color` (3 lines): clip both, then `const a = f.alpha ?? 1; const mix = (i: number) => (f.coords[i] ?? 0) * a + (b.coords[i] ?? 0) * (1 - a)` and `new Color('srgb', [mix(0), mix(1), mix(2)])` (colorjs.io 0.7.1 types `coords` as `[number | null, …]` and `alpha` as `number | null` (`types/src/color.d.ts:51,153`); `.map` would give `number[]`, not the tuple); throws if `(bg.alpha ?? 1) < 1`. `ratio(fg: Color, bg: Color): number` is `over(fg, bg).contrast(clip(bg), 'WCAG21')`: composite before the ratio, as `contrast()` ignores alpha (`--accent-subtle` 1.35, not 13.7).
- Produces (`foundation.css`, global): `--text-muted`, `--border-strong`, `--warning`, `--focus-outline` (read by its own rule at `:520-521`) and a `prefers-contrast: more` block. Produces (`tokens.css`, space-page scope): `--radius-inner: 8px`, `--radius-control: 12px`, `--radius-panel: 16px`, `--radius-surface: 24px`; `--portal-unread`, `--portal-unread-foreground`; `--portal-duration: var(--duration-fast)`, `0ms` under `prefers-reduced-motion: reduce`.

- [ ] **Step 0: Install** **[heavy]**: `nice -n 19 ionice -c3 pnpm add -D -E colorjs.io@0.7.1`. Expected: `package.json` `devDependencies` has `"colorjs.io": "0.7.1"`.
- [ ] **Step 1: Table test.** Sheets in page order: `foundation.css`, `tokens.css`, `styles.css`, plus `badge.module.css`. Per context (8: theme, contrast, page): `--foreground`, `--text-secondary`, `--text-muted` on `--background`, `--surface`, `--surface-raised`, `--surface-muted` at 4.5; `--border-strong`, `--focus-outline`, `--danger` on the same at 3; `--portal-unread-foreground` on `--portal-unread` at 4.5 (page `spaces` only); each badge tone (`neutral`, `success`, `info`, `warning`, `danger`), `--badge-foreground` over `--badge-background` over `--surface` at 4.5 (`badgeToken(token, tone, property)` in the test file). Plus "space pages set the spec radii" (a `postcss` read of `tokens.css`, no resolver: `--radius-inner`, `-control`, `-panel`, `-surface` are 8px, 12px, 16px, 24px); "the table lists every badge tone that badge.module.css defines"; "`new Color` parses `oklch(1 0 0)` and `oklch(100% 0 0 / 10%)`"; and the Chrome pin "dark normal: `--danger` on `--surface` is 6.6:1 within 0.1" (Chrome: 6.635; the default mapping fails it). Name: `'$context.theme $context.contrast: $fg on $bg is at least $min:1'`.
- [ ] **Step 2: Run on the unchanged base** (`RUN pnpm exec vitest run --project node src/portal/theme/contrast.unit.test.ts`, empty `tokens.css`). Expected failures (Chrome 158, within 0.1), in both page scopes, light: `--text-muted` (4.116:1 on `--background`; 3.876:1 on `--surface-muted`), `badge.warning` (3.807:1), `--border-strong` (1.744:1); dark: `--border-strong` (2.014:1 on `--background`); all four contexts: `--focus-outline` unresolved; spaces contexts: `--portal-unread*` unresolved; the radius row fails. Any other result: find out why first.
- [ ] **Step 3: Tokens** (starting values; the table decides). `foundation.css`, light `:root`: `--text-muted: oklch(52% 0 0)` (was `var(--neutral-7)`; `--neutral-7` stays), `--border-strong: oklch(62% 0 0)`, `--warning: oklch(50% 0.12 75)`, `--focus-outline: var(--accent-strong)` (same element as the spaces accents at `styles.css:203-219`, so it resolves to them there); dark `:root[data-theme='dark']`: `--border-strong: oklch(56% 0 0)` (`--text-muted` 64% and `--warning` already pass); `@media (prefers-contrast: more)`, both selectors: `--text-muted` and `--border-strong` are `var(--text-secondary)`. Then `node scripts/build-arc-scope.mjs`; its diff is those token lines only. `tokens.css`, `:root:has([data-page='spaces'])`: the four radii, `--portal-unread: oklch(55% 0.2 27)`, `--portal-unread-foreground: oklch(100% 0 0)`, `--portal-duration`; a dark row for each colour whose dark value differs (the light rule ties foundation's dark rule and loads later). In `space.module.css` the fixed radii (6px twice, 5px, `1rem`) become `--radius-inner` (6px, 5px) and `--radius-panel` (`1rem`); B2 judges the look.
- [ ] **Step 4: Run.** Expected: every row passes. A failing row: change the value with better-colors, never the limit. Commit the CSS and the regenerated `arc-scope.css` together.

### Task B2: Review, fix, full suite, open PR B

**Skills:** ux-auditor, better-interface, then break-ui; code-review, then security-review.

**Interfaces:** Consumes the branch of B1. Produces PR B.

- [ ] **Step 1: Live check** **[heavy]**. Dev server and the review world, profile `main` (Global Constraints); `/en/spaces` as its member: a muted line's `getComputedStyle` colour is B1's light value; Tab draws an opaque ring; the same in dark and with `prefers-contrast: more`; a button is 12px, a card 16px, a dialog 24px. Signed out on `/en`: the muted colour is B1's light value too (not today's `oklch(59% 0 0)`), the ring is opaque, and an Arc control keeps its 18px radius. Paste the values in the PR.
- [ ] **Step 2: Screen reviews** **[heavy]**, the review world still running, on `/spaces`, its course space and its community space, and on the public pages signed out: home, an article (the first `/en/articles/` link on `/en`; the world adds none), the world's course page and `/en/login`; plus `/admin` once per theme (its Arc copy changes). Light, dark, more contrast; English and Arabic; 1440 and 390. break-ui: long Arabic names and every badge tone on space pages; a form with an error and a disabled field on `/en/login`. Then `echo q`; the script prints its restored mode.
- [ ] **Step 3:** code-review, then security-review (CSS only; no route, read or write). Fix, full suite, per-PR step 5, open `feat(theme): contrast and radius tokens that pass WCAG 2.2 AA (portal phase 1a, PR B)`. Blast Radius names the surfaces above; the full list goes in a PR comment.

## PR F. Toast layer (`portal/phase-1a-toasts`)

From `main`. Changes a screen: toasts inside every Arc modal, on the public site too. No operator review hold.

### Task F1: `ToastLayer` in Arc's modal primitives

**Skills:** tdd, modern-web-guidance, arc, better-accessibility.

**Files:** Delete `src/components/arc/toast/`. Modify `src/components/arc/toast-stack/toast-stack.tsx`, `toast-stack.module.css`, `src/components/arc/dialog/dialog.tsx`, `src/components/arc/drawer/drawer.tsx`, `src/components/arc/bottom-sheet/bottom-sheet.tsx`. Create `src/components/arc/toast-stack/toast-layer.browser.test.tsx`.

**Interfaces:**

- Consumes: `ToastStackContext` (`toast-stack.tsx:295`), read with `useContext`, never `useStore()` (it throws without a provider, `:297-300`); `DialogPrimitive.Content` in `dialog.tsx:169`, `:196`, `drawer.tsx:218`, `:255`, `bottom-sheet.tsx:625`.
- Produces: `ToastLayer({ className }: { className?: string }): React.JSX.Element | null`, exported from `toast-stack.tsx`. Under `ToastStackProvider` it renders and registers one out-of-flow element (`position: absolute; inset: 0; pointer-events: none`, no flex gap, plus `className`); with no provider, `null`. The provider keeps mounted layers newest last and notifies on change; `ToastStack` reads the newest with `useSyncExternalStore` and portals its `<section>` there with today's `contained` placement (`toast-stack.module.css:19-34`); items keep `pointer-events: auto`. Placement: Radix `Slot` takes one child under `asChild` (`dialog.tsx:196-225`, `drawer.tsx:255-285`, `bottom-sheet.tsx:625-692`), so there the layer is the last child of the `motion.div`, after `{inner}` (Dialog, Drawer) or after the status `span` inside `.sheet` (BottomSheet); the non-`asChild` branches (`dialog.tsx:169`, `drawer.tsx:218`) render it as the last child of `DialogPrimitive.Content`; a native `<dialog>` as its last child. `.sheet` reaches 160px below the viewport (`--sheet-extension`, `bottom-sheet.module.css:18-34`), so BottomSheet passes a class with `inset-block-end: calc(var(--sheet-extension) + env(safe-area-inset-bottom, 0px))` as BottomSheet's own class in `bottom-sheet.module.css`, written `.sheet > .toastLayer` (0,2,0) so it beats the layer's `inset: 0` (0,1,0) whatever the load order.

Measured (Chrome 158): Radix keeps `[aria-live]` regions out of `aria-hidden`, so under Radix a click on a toast works (measured); `ToastLayer` is for keyboard and for native `showModal()`, where the pointer fails too. The viewport's z-index 60 is above Arc modal layers 50/51. A popover above `showModal()` stays inert (Deviation 2 confirmed).

- [ ] **Step 0: Subtract.** `rg -n "['\"](\.\./)+toast['\"/]|['\"]\./toast['\"]|arc/toast['\"/]" src e2e testing --glob '!src/components/arc/toast/**'` prints nothing (measured), else stop and report. `git rm -r src/components/arc/toast/`, `pnpm exec tsgo --noEmit`, commit.
- [ ] **Step 1: Failing tests.** First, Deviation 2's premise: "a popover raised above an open modal dialog stays inert" (`showModal()`, then `showPopover()` on a popover with a button; focusing the button leaves `document.activeElement` in the dialog; a click at its centre does not call its handler). Then per surface (Arc `Dialog`, `Drawer`, `BottomSheet`, native `<dialog>`), under `ToastStackProvider` with a page button and a `ToastStack`, in `ltr` English and in `rtl` Arabic:
  - "a toast raised in an open $name is above it, in its tree and reachable": the toast region (Global Constraints, Locators) is inside the `dialog`; after `raise({ title: 'Saved', action: { label: 'Undo', onClick } })`, `Saved` is visible; the `Undo` rect is inside the viewport and `elementFromPoint` at its centre is that button; Tab from the surface's last control reaches it.
  - The same, raised during the open animation.
  - "a toast already showing moves in with one region and its text added once": a `MutationObserver` on `document.body` (`subtree`, `childList`, `characterData`), started before the surface opens, sees the toast's text added inside the layer once and never removed and added again there; the page has one region.
  - "the region goes back to the page when the surface closes".
  - "a toast stays in view when the $name content scrolls" (390 x 844; content 3000px tall, scrolled to its end; Dialog, Drawer and BottomSheet): the toast rect is inside the viewport. If it fails, that layer becomes `position: sticky; inset-block-end: 0; block-size: 0` (BottomSheet: its class keeps the inset above); the commit records which.
  - "unrelated DOM changes do not render the toast stack again": a `<Profiler>` count is unchanged while 200 `div`s come and go on `body`.
  - "with no provider, ToastLayer renders nothing and an Arc Dialog opens without an error".
  - `RUN pnpm exec vitest run --project browser src/components/arc/toast-stack/toast-layer.browser.test.tsx` **[heavy]**. Expected: the popover test passes (else stop and report: Deviation 2 loses its reason); the rest FAIL, `ToastLayer` not exported.
- [ ] **Step 2: Implement**, render it in the three primitives.
- [ ] **Step 3: Run** **[heavy]**, then the existing tests of the edited primitives (`rg -l "arc/(dialog|drawer|bottom-sheet)/" src --glob '*.test.ts*'`). Per surface: pass, it keeps `<ToastLayer />`; fail, remove it from that primitive and add the primitive to Deviation 2. Native `<dialog>` failing too: stop and report. Write each result in the commit.

### Task F2: Toast offset and height for the phone layout

**Skills:** tdd, modern-web-guidance, arc, better-accessibility.

**Files:** Modify `toast-stack.tsx`, `toast-stack.module.css`, `toast-layer.browser.test.tsx`.

**Interfaces:**

- Consumes: F1's `ToastLayer` and the moved region.
- Produces: outside a layer, the viewport's `bottom` (and its narrow variant) becomes `calc(var(--toast-stack-offset, 0px) + <today's value>)`; the `contained` placement inside a layer keeps today's value. While the region is outside a layer and holds a toast, `ToastStack` writes `--toast-stack-height: <listHeight>px` on `<html>`, and `0px` when empty. Both are documented in `ToastStackProps`' JSDoc.

- [ ] **Step 1: Failing test** **[heavy]** "the stack sits above --toast-stack-offset and reports its height": with `--toast-stack-offset: 100px` on `<html>`, the region's bottom is at least 100px above the viewport bottom; `--toast-stack-height` is above 0; after dismissing all it is `0px`; inside an open `Dialog` the region's rect is the same with the offset at `100px` and at `0px` (the modal covers the bottom bar).
- [ ] **Step 2: Implement, run** **[heavy]**: PASS, F1 still green. Commit.

### Task F3: Review, fix, full suite, open PR F

**Skills:** ux-auditor, better-interface, then break-ui; code-review, then security-review.

**Interfaces:** Consumes the branch of F1 and F2. Produces PR F.

- [ ] **Step 1: Screen reviews** **[heavy]**, with the review world, profile `main` (Global Constraints), as its member: open the post dialog, the session drawer and a bottom sheet in its course space, then `echo n` raises the toast inside each; 1440 and 390, English and Arabic. No toast within 10 s: stop and report (A4's bell test shares the premise). break-ui: a 200-character Arabic toast with a long action label in a 390px sheet; two toasts at once. Then `echo q`.
- [ ] **Step 2:** code-review, then security-review: toast text goes only into a layer of the same tab's provider; `--toast-stack-height` holds a number only. Fix, full suite, per-PR step 5, open `feat(toasts): toasts inside open modals (portal phase 1a, PR F)`.

## PR D. The `empty` seed (`portal/phase-1a-empty-seed`)

From `main`. No screen change.

### Task D1: One local-database guard

**Skills:** tdd.

**Files:** Create `seed/local-database.ts`, `seed/local-database.unit.test.ts`. Modify `seed/index.ts:22-27`.

**Interfaces:**

- Consumes: the rule inline at `seed/index.ts:22-27`.
- Produces: `requireLocalSeedDatabase(url: string | undefined): string`: returns the URL when its host is `localhost` and its port `5433` (the rule `seed/index.ts` and `vitest.setup.ts` use today), else throws `Refusing to seed: DATABASE_URL must point at localhost:5433.` `seed/index.ts` calls it. `vitest.setup.ts` keeps its check (it also allows the search-test database).

- [ ] **Step 1: Failing test:** `localhost:5433/cilas_dev` and `localhost:5433/cilas_empty` pass; `127.0.0.1:5433`, `localhost:5442/cilas` (the production route), `db.example.com:5433`, `undefined` throw `/Refusing to seed/`. `RUN pnpm exec vitest run --project node seed/local-database.unit.test.ts`.
- [ ] **Step 2: Implement, run** (6 passed). Commit.

### Task D2: `seedEmpty(payload)` and its int test

**Skills:** tdd.

**Files:** Create `seed/empty.ts`, `seed/empty.int.test.ts`.

**Interfaces:**

- Consumes: `scratchPayload` (`testing/scratch-database.test-utils.ts`); `mySpaces`; the `ensurePerson` hook (`Users.ts:50`).
- Produces: `EMPTY_ACCOUNTS: Record<'admin' | 'fellow' | 'student', { email: string; password: string; roles: User['roles'] }>` (`admin@empty.cilas.test`, `fellow@empty.cilas.test`, `student@empty.cilas.test`, password `empty-seed`). `seedEmpty(payload: Payload): Promise<Record<'admin' | 'fellow' | 'student', number>>` finds or creates each by email: the fellow gets a person first (`{ name: 'Empty Fellow', slug: 'empty-fellow' }`) and `['fellow']`; the student `['member']` and the person the hook makes; the admin `['admin']`, no person. `overrideAccess: true`.

- [ ] **Step 1: Failing int test** (dynamic imports after `scratchPayload()`): "the $role signs in" (`payload.login` returns its id; `Users.ts:152` `auth` has no `verify`); "the fellow has a person and teaches no course"; "the student reads no space" (set `spaces_mode: 'on'` first: a fresh database has it off, which empties `mySpaces` for the wrong reason); "a second run changes nothing" (same ids, 3 users). `RUN pnpm test:int seed/empty.int.test.ts` **[heavy]**: FAIL.
- [ ] **Step 2: Implement, run** **[heavy]** (6 passed). Commit.

### Task D3: `pnpm db:seed:empty`

**Skills:** tdd.

**Files:** Create `seed/empty-run.ts`, `seed/empty-url.ts`, `seed/empty-url.unit.test.ts`, `seed/migrate-all.ts`. Modify `package.json` (`"db:seed:empty": "npx tsx seed/empty-run.ts"`), `testing/scratch-database.test-utils.ts` (calls `migrateAll`).

**Interfaces:**

- Consumes: `requireLocalSeedDatabase` (D1), `seedEmpty`, `EMPTY_ACCOUNTS` (D2); `migrations` (`src/migrations/index.js`).
- Produces: `emptyDatabaseUrl(url: string): string` (`seed/empty-url.ts`), the URL with database `cilas_empty`. `migrateAll(payload: Payload): Promise<void>` (`seed/migrate-all.ts`): `payload.db.migrate({ migrations })` with the list mapped as `scratchPayload` maps it today (`scratch-database.test-utils.ts:40-46`), which then calls it. `empty-run.ts`, in this order: static imports only `pg`, `seed/local-database`, `seed/empty-url` and `requireLocalStorage` (`testing/local-env.ts`) (none reaches `src/env.ts`); sets `RESEND_API_KEY` and `TYPESENSE_API_KEY` to `''` itself; loads `.env.development.local`, then `.env.local`, with `process.loadEnvFile` (it keeps a key already set, empty too; a missing file is skipped), never `.env` (`seed/index.ts:19` loads it; it holds production R2, Resend and Typesense keys; `src/env.ts` later fills only keys still unset); `requireLocalStorage(process.env)`, as the review world; applies the guard; drops and creates `cilas_empty` through a `pg` `Pool` on `postgres` (`DROP DATABASE IF EXISTS cilas_empty WITH (FORCE)`, a constant name); points `process.env.DATABASE_URL` at `emptyDatabaseUrl(...)`; imports the config and `src/env.ts` dynamically (`seed/index.ts:29`); throws `Refusing to seed: the config did not pick up cilas_empty.` unless `new URL(env.DATABASE_URL).pathname === '/cilas_empty'` (`payload.config.ts:301` reads the URL frozen at the first `src/env.ts` import); then imports `seed/empty` and `seed/migrate-all` dynamically, runs `migrateAll` and `seedEmpty`, prints the emails, password and URL, exits 0.

- [ ] **Step 1: Failing unit test:** `emptyDatabaseUrl('postgres://cilas:dev@localhost:5433/cilas_dev')` is `postgres://cilas:dev@localhost:5433/cilas_empty`; a query string survives. Implement, run. Then `RUN pnpm test:int seed/empty.int.test.ts` **[heavy]** still passes through `migrateAll`.
- [ ] **Step 2: Run the command** **[heavy]**, with `<scratch>` the scratchpad:
  ```bash
  docker exec cilas-db-1 psql -U cilas -d cilas_dev -Atc 'select count(*) from users' > <scratch>/users-before.txt
  time RUN pnpm db:seed:empty
  docker exec cilas-db-1 psql -U cilas -d cilas_dev -Atc 'select count(*) from users' | diff - <scratch>/users-before.txt && echo cilas_dev unchanged
  ```
  (`RUN` expanded; the host has no `psql`, so it runs in the container.) Expected: the accounts and `DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_empty` print, then `cilas_dev unchanged`. A second run prints the same. Report the time. No output for 5 minutes is the Lexical import deadlock `Dockerfile:75-76` names: stop and report.
- [ ] **Step 3: Sign-in check** **[heavy]**. Dev server as Global Constraints, `DATABASE_URL` pointing at `cilas_empty` (the exception), on 3100. Per account: `curl -fs -c <scratch>/empty-<role>.txt -H 'Content-Type: application/json' -d '{"email":"<email>","password":"empty-seed"}' http://localhost:3100/api/users/login` returns JSON whose `user.email` is the account's; then `curl -s -o /dev/null -w '%{http_code}' -b <scratch>/empty-<role>.txt http://localhost:3100/en/settings` prints `200`. It needs no `/spaces`, which is not found while spaces are off. Stop the server. Commit.

### Task D4: Review, fix, full suite, open PR D

**Skills:** code-review, then security-review.

**Interfaces:** Consumes the branch of D1 to D3. Produces PR D.

- [ ] **Step 1:** code-review, then security-review. In the PR: Ends-when 14 rests on D3's manual Steps 2 and 3 for the command itself (the drop, the URL switch, the guard); D1, D2 and D3's unit test cover only the parts. The guard refuses every non-local database URL; it blanks Resend and Typesense, and loads and checks the two local files first; `.env` fills only keys still unset; it refuses to migrate when the config's URL is not `cilas_empty`; the known password exists only where the guard allows; no deploy step runs a seed (`rg -n "seed" Dockerfile .github/`); `DROP DATABASE` names only the constant. Fix, full suite, per-PR step 5, open `feat(seed): pnpm db:seed:empty for empty-state tests (portal phase 1a, PR D)`.

## PR C. Shell, nav and feedback parts (`portal/phase-1a-shell`)

From `main` after A, B and F merge. Changes every portal screen: operator review before merge. `e2e/portal-shell.e2e.test.ts` builds its own `portalWorld`, holds `spaces_mode` `on` with `holdSpacesMode`, and runs serially.

### Task C1: The count fixture, axe, and the base violations on `main`

**Skills:** tdd, better-accessibility.

**Files:** Modify `package.json`, `pnpm-lock.yaml`, `testing/portal.fixture.ts`, `testing/portal.fixture.int.test.ts`. Create `e2e/portal-shell.e2e.test.ts`, `e2e/portal-axe-known.json`.

**Interfaces:**

- Consumes: `portalWorld`, `holdSpacesMode`, `login`, `localePath`, `ROLES`, `LOCALES`, `WIDTHS` (A4).
- Produces (fixture): `PortalWorld` gains `otherCourse: RoomFixture` (a second course with the same members, its space through A4's `courseRoom`; `poster` writes 12 posts; `label.ar` a 60-character Arabic title with no space), `loners: Record<'fellow' | 'student', PortalAccount>` (a fellow with a person and no course, a student with no enrollment; no admin: an admin reads every space, `spaces.ts:292`) and `resetVisits: () => Promise<void>` (deletes the fixture accounts' `space-visits` rows). `EXPECTED_UNREAD = { course: 1, otherCourse: 12, community: 1 } as const`, exactly what every role reads after `resetVisits()` (no intro posts, A4).
- Produces (spec file): `portalRoutes(world, locale): string[]` (`/{locale}/spaces`, the course space, `/{locale}/spaces/community`, the community space); `known(route, role, locale, width): Record<string, number>`, rule id to node count, read from the JSON keyed by route shape (`/spaces`, `/spaces/course/*`, `/spaces/community`, `/spaces/community/*`), role, locale and width; `{}` for a key with no row (C8 Step 3 deletes the `/spaces` rows).

- [ ] **Step 1** **[heavy]:** `nice -n 19 ionice -c3 pnpm add -D -E @axe-core/playwright` (a version at least two weeks old).
- [ ] **Step 2: Fixture int test** **[heavy]**: "every role reads the three rooms with the expected counts" (`EXPECTED_UNREAD`; after a `space-visits` row for `course`, `resetVisits()` brings it back to 1); "a loner reads no space while spaces are trial with the community closed" (`set('trial', { trialCommunity: false })`; the loners are in no trial course or cohort). `RUN pnpm test:int testing/portal.fixture.int.test.ts`: FAIL, then PASS.
- [ ] **Step 3** **[heavy]:** "axe ($route $role $locale $width)": per route, `new AxeBuilder({ page }).withTags(tags).analyze()`; violations grouped by rule id; each count at most `known(...)`, a rule id not in it fails. Run on `main` with `{}`, then write every route's counts into the JSON, `/spaces` too (it renders today's page until C8 Step 3 deletes its rows).
- [ ] **Step 4** **[heavy]:** Perf base: TTFB p75 of `/en/spaces` per fixture role (20 warm requests each), in the PR (Perf). Commit.

### Task C2: `portalNav(user)` and the `Portal` messages

**Skills:** tdd, better-writing, then humanizer.

**Files:** Create `src/portal/nav/portal-nav.ts`, `portal-nav.unit.test.ts`, `nav-icons.ts`. Modify `messages/en.json`, `messages/ar.json`.

**Interfaces:**

- Consumes: `isAdminUser` (`src/access.ts`; `RoleHolder` is not exported, so the type is `Parameters<typeof isAdminUser>[0]`); `messagesOf[locale]` (`testing/intl.test-utils.tsx:11`, an object).
- Produces: `type PortalNavGroup = 'top' | 'myWork' | 'teaching' | 'admin'`; `type PortalNavIcon = 'home' | 'dashboard'`; `type PortalNavItem = { key: 'home' | 'openDashboard'; labelKey: \`nav.${string}\`; group: PortalNavGroup; href: string; icon: PortalNavIcon; count: number | null; external: boolean }`; `portalNav(user: Parameters<typeof isAdminUser>[0]): PortalNavItem[]`. 1a: Home (`top`, `/spaces`, `home`, `null`, `false`) for all; **Open dashboard** (`admin`, `/admin`, `dashboard`, `null`, `true`) for admins. `href`has no locale.`nav-icons.ts` maps the icon key to lucide. Later phases add items here only.
- `Portal` messages (Arabic in the same task, gender-neutral, six ICU plural forms): `nav.label` "Main", `nav.home` "Home", `nav.openDashboard` "Open dashboard", `nav.spaces` "Spaces", `nav.unread` "{count, plural, one {, # unread post} other {, # unread posts}}", `nav.unreadMany` ", more than 9 unread posts", `nav.fold` "Fold the sidebar", `nav.more` "More", `nav.brand` "CILAS home", `shell.skip` "Skip to content", `account.label` "Account", `account.profile` "Profile and settings", `account.theme` "Theme", `account.signOut` "Sign out". Language reuses `Language.switchToLabel`. Arabic starting points: الرئيسية، فتح لوحة التحكم، المساحات، طيّ الشريط الجانبي، المزيد، الانتقال إلى المحتوى، الحساب، الملف الشخصي والإعدادات، المظهر، تسجيل الخروج.

- [ ] **Step 1: Failing tests** (`RUN pnpm exec vitest run --project node src/portal/nav/portal-nav.unit.test.ts`): "roles %j see %j" (`member`, `non_degree_seeking`, `fellow`: `['home']`; `admin`, `super_admin`: `['home', 'openDashboard']`); "Open dashboard is a full load to /admin in the admin group" (the whole item); "every label key exists in both languages".
- [ ] **Step 2: Implement, run** (7 passed). Commit.

### Task C3: `signOut()`, `menuUser()` and `AccountMenu`

**Skills:** tdd, modern-web-guidance, arc, better-accessibility.

**Files:** Create `src/lib/sign-out.ts`, `src/components/menu-user.ts`, `src/portal/nav/account-menu.tsx`. Modify `src/components/site-header.tsx` (`:55-69`, `:238-245`), `e2e/site-frame.e2e.test.ts`.

**Interfaces:**

- Consumes: `announceAuthChange` (`src/lib/auth-events`), `forgetThisDevice` (`src/lib/push/forget`), `useSession` (`src/components/use-session`), `UserMenu`, `UserMenuUser` (`src/components/arc/user-menu/user-menu`), `useRouter`, `usePathname` (`src/i18n/navigation`), next-themes `useTheme`, `Portal.account` messages (C2).
- Produces: `signOut(): Promise<void>` (today's order: `announceAuthChange()`, `forgetThisDevice()`, `POST /api/users/logout`, `window.location.reload()`). `menuUser(session: NonNullable<ReturnType<typeof useSession>>): UserMenuUser` (today's memo body). `AccountMenu(): React.JSX.Element | null` (client): `UserMenu` with `user={menuUser(session)}`, nothing until the session loads. It keeps `useSession`: its `depth=2` answer brings the person's name and photo, and the depth of the server's `payload.auth` user is not checked (`auth.depth` unset in `Users.ts`). `showTheme` with `useTheme()`, `items` **Profile and settings** (`router.push('/settings')` until 1d) and Language (`router.replace(pathname, { locale: other })`), `onSignOut={signOut}`, labels from `Portal.account`. `UserMenu` already follows the menu button pattern (`user-menu.tsx:854`).

- [ ] **Step 1: Guard e2e** in `site-frame` **[heavy]**: "the site header menu signs out ($locale $width)", as the fellow, logging in afresh (Deviation 19): open the account menu where the header shows it at that width, Sign out, signed out on the same page. Green on the base.
- [ ] **Step 2:** Extract `signOut` and `menuUser`; the header calls them. Write `AccountMenu` (its e2e lands with the shell, C8). Run Step 1 again **[heavy]**: PASS. Commit.

### Task C4: `LiveRegion` and `announce()`

**Skills:** tdd, modern-web-guidance, better-accessibility.

**Files:** Create `src/portal/feedback/announce.tsx`, `announce.dom.test.tsx`.

**Interfaces:**

- Consumes: React and `requestAnimationFrame` only.
- Produces: `LiveRegion(): React.JSX.Element` (client; `<div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-portal-live />`, starts empty). `announce(message: string): void`: clears the region, sets `message` one animation frame later; a second call in the same frame cancels the first's frame; with no region it does nothing. One module variable, set by the region's ref callback, links the two. Considered: `@react-aria/live-announcer` (Adobe react-spectrum, Apache-2.0, not installed) also reads repeats; not used because the spec wants one stable `[data-portal-live]` region in the shell with this clear-then-set behaviour, and the library makes its own regions: about 20 lines of ours replace a dependency that would not give the one region.

- [ ] **Step 1: Failing tests** (`RUN pnpm exec vitest run --project dom src/portal/feedback/announce.dom.test.tsx`): "a repeated message clears, then sets again" (a `MutationObserver` sees `['Saved', '', 'Saved']`); "two calls in one frame read only the last" (ends `Second`, never `First`); "announce with no region mounted does nothing". If jsdom lacks `requestAnimationFrame`, make it a browser test.
- [ ] **Step 2: Implement, run** (3 passed). Commit.

### Task C5: `SuccessCheck`

**Skills:** tdd, modern-web-guidance, animate, then transitions-dev, better-accessibility.

**Files:** Create `src/portal/feedback/success-check.tsx`, `success-check.module.css`, `success-check.browser.test.tsx`.

**Interfaces:**

- Consumes: `emulateMedia` (`testing/media.test-utils.ts`); `--portal-duration` (B1), `--ease-standard` (`foundation.css`).
- Produces: `SuccessCheck({ label }: { label: string }): React.JSX.Element`, no `'use client'`: an `aria-hidden` SVG path (`pathLength={1}`) that draws once from `stroke-dashoffset: 1` to `0` over `var(--portal-duration)` with `var(--ease-standard)`, then the label. Under `prefers-reduced-motion: reduce` the SVG is `display: none`. It announces nothing. No consumer in 1a (Deviation 22).

- [ ] **Step 1: Failing tests** **[heavy]** (the test imports `foundation.css` and `tokens.css` and renders under `data-page="spaces"`): "draws the check once beside its text" (label visible; SVG shown; 1 animation, `iterations` 1, `duration` from 120 to 200 ms); "reduced motion shows the text only" (`emulateMedia({ 'prefers-reduced-motion': 'reduce' })`; label visible; SVG `display: none`); "an Arabic label in an rtl document keeps the check at the inline start".
- [ ] **Step 2: Implement, run** **[heavy]** (3 passed). Commit.

### Task C6: `PortalEmptyState`

**Skills:** tdd, modern-web-guidance, arc, better-layout, better-typography.

**Files:** Create `src/portal/feedback/empty-state.tsx`, `empty-state.module.css`, `empty-state.dom.test.tsx`.

**Interfaces:**

- Consumes: `--radius-panel` (B1, space-page scope); `renderWithIntl` (`testing/intl.test-utils.tsx`); Arc `button.module.css`; `Link` (`src/i18n/navigation`).
- Produces: `PortalEmptyState({ title, body, next, action }: { title: string; body: string; next?: string; action?: { label: string; href: string } }): React.JSX.Element` (Deviation 10). No `'use client'`, no animation. An L2 card (1px `--border`, `--radius-panel`, padding 16px): `h2` (17px, weight 500), body (15px, `--text-secondary`, `text-wrap: pretty`), the action as a `Link` at Arc's primary level (`button`, `primary`, `md`), then `next` (13px, `--text-muted`).

- [ ] **Step 1: Failing tests** (`RUN pnpm exec vitest run --project dom src/portal/feedback/empty-state.dom.test.tsx`): "renders an h2 heading and its body"; "a link action, then the next line" (link with the locale-prefixed `href` that `renderWithIntl` gives; `next` after it); "with no action it renders no link".
- [ ] **Step 2: Implement, run** (3 passed). Commit.

### Task C7: Space pages drop their own `<main>`

**Skills:** tdd, modern-web-guidance, better-accessibility.

**Files:** Modify `src/components/space/space-page.tsx:534`, `src/components/space/post-page.tsx:73`, their CSS modules if a rule names `main`, `e2e/portal-shell.e2e.test.ts`.

**Interfaces:**

- Consumes: `SiteFrame`'s `main` (A2); `portalWorld` (A4, C1).
- Produces: space and post pages with no landmark of their own: each `<main>` becomes a `<div>` with the same class, and its `aria-label` or `aria-labelledby` goes (an accessible name is not allowed on a generic). The page's one `main` is its layout's.

- [ ] **Step 1: Failing e2e** **[heavy]** "a space page and a full post page have one main ($locale $width)" (Deviation 19): on `course.path` and a hard load of `course.postPath`, `getByRole('main')` has count 1. Expected: FAIL (two).
- [ ] **Step 2: Implement, run** **[heavy]**: PASS. Commit.

### Task C8: `PortalShell` in the portal layout

**Skills:** tdd, modern-web-guidance, arc, better-layout, better-typography, better-accessibility.

**Files:** Create `src/portal/nav/portal-shell.tsx`, `shell.module.css`, `sidebar.tsx`, `space-links.ts`, `space-links.unit.test.ts`. Modify `(portal)/spaces/layout.tsx`, `(portal)/spaces/(rooms)/layout.tsx`, `e2e/portal-axe-known.json`, `src/lib/reader.ts`, `src/lib/spaces-data.ts`, `(portal)/spaces/(home)/page.tsx` (calls `spaceLabel`).

**Interfaces:**

- Consumes: `portalNav`, `nav-icons` (C2); `AccountMenu` (C3); `LiveRegion` (C4); space and post pages with no `main` (C7); `--radius-*`, `--portal-unread*` (B1); `SiteNotifications` (`src/components/site-notifications.tsx`); `SpaceSummary` (`spaces-data.ts:78`, `href` already locale-prefixed, `:259`); `EXPECTED_UNREAD`, `resetVisits` (C1); `localePath` (A4).
- Produces:
  - `type SpaceLink = { id: number; label: string; href: string; unread: number; cover: string | null; archived: boolean }`, `href` locale-prefixed.
  - `spaceLinks(spaces: { communities: SpaceSummary[]; cohorts: SpaceSummary[]; courses: SpaceSummary[] }, communityLabel: string): SpaceLink[]`: communities, cohorts, then courses with archived ones last.
  - `spaceLabel(row: SpaceSummary, communityLabel: string): string`, the rule now inline at `(home)/page.tsx:141-143`.
  - `isCurrentSpace(pathname: string, href: string): boolean` (equal, or starts with `href + '/'`) and `shownUnread(row: SpaceLink, pathname: string): number` (0 when `isCurrentSpace`, else `row.unread`; Deviation 15). The sidebar, its folded rows and the More sheet read both: `aria-current` from the first, the circle and hidden text from the second.
  - Spec file: `spaceName(room, locale, unread)` builds the expected row name from `room.label[locale]` and `nav.unread` or `nav.unreadMany` through next-intl `createTranslator`; with 0 it is the bare label.
  - `currentReader = cache(...)`, `mySpaces = cache(...)` (React `cache`).
  - `PortalShell({ nav, spaces, folded, accountId, children }: { nav: PortalNavItem[]; spaces: SpaceLink[]; folded: boolean; accountId: number; children: React.ReactNode }): React.JSX.Element` (server). Order: skip link `<a href="#main">` (first focusable), `<LiveRegion />`, then the grid `<div data-page="spaces" data-portal-shell data-folded={folded || undefined}>` on `--surface-muted`: a rail (top block: brand mark linking to `/`, `SiteNotifications`, `AccountMenu`; then `<Sidebar>`) and `<main id="main" tabIndex={-1}>`, the L1 panel at `--radius-surface`, holding `<div className="mx-auto w-full max-w-300">{children}</div>` (Deviation 24: one frame for every portal page, Home included). `SiteNotifications` (the bell, which raises the toasts) mounts once, here. Under 700px the top block is the phone header (brand, bell; `AccountMenu` rows move to More, C10) and `<Sidebar>` is `display: none`. The document scrolls, not `main`. No `<Suspense>` wraps `children` (Global Constraints).
  - `Sidebar({ items, spaces, folded, accountId })` (client): `<nav aria-label={t('nav.label')}>`, the items, then a `Spaces` `<h2>` and list when there are spaces. Items render next-intl `Link` (`<a href>` when `external`); space rows render `next/link` with the prefixed `href` (next-intl's would prefix again). `aria-current="page"` from `next/navigation` `usePathname()`: Home on `/{locale}/spaces`, a space when `isCurrentSpace`. A row: a 40x40 cover slot (`--radius-inner`; empty `--surface-muted` with no cover), the label in `<bdi>`, one line with an ellipsis, and when `shownUnread > 0` a `--portal-unread` circle (`tabular-nums`, `9+` above 9, `aria-hidden`) plus hidden `nav.unread` or `nav.unreadMany` text. Targets at least 24x24, 44x44 under `(pointer: coarse)`.
  - The layout: `currentReader()` (redirect as today), `mySpaces(payload, user, locale)` (on error, log `portal nav: the spaces list did not load` and use empty lists: spec, Navigation, Errors), then `<PortalShell …>{children}</PortalShell>` with `portalNav(user)`, `spaceLinks(...)`, `folded={false}` (C9 reads the cookie), `accountId={user.id}`. `SiteFrame` and A3's `max-w-300` div leave `(portal)/spaces/layout.tsx`; `data-page="spaces"` moves to the shell grid, which also covers Home, and the frame is the shell's (Deviation 24). `(rooms)/layout.tsx` stays `<>{children}{dialog}</>`.

- [ ] **Step 1: Failing unit tests** (`RUN pnpm exec vitest run --project node src/portal/nav/space-links.unit.test.ts`): "communities first, then cohorts, then courses with archived ones last" (ids `[1, 2, 4, 3]`); "an unnamed community takes the fixed label" (`row(kind, id, overrides)` in the test file); "a row whose href matches the pathname shows unread 0" (its own path and a post below it give 0; `/en/spaces/community/12` keeps the count of `/en/spaces/community/1`; Home keeps every count).
- [ ] **Step 2: Failing e2e** (1440, role and locale; each test calls `world.resetVisits()` first) **[heavy]**:
  - "landmarks, skip link and live region" on `/{locale}/spaces` and `course.path`: first Tab focuses the skip link; Enter focuses `main#main`; one `main`; one `navigation` named `nav.label`; Home has `aria-current="page"` on `/spaces`; no `header.site-header`; the bell is inside the rail; one `[data-portal-live][role="status"]`, empty on `/spaces` (space pages hold their own status lines, such as `composer.tsx:131`); `expect(known('/spaces', role, locale, width)).toEqual({})`.
  - "every nav item and account row opens a page": each nav `href` answers 200 (`/admin` too, admin only); the account button has `aria-haspopup="menu"` and gets `aria-expanded="true"`; **Profile and settings** lands on `/{locale}/settings`; Language on `/{other}/spaces` with `html[lang={other}]`; Theme changes `html[data-theme]`; Sign out lands on `/{other}/login`.
  - "the nav shows each space with its unread count", on `/{locale}/spaces`: `course` and `otherCourse` are named `spaceName(room, locale, EXPECTED_UNREAD[room])`.
  - "opening a space drops its count in this tab": click `otherCourse`; its row has no `9+` and is named `spaceName(otherCourse, locale, 0)`; after a reload still none.
- [ ] **Step 3: Implement**; delete every `/spaces` row from `portal-axe-known.json`. Run **[heavy]**: PASS; `site-frame` and `portal-spaces-off` still pass. Commit.

### Task C9: The folded sidebar

**Skills:** tdd, modern-web-guidance, arc, better-accessibility, animate, then transitions-dev.

**Files:** Create `src/portal/nav/fold.ts`, `sidebar.browser.test.tsx`, `space-link.test-utils.ts`. Modify `sidebar.tsx`, `shell.module.css`, `(portal)/spaces/layout.tsx`.

**Interfaces:**

- Consumes: `Sidebar`, `SpaceLink` (C8); `renderWithIntl`; `--portal-duration` (B1); `signOut` via `AccountMenu` (C3).
- Produces: `foldCookie(accountId: number): string` (`portal-folded-<id>`); `writeFold(accountId: number, folded: boolean): void` (client; `Path=/; Max-Age=31536000; SameSite=Lax`, `; Secure` on `https:`, `Max-Age=0` to unfold). The layout passes `folded={jar.has(foldCookie(user.id))}`. A fold button (`aria-expanded={!folded}`, `aria-label={t('nav.fold')}`, `aria-controls` the nav) and `[` toggle it; `[` only with focus inside the sidebar (WCAG 2.1.4), `event.code === 'BracketLeft'`, no modifier, not in an editable target. Folded: icons and round cover avatars; labels and counts stay as hidden text; an unread space shows the `--portal-unread` circle on its avatar; Arc `Tooltip` on hover and focus; bell and account avatar stay at the rail top, icon only. `transition: inline-size var(--portal-duration) var(--ease-standard)`. The chevron mirrors in RTL. `spaceRow(overrides?: Partial<SpaceLink>): SpaceLink` (`space-link.test-utils.ts`) builds a test row.

- [ ] **Step 1: Failing browser tests** **[heavy]** (clear `document.cookie` after each; rows from `spaceRow`): "[ folds only while focus is inside the sidebar" (`[` on `body` changes nothing; with Home focused it sets `aria-expanded="false"` and `portal-folded-7=1`); "folded and unfolded rows have the same accessible names" (`expect(link).toHaveAccessibleName(...)`, jest-dom; one is `Other course, more than 9 unread posts`); "a focused or hovered folded row shows its label in a tooltip"; "40 rows with 120 unread fit at 320px and 720px, folded or not, in English and in Arabic with a 60-character title" (`page.viewport`; the nav's `scrollWidth` at most its `clientWidth`; the 120 row shows `9+`, its name says "more than 9").
- [ ] **Step 2: Failing e2e** **[heavy]** (1440): "the folded state belongs to the account" (per locale), for the pairs (admin, fellow), (fellow, student), (student, admin): the first folds, reloads, still folded; signs out through the account menu; the second sees it unfolded; the first again folded. "reduced motion: the fold does not animate" (English, as the fellow): with `reducedMotion: 'reduce'`, `getComputedStyle(document.documentElement).getPropertyValue('--portal-duration')` is `0ms`, and right after a fold the nav's `getAnimations({ subtree: true })` is empty.
- [ ] **Step 3: Implement, run** **[heavy]**. Commit.

### Task C10: Bottom bar and More sheet

**Skills:** tdd, modern-web-guidance, arc, better-layout, better-accessibility, apple-design, animate, then transitions-dev.

**Files:** Create `src/portal/nav/bottom-bar.tsx`, `more-sheet.tsx`, `more-sheet.browser.test.tsx`. Modify `portal-shell.tsx`, `shell.module.css`, `e2e/portal-shell.e2e.test.ts`.

**Interfaces:**

- Consumes: `PortalNavItem` (C2); `SpaceLink` (C8); `spaceRow` (C9); `renderWithIntl`; `signOut` (C3); `LanguageSwitch`, `ThemeToggle` (`src/components/site-controls.tsx`); Arc `BottomSheet` (`open`, `onOpenChange`, `onCloseAutoFocus`, `bottom-sheet.tsx:34-58`) with its `ToastLayer` (F1); `--toast-stack-height` (F2); `notifyOf`, `localePath` (A4); `course` (A4).
- Produces: `BottomBar({ items, spaces })` (client): under 700px (`@media (width < 700px)`) a fixed `<nav aria-label={t('nav.label')}>` above `env(safe-area-inset-bottom)` with the `top` items and a **More** button (`aria-expanded`, `aria-haspopup="dialog"`); items at least 44px high; `aria-current` as in the sidebar. `MoreSheet = preloadable(() => import('./more-sheet').then((m) => m.MoreSheet))`, mounted on the first open and kept mounted so `BottomSheet` plays its exit; `.preload` on the button's `onPointerEnter`, `onFocus`, `onPointerDown`. `MoreSheet({ open, onOpenChange, items, spaces, returnFocus }: { …; returnFocus: React.RefObject<HTMLButtonElement | null> })`: `BottomSheet` (`title={t('nav.more')}`, `fit`; `onCloseAutoFocus` calls `event.preventDefault()` and focuses More, since Radix returns focus only to a `Trigger`) with the items not in the bar, the space rows with `shownUnread` (Deviation 20), **Profile and settings** (`Link` to `/settings`), `LanguageSwitch full`, `ThemeToggle full`, **Sign out**. If F1 put `BottomSheet` in Deviation 2: a native `<dialog>` (`showModal()` in an effect, `translate` over `--portal-duration`) rendering `<ToastLayer />`.
- Produces (spec file): `openMore(page, locale)`, returns the open More `dialog` locator.
- Phone CSS, on `:root` (a property set on the shell element would not reach `:root`): `@media (width < 700px) { :root:has([data-portal-shell]) { --portal-bar-height: 4rem; --toast-stack-offset: calc(var(--portal-bar-height) + env(safe-area-inset-bottom)); scroll-padding-block-end: calc(var(--portal-bar-height) + env(safe-area-inset-bottom) + var(--toast-stack-height, 0px) + var(--space-6)); } }`.

- [ ] **Step 1: Failing browser tests** **[heavy]** (`more-sheet.browser.test.tsx`, `MoreSheet` open under `ToastStackProvider` with a `ToastStack`, 40 rows from `spaceRow`, one with 120 unread and a 60-character Arabic label, English and Arabic):
  - "40 rows fit the More sheet at 320 and 390": the sheet body's `scrollWidth` at most its `clientWidth`; the 120 row shows `9+` and its name says "more than 9"; the last row scrolls into view.
  - "a toast in a More sheet scrolled to its end stays in view" (390 x 844): the toast rect is inside the viewport, its bottom less than 64px above the sheet's visible bottom, the viewport bottom (no bar offset inside the sheet).
- [ ] **Step 2: Failing e2e** **[heavy]**, role and locale at 390 x 844 unless named (Deviation 19):
  - "the More sheet is modal": More opens `dialog` `nav.more`; `main` is `inert` or under an `aria-hidden="true"` ancestor; 20 Tabs stay inside; `elementFromPoint` at a `main` link hits the sheet or its overlay; Esc closes it and focus returns to More.
  - "a toast in the open More sheet is above it, read and reachable": with the sheet open, `notifyOf(payload, account, localePath(course.postPath, locale))`; the toast region inside the sheet shows it; its button box is inside the viewport; at most 30 Tabs reach the toast action, then `toBeFocused()`.
  - "a focused row stays above the toast and the bottom bar" (390 x 560): precondition `scrollHeight > innerHeight`; with a toast shown, Tab to the last shortcut row; `await expect(toast).toBeVisible()` right before the measurement (an `info` toast lives 5 s, `toast-stack.tsx:306`); its bottom is at most `min(toast region top, bar top)`; the root's computed `scroll-padding-block-end` is at least bar plus toast height.
  - "every account row in the More sheet opens a page", as C8's desktop walk.
  - "a toast survives Profile and settings": load `/{locale}/settings` once first (a cold dev compile can outlast the 5 s toast); then raise the toast, open the row, and `await expect(toast).toBeVisible()` once `/{locale}/settings` loads.
  - "reduced motion opens the sheet at once": with `reducedMotion: 'reduce'`, visible within 100 ms and `getAnimations({ subtree: true })` empty.
- [ ] **Step 3: Implement, run** **[heavy]**. Commit.

### Task C11: `/spaces` empty state

**Skills:** tdd, modern-web-guidance, better-writing, then humanizer.

**Files:** Modify `(portal)/spaces/(home)/page.tsx` (`EmptyState` at line 117 on `main`), `messages/{en,ar}.json` (`Portal.empty.spacesTitle` "Your spaces", `Portal.empty.spacesNext`; the body keeps `Spaces.empty`), `e2e/portal-shell.e2e.test.ts`.

**Interfaces:**

- Consumes: `PortalEmptyState` (C6); `world.loners` (C1); `holdSpacesMode` (A4).
- Produces: the `/spaces` empty state (Deviation 21).

- [ ] **Step 1: Failing e2e** **[heavy]** "a reader with no space sees the empty state ($role $locale $width)" (fellow and student, Deviation 19; `set('trial', { trialCommunity: false })`, `set('on')` in `finally`): the role's loner sees `heading` level 2 `Portal.empty.spacesTitle` and the `spacesNext` line.
- [ ] **Step 2:** `<PortalEmptyState title={tp('empty.spacesTitle')} body={t('empty')} next={tp('empty.spacesNext')} />` (`tp` is `Portal`), an `h2` under the `h1`, no action (a member cannot make a space). Run **[heavy]**, commit.

### Task C12: The full matrix

**Skills:** tdd, better-accessibility.

**Files:** Modify `e2e/portal-shell.e2e.test.ts`, `e2e/portal-spaces-off.e2e.test.ts`.

**Interfaces:**

- Consumes: C1 to C11; `openMore` (C10); `spaceName` (C8); `EXPECTED_UNREAD`, `resetVisits`, `otherCourse` (C1); `holdSpacesMode`, `localePath` (A4).

- [ ] **Step 1: Matrix**, role x locale x 1440/390, each test calls `resetVisits()` first: C8's "landmarks, skip link and live region"; "nav per role" on `/{locale}/spaces` (Home has `aria-current`; on the phone inside `openMore`; Open dashboard 1 for admin, else 0; `course` and `otherCourse` named `spaceName(room, locale, EXPECTED_UNREAD[room])`); C8's "opening a space drops its count" (390: inside `openMore`); "keyboard walk" (25 Tabs, each stop's `outline-style` is not `none`, one stop inside `main`; a mouse click on Home leaves its `outline-style` `none`).
- [ ] **Step 2: Reflow and RTL.** "reflow ($role $locale)" on `/{locale}/spaces` and `course.path`, at 320 and 720, and Arabic at 390: `scrollWidth <= innerWidth`; at 320 and 390 the `otherCourse` link is visible in `openMore`; at 720 it is visible in the sidebar, folded and unfolded. "Arabic mirrors the shell": at 1440 the rail sits right of `main` and the chevron's computed `transform` or `scale` differs from English; at 390 Home's box is right of More's in the bar, and the More sheet's rows end at its inline start (right edge).
- [ ] **Step 3: Targets** ($locale): under `hasTouch: true, isMobile: true`, first assert `matchMedia('(pointer: coarse)').matches` (if false, enable it through CDP `Emulation.setTouchEmulationEnabled` and record which); at 390 each bar item and More are at least 44x44; at 1440 the sidebar rows and the fold button are at least 44x44; without touch at 1440 at least 24x24.
- [ ] **Step 4: Axe matrix.** C1's test for role x locale x 1440/390; on `/spaces` also dark theme, the account menu open (1440) and the More sheet open (390).
- [ ] **Step 5: Spaces off** in `portal-spaces-off`, role x locale x 1440/390: "spaces off: no spaces in the nav" (no `Spaces` heading or space link in the sidebar or the More sheet; Home's `h1` loads; no `Spaces.empty` text). "spaces switched off while a reader is on a space page": on `course.path`, `set('off')`, click `otherCourse` in the sidebar (390: in `openMore`); student and fellow: the `NotFound.title` heading; admin too: every role, admin included, gets the `NotFound.title` heading (`spaces-data.ts:967-968`); `set('on')` in `finally`.
- [ ] **Step 6:** Run both files **[heavy]**, one after the other. Expected: all pass. Commit.

### Task C13: Review, fix, full suite, open PR C

**Skills:** ux-auditor, better-interface, then break-ui; code-review, then security-review.

**Interfaces:** Consumes the branch of C1 to C12. Produces PR C.

- [ ] **Step 1: Screen reviews** **[heavy]**, with the review world, profile `portal` (Global Constraints), signed in with its printed accounts: the shell, 1440 and 390, English and Arabic, light, dark, more contrast. break-ui: its 40 spaces, the 60-character Arabic title, 0, 9, 10 and 120 unread, a space with and without a cover, its admin with no person, a Latin name in an Arabic line, and `/spaces` with spaces off (`echo off`, then `echo on`, to the control file). Live check in the T3 preview: its fellow, Arabic, 390 x 844, a toast inside the More sheet (`echo n`), Tab to its action; 1440 x 900, fold with `[`, reload. Then `echo q`. Screenshots, the branch perf numbers and the gzip size of the account-menu and bell chunks (Deviation 23) in a PR comment.
- [ ] **Step 2:** code-review (spec Navigation, Frame, Accessibility baseline as the issue), then security-review. In the PR: the login redirect runs before any read; the nav lists the spaces through the same `mySpaces` as `/spaces`; **Open dashboard** shows to admins only, and `/admin` access stays Payload's; React `cache` is per request; the fold cookie picks a layout only and reveals an account id on a shared device; one `signOut()`; toast text renders only inside a modal of the same tab; `Schema` is gone from `/spaces` pages; `rg -l "@/portal/" src/lib src/components src/i18n` prints nothing.
- [ ] **Step 3:** Fix, full suite, per-PR step 5, open `feat(portal): the portal shell, nav and feedback parts (portal phase 1a, PR C)`.
