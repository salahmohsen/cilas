// TTFB probe: sequential curl requests per role against a running production server.
// Usage: node scripts/ttfb-probe.mjs --base http://localhost:3100 --path /en/spaces \
//   --cookies <file> [--warmup 5] [--samples 30] [--scratch <dir>]
// <file> is JSON { "<role>": "<payload-token cookie value>" }. Prints one JSON line per role.
// --base must be a local server. Each line carries bodyFile: the saved HTML of the first
// (unrecorded) request, in --scratch <dir> (default: a new temp dir). Later plan steps read the
// page from that path. The cookie goes to curl on stdin, never on the command line.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

// Nearest rank: with 30 samples, p75 is the 23rd value.
const p = (sorted, q) => sorted[Math.ceil(q * sorted.length) - 1]

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

const isLocalBase = (base) => {
  try {
    return LOCAL_HOSTS.has(new URL(base).hostname)
  } catch {
    return false
  }
}

const die = (message, code = 1) => {
  console.error(message)
  process.exit(code)
}

const int = (value, name, min) => {
  const n = Number(value)
  if (value === '' || !Number.isInteger(n) || n < min)
    die(`${name} must be an integer >= ${min}`, 2)
  return n
}

const redact = (text, secret) => text.split(secret).join('***')

const selfTest = () => {
  const thirty = Array.from({ length: 30 }, (_, i) => i + 1)
  const checks = [
    [p(thirty, 0.5), 15],
    [p(thirty, 0.75), 23],
    [p(thirty, 0.95), 29],
    [p([1, 2, 3, 4], 0.75), 3],
    [p([5], 0.75), 5],
    [isLocalBase('http://localhost:3100'), true],
    [isLocalBase('http://127.0.0.1:3100'), true],
    [isLocalBase('http://[::1]:3100'), true],
    [isLocalBase('https://localhost.evil.com'), false],
    [isLocalBase('https://cilas.example'), false],
    [isLocalBase('not a url'), false],
    [int('7', 'x', 1), 7],
    [redact('curl failed: payload-token=abc.def x', 'abc.def'), 'curl failed: payload-token=*** x'],
  ]
  // A real curl failure (port 1 refuses) must not leak the cookie into the message.
  let leaked = 'no error'
  try {
    request('http://127.0.0.1:1/', 'SECRET.cookie-1')
  } catch (e) {
    leaked = e.message.includes('SECRET.cookie-1') ? 'leaked' : 'clean'
  }
  checks.push([leaked, 'clean'])
  for (const arg of [
    ['--samples', 'abc'],
    ['--samples', '0'],
    ['--warmup=-1'],
    ['--warmup', '1.5'],
  ]) {
    const r = spawnSync(
      process.execPath,
      [
        fileURLToPath(import.meta.url),
        ...arg,
        '--base',
        'http://localhost',
        '--path',
        '/',
        '--cookies',
        '/dev/null',
      ],
      { encoding: 'utf8' },
    )
    checks.push([`${arg.join(' ')} -> exit ${r.status}`, `${arg.join(' ')} -> exit 2`])
  }
  const prod = spawnSync(
    process.execPath,
    [
      fileURLToPath(import.meta.url),
      '--base',
      'https://example.org',
      '--path',
      '/',
      '--cookies',
      '/dev/null',
    ],
    { encoding: 'utf8' },
  )
  checks.push([`remote base -> exit ${prod.status}`, 'remote base -> exit 2'])
  const bad = checks.filter(([got, want]) => got !== want)
  if (bad.length) die(`self-test failed: ${JSON.stringify(bad)}`)
  console.log('self-test passed')
}

const ms = (seconds) => Math.round(Number(seconds) * 1000)

const request = (url, cookie, bodyFile) => {
  const args = [
    '-sS',
    '--max-time',
    '30',
    '-K',
    '-',
    '-o',
    bodyFile ?? '/dev/null',
    '-w',
    '%{http_code} %{time_starttransfer} %{time_total}',
    url,
  ]
  let out
  try {
    out = execFileSync('curl', args, {
      input: `header = "Cookie: payload-token=${cookie}"\n`,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    // Never print e.message: Node puts the full command in it.
    throw new Error(redact(`curl failed (exit ${e.status}): ${String(e.stderr).trim()}`, cookie))
  }
  const [status, ttfb, total] = out.trim().split(' ')
  return { status: Number(status), ttfb: ms(ttfb), total: ms(total) }
}

const fail = (role, status) =>
  die(`${role}: status ${status} (a redirect to login means the cookie failed)`)

const probeRole = ({ role, cookie, url, pathname, warmup, samples, scratch }) => {
  const bodyFile = path.join(
    scratch,
    `ttfb-${role}-${pathname.split('/').filter(Boolean).join('-')}.html`,
  )
  // The first request saves the body and is never recorded, so every recorded sample is alike.
  for (let i = 0; i < Math.max(warmup, 1); i++) {
    const { status } = request(url, cookie, i === 0 ? bodyFile : undefined)
    if (status !== 200) fail(role, status)
    if (i === 0 && !readFileSync(bodyFile, 'utf8').includes('data-page="spaces"')) {
      die(`${role}: 200 but the body has no data-page="spaces" (${bodyFile})`)
    }
  }
  const recorded = []
  for (let i = 0; i < samples; i++) {
    const r = request(url, cookie)
    if (r.status !== 200) fail(role, r.status)
    recorded.push([r.ttfb, r.total])
  }
  const ttfbs = recorded.map((s) => s[0]).sort((a, b) => a - b)
  const totals = recorded.map((s) => s[1]).sort((a, b) => a - b)
  return {
    role,
    bodyFile,
    samples: recorded,
    p50: p(ttfbs, 0.5),
    p75: p(ttfbs, 0.75),
    p95: p(ttfbs, 0.95),
    totalP75: p(totals, 0.75),
  }
}

const main = () => {
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      path: { type: 'string' },
      cookies: { type: 'string' },
      warmup: { type: 'string', default: '5' },
      samples: { type: 'string', default: '30' },
      scratch: { type: 'string' },
      'self-test': { type: 'boolean' },
    },
  })
  if (values['self-test']) return selfTest()
  if (!values.base || !values.path || !values.cookies) die('need --base, --path and --cookies', 2)
  if (!isLocalBase(values.base)) die('--base must be localhost, 127.0.0.1 or [::1]', 2)
  const warmup = int(values.warmup, '--warmup', 0)
  const samples = int(values.samples, '--samples', 1)
  const cookies = JSON.parse(readFileSync(values.cookies, 'utf8'))
  for (const cookie of Object.values(cookies)) {
    if (!/^[\w.-]+$/.test(cookie)) die('a cookie value is not a plain token', 2)
  }
  let scratch = values.scratch
  if (scratch) mkdirSync(scratch, { recursive: true })
  else scratch = mkdtempSync(path.join(tmpdir(), 'ttfb-'))
  for (const [role, cookie] of Object.entries(cookies)) {
    const result = probeRole({
      role,
      cookie,
      url: values.base + values.path,
      pathname: values.path,
      warmup,
      samples,
      scratch,
    })
    console.log(JSON.stringify(result))
  }
}

try {
  main()
} catch (e) {
  die(e.message)
}
