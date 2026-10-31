import { spawnSync } from 'node:child_process'

// CI checks the changed, committed files without rewriting its checkout.
const base = process.argv[2]
if (!base) throw new Error('Usage: pnpm check:commit-quality <base-commit> [head-commit]')
const head = process.argv[3] || 'HEAD'
const diff = spawnSync(
  'git',
  ['diff', '--name-only', '-z', '--diff-filter=ACMR', base, head, '--'],
  { encoding: 'utf8' },
)
if (diff.status !== 0) throw new Error(diff.stderr)
const files = diff.stdout.split('\0').filter(Boolean)
const scripts = files.filter((file) => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file))
const formatted = files.filter((file) =>
  /\.(?:[cm]?[jt]s|[jt]sx|css|scss|less|jsonc?|ya?ml|mdx?|html)$/.test(file),
)

function check(command, args, selected) {
  // Keep argument lists bounded; pass paths as arguments, never as shell code.
  for (let offset = 0; offset < selected.length; offset += 50) {
    const result = spawnSync(
      'pnpm',
      ['exec', command, ...args, '--', ...selected.slice(offset, offset + 50)],
      {
        stdio: 'inherit',
      },
    )
    if (result.status !== 0) process.exit(result.status || 1)
  }
}

check('oxlint', ['--no-error-on-unmatched-pattern'], scripts)
check('oxfmt', ['--check', '--no-error-on-unmatched-pattern'], formatted)
