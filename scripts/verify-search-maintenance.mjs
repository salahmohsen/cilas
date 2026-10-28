import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'

assert.equal(
  process.env.DATABASE_URL,
  'postgres://search_test:disposable@localhost:55439/cilas_search_test',
  'Maintenance verification requires the explicitly disposable test database',
)
const build = spawnSync(process.execPath, ['scripts/build-search-maintenance.mjs'], {
  stdio: 'inherit',
})
assert.equal(build.status, 0)
const temporary = await mkdtemp(path.join(tmpdir(), 'cilas-search-runtime-'))
try {
  await cp('.maintenance', temporary, { recursive: true, verbatimSymlinks: true })
  const run = (command, env = process.env) =>
    spawnSync(process.execPath, ['--conditions=production', 'run.mjs', command], {
      cwd: temporary,
      env,
      encoding: 'utf8',
    })
  const invalid = run('invalid')
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /Expected work, rebuild, prune or status/)
  const status = run('status')
  assert.equal(status.status, 1)
  const line = status.stdout.split('\n').find((line) => line.startsWith('{"pending":'))
  assert.ok(line, 'Relocated maintenance artifact must connect and return sanitized queue metrics')
  assert.equal(JSON.parse(line).initialized, false)
  const unapproved = run('rebuild', {
    ...process.env,
    PRIVATE_SPACES_SEARCH_KEYS_VERIFIED: 'false',
  })
  assert.equal(unapproved.status, 1)
  assert.match(unapproved.stderr, /Private search maintenance failed/)
  console.info(
    'Relocated maintenance artifact connects to disposable Postgres and refuses unapproved indexing.',
  )
} finally {
  await rm(temporary, { recursive: true, force: true })
}
