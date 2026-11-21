import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

// One dispatcher per Git hook. Every text ever shipped stays in `dispatcherTexts`
// so an old install is recognised and upgraded, not refused as "another hook".
// The dispatcher lives in the shared Git directory, so one copy serves every
// worktree. A worktree without node_modules (agent worktrees never run
// `pnpm install`) borrows the main checkout's install and its .bin on PATH, and
// skips the checks that resolve packages from the worktree (lint, typecheck).
const hooks = ['pre-commit', 'pre-push']
const dispatcherV1 = (name) => `#!/bin/sh
# CILAS per-worktree Lefthook dispatcher v1
[ "\$LEFTHOOK" = "0" ] && exit 0
# Older branches/checkouts can lack this feature.
[ -f lefthook.yml ] && [ -f scripts/install-commit-hooks.mjs ] || exit 0
if [ ! -f node_modules/lefthook/bin/index.js ]; then
  echo 'CILAS commit checks: run pnpm install (or LEFTHOOK=0 to skip once).' >&2
  exit 1
fi
exec node node_modules/lefthook/bin/index.js run ${name} "\$@"
`
const dispatcher = (name) => `#!/bin/sh
# CILAS per-worktree Lefthook dispatcher v2
[ "\$LEFTHOOK" = "0" ] && exit 0
# Older branches/checkouts can lack this feature.
[ -f lefthook.yml ] && [ -f scripts/install-commit-hooks.mjs ] || exit 0
root=.
if [ ! -f node_modules/lefthook/bin/index.js ]; then
  common=\$(cd "\$(git rev-parse --git-common-dir)" 2>/dev/null && pwd)
  root=\$(dirname "\$common")
  if [ ! -f "\$root/node_modules/lefthook/bin/index.js" ]; then
    echo 'CILAS commit checks: run pnpm install (or LEFTHOOK=0 to skip once).' >&2
    exit 1
  fi
  PATH="\$root/node_modules/.bin:\$PATH"
  # Oxlint JS plugins and tsgo resolve packages from this worktree, which has none.
  LEFTHOOK_EXCLUDE="lint,typecheck\${LEFTHOOK_EXCLUDE:+,\$LEFTHOOK_EXCLUDE}"
  export PATH LEFTHOOK_EXCLUDE
  echo 'CILAS commit checks: no node_modules here; formatting only (lint and typecheck need pnpm install).' >&2
fi
exec node "\$root/node_modules/lefthook/bin/index.js" run ${name} "\$@"
`
const dispatcherTexts = (name) => [dispatcherV1(name), dispatcher(name)]

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`)
  return result.stdout.trim()
}

function optionalConfig(...args) {
  const result = spawnSync('git', ['config', ...args], { encoding: 'utf8' })
  if (result.status === 1) return null
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}

function install() {
  if (process.env.CI || process.env.LEFTHOOK === '0' || !existsSync('.git')) return
  if (!existsSync('lefthook.yml')) return

  const defaultPath = resolve(git('rev-parse', '--git-common-dir'))
  const hooksDir = resolve(defaultPath, 'cilas-hooks')
  const hookPaths = hooks.map((name) => ({
    name,
    path: resolve(hooksDir, name),
    text: dispatcher(name),
  }))
  const currentPath = optionalConfig('--get', 'core.hooksPath')
  const currentDir = currentPath !== null ? resolve(currentPath) : resolve(defaultPath, 'hooks')

  // A hooksPath override would disable other hooks, even if pre-commit is absent.
  // Older installs put the dispatcher in each worktree's own metadata directory.
  const ours = currentDir === hooksDir || basename(currentDir) === 'cilas-hooks'
  if (!ours) {
    const staleHusky = currentPath === '.husky' && !existsSync(currentDir)
    const defaultIsUnused =
      currentPath === null &&
      (!existsSync(currentDir) || readdirSync(currentDir).every((name) => name.endsWith('.sample')))
    if (!staleHusky && !defaultIsUnused) {
      console.warn(
        `CILAS: preserving custom hooks at ${currentDir}. Chain "pnpm exec lefthook run pre-commit" from your hook; see docs/commit-checks.md.`,
      )
      return
    }
  }

  for (const { name, path } of hookPaths) {
    if (existsSync(path) && !dispatcherTexts(name).includes(readFileSync(path, 'utf8'))) {
      throw new Error(`Refusing to replace another hook: ${path}`)
    }
  }

  // Enabling worktree config changes where these special values are read.
  // Ordinary clones have core.bare=false and no core.worktree; leave unusual
  // repositories alone rather than migrate their shared settings implicitly.
  if (optionalConfig('--local', '--get', 'extensions.worktreeConfig') !== 'true') {
    if (
      optionalConfig('--local', '--get', 'core.worktree') ||
      optionalConfig('--local', '--get', 'core.bare') === 'true'
    ) {
      throw new Error('Custom core.worktree/bare setup: chain Lefthook from your existing hooks.')
    }
    git('config', '--local', 'extensions.worktreeConfig', 'true')
  }

  mkdirSync(hooksDir, { recursive: true })
  for (const { path, text } of hookPaths) writeFileSync(path, text, { mode: 0o755 })
  git('config', '--worktree', 'core.hooksPath', hooksDir)
  // With no shared hooksPath, set it so a worktree made later (git worktree add,
  // the T3 app) gets the hook with no install step. A custom shared value stays.
  if (optionalConfig('--local', '--get', 'core.hooksPath') === null) {
    git('config', '--local', 'core.hooksPath', hooksDir)
  }
  console.log(`CILAS commit hooks installed for this checkout: ${hooksDir}`)
}

install()
