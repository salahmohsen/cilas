import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const project = fileURLToPath(new URL('../', import.meta.url))
const env = {
  ...process.env,
  CI: '',
  LEFTHOOK: '',
  LEFTHOOK_EXCLUDE: '',
  LEFTHOOK_VERBOSE: '0',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Commit fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Commit fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
}

function run(cwd, command, args, overrides = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...env, ...overrides },
    encoding: 'utf8',
    timeout: 60_000,
  })
  return { ...result, output: `${result.stdout || ''}${result.stderr || ''}` }
}

function ok(cwd, command, args, overrides) {
  const result = run(cwd, command, args, overrides)
  assert.equal(result.status, 0, result.output)
  return result.stdout.trim()
}

function write(cwd, file, content) {
  mkdirSync(dirname(resolve(cwd, file)), { recursive: true })
  writeFileSync(resolve(cwd, file), content)
}

function read(cwd, file) {
  return readFileSync(resolve(cwd, file), 'utf8')
}

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'cilas commit hooks '))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const cwd = resolve(root, 'repo')
  mkdirSync(cwd)
  ok(cwd, 'git', ['init', '-b', 'main'])
  write(cwd, 'package.json', '{"type":"module","private":true}\n')
  write(cwd, '.gitignore', 'node_modules\n')
  write(cwd, 'unrelated.md', 'tracked baseline\n')
  symlinkSync(resolve(project, 'node_modules'), resolve(cwd, 'node_modules'), 'dir')
  for (const file of [
    'lefthook.yml',
    '.oxlintrc.json',
    '.oxfmtrc.json',
    'scripts/oxlint-plugin-cilas.mjs',
    'scripts/install-commit-hooks.mjs',
    'scripts/check-commit-quality.mjs',
  ]) {
    mkdirSync(dirname(resolve(cwd, file)), { recursive: true })
    copyFileSync(resolve(project, file), resolve(cwd, file))
  }
  ok(cwd, 'git', ['add', '.'])
  ok(cwd, 'git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'fixture baseline'])
  return { cwd, root }
}

function install(cwd, overrides) {
  return ok(cwd, process.execPath, ['scripts/install-commit-hooks.mjs'], overrides)
}

function commit(cwd) {
  return run(cwd, 'git', ['commit', '-m', 'fixture change'])
}

test('real hook fixes lint then formats route paths; stages only selected files', (t) => {
  const { cwd } = fixture(t)
  install(cwd)
  const path = 'src/app/(frontend)/[locale]/[[...slug]]/file with spaces.ts'
  write(cwd, path, 'let answer={value:42};\nexport {answer};\n')
  write(cwd, 'docs/file with spaces.md', '#   Hello\n\n-   one\n')
  write(cwd, 'scratch.ts', 'untracked and untouched')
  ok(cwd, 'git', ['add', '--', path, 'docs/file with spaces.md'])
  const result = commit(cwd)
  assert.equal(result.status, 0, result.output)
  const fixed = 'const answer = { value: 42 }\nexport { answer }\n'
  assert.equal(read(cwd, path), fixed)
  assert.equal(ok(cwd, 'git', ['show', `HEAD:${path}`]), fixed.trim())
  assert.equal(read(cwd, 'docs/file with spaces.md'), '# Hello\n\n- one\n')
  assert.equal(read(cwd, 'scratch.ts'), 'untracked and untouched')
  assert.equal(ok(cwd, 'git', ['status', '--short']), '?? scratch.ts')
})

for (const [name, content, diagnostic] of [
  ['syntax error', 'export const broken = ;\n', 'Unexpected token'],
  [
    'Client Component environment import',
    "'use client'\nimport { env } from '@/env'\nexport const publicValue = env.VALUE\n",
    'no-env-in-client-component',
  ],
]) {
  test(`real hook blocks ${name} and preserves index and working files`, (t) => {
    const { cwd } = fixture(t)
    install(cwd)
    write(cwd, 'src/broken.ts', content)
    write(cwd, 'unrelated.md', 'keep unstaged\n')
    ok(cwd, 'git', ['add', 'src/broken.ts'])
    const head = ok(cwd, 'git', ['rev-parse', 'HEAD'])
    const index = ok(cwd, 'git', ['write-tree'])
    const result = commit(cwd)
    assert.notEqual(result.status, 0, result.output)
    assert.ok(result.output.includes(diagnostic), result.output)
    assert.equal(ok(cwd, 'git', ['rev-parse', 'HEAD']), head)
    assert.equal(ok(cwd, 'git', ['write-tree']), index)
    assert.equal(read(cwd, 'src/broken.ts'), content)
    assert.equal(read(cwd, 'unrelated.md'), 'keep unstaged\n')
  })
}

