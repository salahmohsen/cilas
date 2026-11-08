# CI speed

Free changes only: no paid runners and no paid services. The repository is private, so
GitHub gives 2000 free Linux minutes a month. A job is billed in whole minutes.

## Baseline (before)

Workflow `CI` (`.github/workflows/security.yml`) is the only workflow. The last 8 runs that
passed after the Oxlint switch (runs 41180749387 to 41202114384, 2026-10-31):

| Job                 | Median | Setup (checkout, pnpm, node, install, browser) | Run steps                               |
| ------------------- | -----: | ---------------------------------------------: | --------------------------------------- |
| `commit-quality`    |    50s |                                           ~30s | hook tests 20s, quality check 2s        |
| `security`          |   241s |                                           ~30s | audit 1s, types 36s, lint 2s, unit 167s |
| `production-smoke`  |   256s |     ~70s (28 with 13s containers, 22s browser) | build 149s, fixtures 14s, e2e 18s       |
| `deploy-production` |     5s |                                            ~0s | API call (main only)                    |

- Queue wait (job created to job started): 2-3s, once 12s. Not worth tuning.
- Wall time per run (first job created to last job done): **median 266s**, range 244-291s.
- Billed minutes per run: **median 10** (commit-quality 1, security 5, production-smoke 5, deploy 1 on main).
- The critical path is `production-smoke`, then `security`. The two run in parallel already.
- Lint is already fast: Oxlint takes 2-3s (it took 64-69s with ESLint before commit 4361b29b).

## After (PR #21, same workflow)

Two PR runs, both passing. Run A had cold caches (the lockfile changed, so every cache key
missed). Run B restored the caches that run A saved.

| Measure            | Before (median of 8) | Run A (cold) | Run B (warm) |
| ------------------ | -------------------: | -----------: | -----------: |
| Wall time          |                 266s |         323s |     **152s** |
| `commit-quality`   |                  50s |          61s |          49s |
| `security`         |                 241s |          90s |      **84s** |
| `production-smoke` |                 256s |         313s |     **140s** |
| Billed minutes     |                   10 |           11 |        **7** |

A third run (commit f10b92e9, source unchanged, cache saving limited to `main`) took the same
time as run B: `security` 81s, `production-smoke` 139s, `commit-quality` 46s.

Run steps, before to warm:

| Step                             | Before | Warm | Change                                              |
| -------------------------------- | -----: | ---: | --------------------------------------------------- |
| Type check                       |    36s |   9s | `tsgo` instead of `tsc` (3s on a laptop)            |
| Unit tests                       |   167s |  27s | `--no-isolate` (laptop, one worker: 120s to 22s)    |
| Lint                             |     2s |   2s | already Oxlint                                      |
| `next build`                     |   149s |  34s | `.next/cache` restored                              |
| `playwright install --with-deps` |    22s |  11s | browser download cached, apt packages still install |
| Checkout in `commit-quality`     |     4s |   3s | blobless clone, too small to matter                 |

Run A is slower than the baseline only because it paid for every cache miss and every cache
save once (build cache save 5s, pnpm store save 19s). Run B restored the Next cache that
run A saved, and no source file changed between the two runs. A real change recompiles
the files it touches, so expect a build between 34s and 149s, nearer the low end for a small
change. After this merges, pushes to `main` seed the caches for every pull request.

The critical path is now `production-smoke`: 140s of which `next build` 34s, e2e 18s,
fixtures 14s, containers 12s, browser 11s, install and setup about 25s.

## What changed, one commit each

1. **`tsgo` for the type check** (adopted). `@typescript/native-preview` is pinned to an
   exact version. On a probe file with three type errors, including one through Payload
   collection types, `tsc` and `tsgo` printed identical errors. Next's own `next build`
   still runs `tsc`, so the production build keeps a second type check. `pnpm typecheck:tsc`
   remains for a manual comparison.
2. **Vitest `--no-isolate` for `tests/unit`** (adopted, unit tests only). The first try
   failed once in four runs: `public-event-card` got a mocked child component left by
   another file. `vitest.setup.ts` now calls `vi.resetModules()` and RTL `cleanup()`.
   After that: 6 runs with the default scheduler and 3 runs with one worker and shuffled
   file order all passed (886 tests). `tests/int` still uses isolation (`pnpm test:int` is unchanged).
3. **Caches** (adopted): `.next/cache` (restored everywhere, saved only by pushes to `main`) and
   `~/.cache/ms-playwright` (keyed by Playwright version). The pnpm store cache from
   `actions/setup-node` already existed and is keyed on the lockfile; `main` saves it first.
4. **Blobless clone** in `commit-quality` (adopted). It only reads file names from history.
   Gain is about 1s. The other jobs already use a depth-1 checkout.
5. **Skip the slow jobs for docs-only PRs** (adopted). See the safety notes below.
6. **`pre-push` hook** (adopted). About 5s: Oxlint and Oxfmt on the branch's changed files
   plus `tsgo` when TypeScript or JSON changed. See `docs/commit-checks.md`.

## Rejected or already done

- **Oxlint**: already in place (commit 4361b29b). Lint is 2s.
- **Splitting `security` into parallel jobs** (rejected). It now takes 84s and
  `production-smoke` takes 140s, so a split would not shorten the run. It would add about
  25s of setup and one billed minute per job.
- **`node_modules` cache** (rejected). `pnpm install` already takes 9-15s with the store cache.
- **Turning off the type check inside `next build`** (rejected). It would save about 33s of the
  `production-smoke` build, but it removes the second, independent compiler check of the production
  build. Say so if you want it.
- **`isolate: false` for `tests/int`** (not done). They share a database and need their own measurement.
- **`concurrency` with `cancel-in-progress`**: already present.
- **Paid runners, larger runners, hosted caches**: out of scope (free changes only).

## Safety of the docs-only skip

- Pull requests only. Pushes to `main` never skip anything, so `deploy-production` is unchanged.
- "Docs-only" means every changed file (and every old name of a renamed file) is under
  `docs/`, `todos/`, or is a top-level `*.md` file. Anything else,
  including `.github/`, `src/`, `package.json` and `*.md` inside `src/`, runs everything.
- The gate fails open. A failed API call, an empty file list, or 3000+ files sets `docs_only=false`.
  If the `changes` job itself fails, `security` and `production-smoke` still run
  (`!cancelled()` and `!= 'true'`).
- A skipped job reports success, so a required check cannot hang on a docs-only PR.
  (Branch protection is not available on this private plan today, so nothing is required yet.)
- `commit-quality` always runs and still checks formatting of the docs.

## Minutes trade-off

The repo has 2000 free minutes a month. Warm runs bill **7 min** against 10 before, because
`security` falls from 5 to 2 billed minutes and `production-smoke` from 5 to 3. Cold runs bill about 11.
The `changes` job adds one billed minute to each PR run but saves about 6-7 minutes on a
docs-only PR. No parallel job was added to the main path.
The cache quota is 10 GB (3.4 GB used before this PR). Saving the Next cache only from `main`
adds one entry per push to `main`; GitHub evicts the least recently used entries first.
