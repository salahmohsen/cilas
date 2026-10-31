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