function partial(cwd) {
  const path = 'src/app/(frontend)/[locale]/partial file.ts'
  const baseline = Array.from({ length: 24 }, (_, i) => `export const value${i} = ${i}\n`).join('')
  write(cwd, path, baseline)
  ok(cwd, 'git', ['add', '--', path])
  ok(cwd, 'git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'partial baseline'])
  const staged = baseline.replace('export const value0 = 0', 'export const value0={value:42};')
  write(cwd, path, staged)
  ok(cwd, 'git', ['add', '--', path])
  write(cwd, path, staged.replace('value23 = 23', 'value23 = 2300'))
  write(cwd, 'unrelated.md', 'untouched unstaged data\n')
  const result = commit(cwd)
  assert.equal(result.status, 0, result.output)
  const expected = baseline.replace(
    'export const value0 = 0',
    'export const value0 = { value: 42 }',
  )
  assert.equal(ok(cwd, 'git', ['show', `HEAD:${path}`]), expected.trim())
  assert.equal(read(cwd, path), expected.replace('value23 = 23', 'value23 = 2300'))
  assert.equal(ok(cwd, 'git', ['diff', '--cached']), '')
  assert.equal(read(cwd, 'unrelated.md'), 'untouched unstaged data\n')
}

test('partial staging preserves unstaged hunks while committing tool fixes', (t) => {
  const { cwd } = fixture(t)
  install(cwd)
  partial(cwd)
})

test('conflicting partial-stage restoration blocks commit without losing edits', (t) => {
  const { cwd } = fixture(t)
  install(cwd)
  write(cwd, 'src/conflict.ts', 'export const value = 1\n')
  ok(cwd, 'git', ['add', 'src/conflict.ts'])
  ok(cwd, 'git', ['commit', '-m', 'conflict baseline'])
  const staged = 'export const value={number:2};\n'
  const working = 'export const value={number:3};\n'
  write(cwd, 'src/conflict.ts', staged)
  ok(cwd, 'git', ['add', 'src/conflict.ts'])
  write(cwd, 'src/conflict.ts', working)
  write(cwd, 'unrelated.md', 'preserve this tracked unstaged edit\n')
  const head = ok(cwd, 'git', ['rev-parse', 'HEAD'])
  const result = commit(cwd)
  assert.notEqual(result.status, 0, result.output)
  assert.equal(ok(cwd, 'git', ['rev-parse', 'HEAD']), head)
  assert.equal(ok(cwd, 'git', ['show', ':src/conflict.ts']), staged.trim())
  assert.equal(read(cwd, 'src/conflict.ts'), working)
  assert.equal(read(cwd, 'unrelated.md'), 'preserve this tracked unstaged edit\n')
})

test('linked worktree gets isolated hooks and partial staging; older branch skips safely', (t) => {
  const { cwd, root } = fixture(t)
  ok(cwd, 'git', ['config', '--local', 'core.hooksPath', '.husky'])
  const linked = resolve(root, 'linked checkout')
  ok(cwd, 'git', ['worktree', 'add', '-b', 'feature', linked])
  symlinkSync(resolve(project, 'node_modules'), resolve(linked, 'node_modules'), 'dir')
  install(linked)
  install(linked)
  const dispatcherPath = ok(linked, 'git', ['config', '--worktree', '--get', 'core.hooksPath'])
  const dispatcher = read(linked, `${dispatcherPath}/pre-commit`)
  assert.equal(ok(cwd, 'git', ['config', '--get', 'core.hooksPath']), '.husky')
  assert.equal(ok(cwd, 'git', ['config', '--local', '--get', 'core.hooksPath']), '.husky')
  assert.ok(
    ok(linked, 'git', ['config', '--worktree', '--get', 'core.hooksPath']).includes('/worktrees/'),
  )
  partial(linked)
  assert.equal(read(linked, `${dispatcherPath}/pre-commit`), dispatcher)
  // Create an old branch without the config, while retaining its installed hook.
  ok(linked, 'git', ['checkout', '-b', 'legacy'])
  ok(linked, 'git', ['rm', 'lefthook.yml'])
  ok(linked, 'git', ['commit', '-m', 'older branch'], { LEFTHOOK: '0' })
  write(linked, 'src/legacy.ts', 'invalid syntax accepted by old branch\n')
  ok(linked, 'git', ['add', 'src/legacy.ts'])
  assert.equal(commit(linked).status, 0)
  // A sibling still using the stale path remains unaffected.
  write(cwd, 'sibling.txt', 'sibling\n')
  ok(cwd, 'git', ['add', 'sibling.txt'])
  assert.equal(commit(cwd).status, 0)
})

for (const configured of [true, false]) {
  test(`installer preserves ${configured ? 'custom hooksPath' : 'default hooks'} and every hook`, (t) => {
    const { cwd } = fixture(t)
    const directory = configured ? 'custom hooks' : '.git/hooks'
    if (configured) ok(cwd, 'git', ['config', 'core.hooksPath', directory])
    const hook = '#!/bin/sh\necho preserved\n'
    write(cwd, `${directory}/pre-push`, hook)
    const config = read(cwd, '.git/config')
    assert.match(install(cwd), /^$/) // Warning goes to stderr, not stdout.
    assert.equal(read(cwd, '.git/config'), config)
    assert.equal(read(cwd, `${directory}/pre-push`), hook)
    assert.ok(!existsSync(resolve(cwd, '.git/cilas-hooks')))
  })
}

test('installer preserves an explicitly empty hooksPath and modified dispatchers', (t) => {
  const { cwd } = fixture(t)
  ok(cwd, 'git', ['config', 'core.hooksPath', ''])
  install(cwd)
  assert.equal(ok(cwd, 'git', ['config', '--get', 'core.hooksPath']), '')
  assert.ok(!existsSync(resolve(cwd, '.git/cilas-hooks')))
  ok(cwd, 'git', ['config', '--unset', 'core.hooksPath'])
  install(cwd)
  const path = `${ok(cwd, 'git', ['config', '--get', 'core.hooksPath'])}/pre-commit`
  write(cwd, path, '#!/bin/sh\necho custom replacement\n')
  const result = run(cwd, process.execPath, ['scripts/install-commit-hooks.mjs'])
  assert.notEqual(result.status, 0)
  assert.match(result.output, /Refusing to replace another hook/)
  assert.equal(read(cwd, path), '#!/bin/sh\necho custom replacement\n')
})

test('configured checkout with missing dependencies blocks rather than silently skipping', (t) => {
  const { cwd } = fixture(t)
  install(cwd)
  rmSync(resolve(cwd, 'node_modules'))
  write(cwd, 'change.md', '# change\n')
  ok(cwd, 'git', ['add', 'change.md'])
  const result = commit(cwd)
  assert.notEqual(result.status, 0)
  assert.match(result.output, /run pnpm install/)
})

test('CI and opt-out skip installation; no-.git Docker context needs no Git executable', (t) => {
  const { cwd, root } = fixture(t)
  const config = read(cwd, '.git/config')
  install(cwd, { CI: 'true' })
  install(cwd, { LEFTHOOK: '0' })
  assert.equal(read(cwd, '.git/config'), config)
  const docker = resolve(root, 'docker')
  mkdirSync(docker)
  copyFileSync(resolve(cwd, 'scripts/install-commit-hooks.mjs'), resolve(docker, 'install.mjs'))
  ok(docker, process.execPath, ['install.mjs'], { PATH: '' })
})

test('generated and archival files stay unchanged; explicit skip permits a one-off commit', (t) => {
  const { cwd } = fixture(t)
  install(cwd)
  const files = [
    'src/payload-types.ts',
    'src/migrations/example.ts',
    'public/assets/visual-editor/vendor.js',
    'migration/extracted/data.json',
    'seed/data/archive/data.json',
  ]
  for (const file of files)
    write(cwd, file, file.endsWith('.json') ? '{"a":1}' : 'export const x={a:1};\n')
  ok(cwd, 'git', ['add', '--', ...files])
  const index = ok(cwd, 'git', ['write-tree'])
  const result = commit(cwd)
  assert.equal(result.status, 0, result.output)
  assert.equal(ok(cwd, 'git', ['rev-parse', 'HEAD^{tree}']), index)
  write(cwd, 'src/skipped.ts', 'export const broken = ;\n')
  ok(cwd, 'git', ['add', 'src/skipped.ts'])
  ok(cwd, 'git', ['commit', '-m', 'explicit skip'], { LEFTHOOK: '0' })
})

test('CI checker rejects unformatted committed content without writing fixes', (t) => {
  const { cwd } = fixture(t)
  const base = ok(cwd, 'git', ['rev-parse', 'HEAD'])
  const path = 'src/app/(frontend)/[locale]/ci file.ts'
  const content = 'export const value={number:42};\n'
  write(cwd, path, content)
  ok(cwd, 'git', ['add', '--', path])
  ok(cwd, 'git', ['commit', '-m', 'bypass local hooks'])
  const result = run(cwd, process.execPath, ['scripts/check-commit-quality.mjs', base])
  assert.notEqual(result.status, 0, result.output)
  assert.ok(result.output.includes('Format issues found'), result.output)
  assert.equal(read(cwd, path), content)
  assert.equal(ok(cwd, 'git', ['status', '--short']), '')
})
