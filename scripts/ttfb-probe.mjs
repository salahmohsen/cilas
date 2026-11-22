// TTFB probe: sequential curl requests per role against a running production server.
// Usage: node scripts/ttfb-probe.mjs --base http://localhost:3100 --path /en/spaces \
//   --cookies <file> [--warmup 5] [--samples 30]
// <file> is JSON { "<role>": "<payload-token cookie value>" }. Prints one JSON line per role.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

// Nearest rank: with 30 samples, p75 is the 23rd value.
export const p = (sorted, q) => sorted[Math.ceil(q * sorted.length) - 1]

const selfTest = () => {
  const thirty = Array.from({ length: 30 }, (_, i) => i + 1)
  const checks = [
    [p(thirty, 0.75), 23],
    [p([5], 0.75), 5],
  ]
  const bad = checks.filter(([got, want]) => got !== want)
  if (bad.length) {
    console.error(`self-test failed: ${JSON.stringify(bad)}`)
    process.exit(1)
  }
  console.log('self-test passed')
}

const ms = (seconds) => Math.round(Number(seconds) * 1000)

const request = (url, cookie, bodyFile) => {
  const args = [
    '-s',
    '-o',
    bodyFile ?? '/dev/null',
    '-w',
    '%{http_code} %{time_starttransfer} %{time_total}',
  ]
  args.push('-H', `Cookie: payload-token=${cookie}`, url)
  const [status, ttfb, total] = execFileSync('curl', args, { encoding: 'utf8' }).trim().split(' ')
  return { status: Number(status), ttfb: ms(ttfb), total: ms(total) }
}

const probeRole = ({ role, cookie, url, pathname, warmup, samples, scratch }) => {
  for (let i = 0; i < warmup; i++) {
    const { status } = request(url, cookie)
    if (status !== 200) fail(role, status)
  }
  const bodyFile = path.join(
    scratch,
    `ttfb-${role}-${pathname.split('/').filter(Boolean).join('-')}.html`,
  )
  const recorded = []
  for (let i = 0; i < samples; i++) {
    const r = request(url, cookie, i === 0 ? bodyFile : undefined)
    if (r.status !== 200) fail(role, r.status)
    if (i === 0 && !readFileSync(bodyFile, 'utf8').includes('data-page="spaces"')) {
      console.error(`${role}: 200 but the body has no data-page="spaces" (${bodyFile})`)
      process.exit(1)
    }
    recorded.push([r.ttfb, r.total])
  }
  const ttfbs = recorded.map((s) => s[0]).sort((a, b) => a - b)
  const totals = recorded.map((s) => s[1]).sort((a, b) => a - b)
  return {
    role,
    samples: recorded,
    p50: p(ttfbs, 0.5),
    p75: p(ttfbs, 0.75),
    p95: p(ttfbs, 0.95),
    totalP75: p(totals, 0.75),
  }
}

const fail = (role, status) => {
  console.error(`${role}: status ${status} (a redirect to login means the cookie failed)`)
  process.exit(1)
}

const main = () => {
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      path: { type: 'string' },
      cookies: { type: 'string' },
      warmup: { type: 'string', default: '5' },
      samples: { type: 'string', default: '30' },
      'self-test': { type: 'boolean' },
    },
  })
  if (values['self-test']) return selfTest()
  if (!values.base || !values.path || !values.cookies) {
    console.error('need --base, --path and --cookies')
    process.exit(2)
  }
  const cookies = JSON.parse(readFileSync(values.cookies, 'utf8'))
  const scratch = mkdtempSync(path.join(tmpdir(), 'ttfb-'))
  for (const [role, cookie] of Object.entries(cookies)) {
    const result = probeRole({
      role,
      cookie,
      url: values.base + values.path,
      pathname: values.path,
      warmup: Number(values.warmup),
      samples: Number(values.samples),
      scratch,
    })
    console.log(JSON.stringify(result))
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
