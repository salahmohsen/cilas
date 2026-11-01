# Commit checks

Run `pnpm install --frozen-lockfile` after cloning or opening a linked T3 worktree.
The root `prepare` script installs this checkout's hook. If install scripts were
disabled, run `pnpm hooks:install` afterward. Lefthook is pinned to 2.2.2; its own
dependency postinstall is disabled in pnpm so it cannot install shared hooks before
our installer runs. Use pnpm for dependency installation.

The pre-commit hook checks staged JS/TS with Oxlint (`.oxlintrc.json`) and
ordinary automatic fixes, then formats those files with Oxfmt (`.oxfmtrc.json`).
The local rule in `scripts/oxlint-plugin-cilas.mjs` runs as an Oxlint JS plugin. Staged CSS, SCSS, Less,
JSON/JSONC, YAML, Markdown/MDX and HTML receive formatting. The two file groups run
sequentially. Warnings remain warnings; unfixable lint and parsing errors block the
commit, including Client Components importing `@/env` instead of `@/env.client`.

Lefthook stages fixes only for the selected files. It hides unstaged hunks in
partially staged files while checks run, then restores them. Formatting applies to
the selected staged version of the whole file, not only the selected lines. If
restoring unstaged edits would conflict with the fixes, the commit fails and the
original staging and working edits are restored. Review the diff and resolve the
overlap before retrying. No pre-commit hook runs full tests, type checks, builds or services.

`.oxfmtrc.json` `ignorePatterns` exclude generated Payload types/schema/import maps, migrations,
vendored editor bundles, build/test output, the lockfile and imported archival
data. It leaves migration scripts and documentation eligible. This setup does not
format the existing repository or require its warning baseline to be cleaned up.

## Pre-push check

`git push` runs a second Lefthook hook, `pre-push`, in about 5 seconds. It takes every
file this branch changes against `origin/main` (the same view CI uses) and runs
`oxlint` and `oxfmt --check` on them. If the change includes TypeScript or JSON it
also runs `tsgo --noEmit` for the whole project. It never fixes files, so a pushed
commit is exactly what you committed. It catches the errors that otherwise cost a
CI round trip. Skip it once with `LEFTHOOK=0 git push`. The installer writes the
`pre-push` dispatcher next to `pre-commit`, with the same safeguards.

## Git worktrees and existing hooks

The installer enables Git's `extensions.worktreeConfig` and sets `core.hooksPath`
only in this checkout's `config.worktree`. The dispatcher lives in this checkout's
Git metadata directory, under `cilas-hooks/`. Git 2.20 or newer is required.

The existing shared `core.hooksPath=.husky` is retained. A missing `.husky` is
bypassed only for the checkout being installed; sibling checkouts keep their
existing configuration. No shared hooks are written or removed. The dispatcher
skips older branches that lack `lefthook.yml` or the installer. A configured branch
without dependencies instead asks you to install them and blocks the commit.

Custom configured hook directories, existing default hooks (including hooks other
than pre-commit), and modified dispatchers are preserved. The installer warns and
leaves custom hooks alone. To integrate manually, call
`pnpm exec lefthook run pre-commit` from your existing pre-commit hook and propagate
its exit status. Special `core.worktree`/bare configurations require manual setup
instead of an implicit shared-config migration.

To remove the override, run `git config --worktree --unset core.hooksPath`; this
restores the inherited setting, which may still be the stale `.husky` path. Keep
the shared worktree-config extension enabled because other worktrees may use it.
If you relocate the Git metadata, remove that checkout's old override and rerun
`pnpm hooks:install` to refresh the absolute path.

## Opt-out and CI

Use `LEFTHOOK=0 git commit ...` to skip checks once, or `git commit --no-verify` to
skip Git's pre-commit hook. `LEFTHOOK=0 pnpm install` skips hook installation. CI
skips installation automatically. A source/Docker context without `.git` also
skips it, without requiring a Git executable. Docker copies the prepare script
before dependency installation for this reason. No production environment is
needed for installation or these checks.

CI runs `pnpm test:commit-hooks` against disposable Git repositories and linked
worktrees, using the actual pinned tools and hooks. It also runs
`pnpm check:commit-quality <base-sha>` against changed committed files without
fixing them. Existing full lint, type, unit and production checks remain separate.
Commitlint is optional and is not installed.
