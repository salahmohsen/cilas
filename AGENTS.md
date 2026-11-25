# Agents

This project uses the Payload CMS skill at `.agents/skills/payload/`.
Start with `.agents/skills/payload/SKILL.md` for a quick reference, then see `.agents/skills/payload/reference/` for detailed docs.

The calendar uses ui-sdk (ADR 0011), and so do the wrappers for parts that free Arc lacks (ADR 0012). Before you change `src/components/calendar/ui/` or `src/components/sdk/`, read the ui-sdk skill at `.agents/skills/ui-sdk/SKILL.md`. It links to the copy inside `@ui-sdk/core`, so it matches the installed version. Only those two folders may import `@ui-sdk/*`; the lint rule `no-restricted-imports` enforces it. App code imports a wrapper from `src/components/sdk/`, never `@ui-sdk/*`.

Order of choice for a UI part: the Arc component already in `src/components/arc`, the free Arc registry, a ui-sdk wrapper in `src/components/sdk/` (Arc style: tokens, radii, focus ring, motion, reduced motion), a Radix primitive the repo already uses, then your own code. Never use two primitive families for one job. ui-sdk is a beta with an exact pin: each wrapper has a browser test (keyboard, focus, RTL, reduced motion), and a ui-sdk upgrade is its own PR. See `src/components/sdk/README.md`.

## Code structure (untangle rules)

Apply these to every change, not only to refactors. Before you write code, ask one question of each piece you touch: **should these pieces change together?** There are three ways to get it wrong.

**Hidden links.** Pieces that must change together, where the code does not show it.

- Copies of logic or values. Write the rule once and import it.
- A module that reads a global or file set by another module. Pass the value in.
- One feature split across folders by layer. Keep a feature's code together.
- A call order or convention callers must know. Make the API enforce it.

**Needless links.** Pieces tied together that change for different reasons.

- Callers that depend on internals. Expose a small interface.
- Stable code that imports volatile code. Depend on what changes less.
- A general function with a parameter only one caller understands. Move that knowledge to the caller.
- A shallow module whose interface changes with its internals. Make it deeper or remove it.

**Surplus.** Pieces with no reason of their own to change.

- Pass-through wrappers. Remove them.
- Config or extension points for things that never vary. Remove them.
- Dead code. Remove it.

**Special cases.** An `if` for one value, a parameter for one caller, a swallowed exception, a retry or sleep, or a disabled test. Each one is a requirement the design does not cover. Change the design so the case follows from it. Do not patch cases one by one.

**Access rules.** Every access function has a name that says what it allows (`isAdmin`, `nobody`, `adminOrOwnAccountRows`), never an inline arrow. A rule that two or more collections use lives in `src/access.ts`; a rule one collection owns is a named const beside it. A factory lives in `src/access.ts` and names its rule with `named()`. A field only an admin sets is wrapped in `adminWrites(...)`, and one only an admin changes after create in `adminUpdates(...)`: they add the access and keep the stored value when a non-admin restores a version. `pnpm audit:access` regenerates `scripts/access-audit.snapshot.json` and fails on a rule with no name. Each row is `name#hash`: the hash is of the rule's source, so a changed body changes the row. CI runs the audit in `scripts/access-audit.unit.test.ts`, with the unit tests. A collection or global operation is never `open`: a missing rule means Payload's logged-in default (`payload:loggedIn`).

Keep a decision log for structural work. List the problems first, then write each fix above the problems it solves. Done means a typical change lands in one place, and no module imports anything more volatile than itself.

## Screenshots on pull requests

A pull request that changes UI gets screenshots, posted as a PR comment with `gh issue comment <pr> --attach '<file>#<alt>'` (gh 2.103 or later). The images live on GitHub, never in the repo, a branch or a gist. Each UI change on the PR adds a new comment that names the commit, so the PR keeps the history.

Take them with `pnpm pr:shots <spec.json> <pr>` while `pnpm dev` runs: it signs in as a throwaway admin, saves the PNGs and posts the comment (the spec format is at the top of `scripts/pr-shots.ts`). Keep the spec outside the repo. Look at an image only when a shot may have gone wrong: each look costs tokens.

## Commit hooks

Never commit or push with `LEFTHOOK=0` (or `--no-verify`) unless the user says so. The hooks format staged files in every worktree, also ones with no `node_modules`; see `docs/commit-checks.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Lazy client components

- Use `preloadable` from `src/lib/preloadable.tsx` for client UI that shows only after a user action: dialogs, sheets, lightboxes, editors, panels. Load shape: `preloadable(() => import('./x').then((m) => m.X))`.
- Mount it only after the action (for example `{editing && <X />}`), and call `X.preload` from the trigger's `onPointerEnter`, `onFocus` and `onPointerDown` so the chunk is ready at the click.
- Never use it for a server component, and never for first-render content: that content must be in the server-rendered HTML (SEO).
- `next/dynamic` stays for first-render client content that needs a loading skeleton (for example `StudyGrid` in `src/components/study-list.tsx`).
