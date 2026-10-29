import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const hook = `#!/bin/sh
# CILAS per-worktree Lefthook dispatcher v1
[ "\$LEFTHOOK" = "0" ] && exit 0
# Older branches/checkouts can lack this feature.
[ -f lefthook.yml ] && [ -f scripts/install-commit-hooks.mjs ] || exit 0
if [ ! -f node_modules/lefthook/bin/index.js ]; then
  echo 'CILAS commit checks: run pnpm install (or LEFTHOOK=0 to skip once).' >&2
  exit 1
fi
exec node node_modules/lefthook/bin/index.js run pre-commit "\$@"
`

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

  const gitDir = git('rev-parse', '--absolute-git-dir')
  const hooksDir = resolve(gitDir, 'cilas-hooks')
  const hookPath = resolve(hooksDir, 'pre-commit')
  const currentPath = optionalConfig('--get', 'core.hooksPath')
  const defaultPath = resolve(git('rev-parse', '--git-common-dir'))
  const currentDir = currentPath !== null ? resolve(currentPath) : resolve(defaultPath, 'hooks')

  // A hooksPath override would disable other hooks, even if pre-commit is absent.
  if (currentDir !== hooksDir) {
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

  if (existsSync(hookPath) && readFileSync(hookPath, 'utf8') !== hook) {
    throw new Error(`Refusing to replace another hook: ${hookPath}`)
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
  writeFileSync(hookPath, hook, { mode: 0o755 })
  git('config', '--worktree', 'core.hooksPath', hooksDir)
  console.log(`CILAS commit hooks installed for this checkout: ${hooksDir}`)
}

install()
