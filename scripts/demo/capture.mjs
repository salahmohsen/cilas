// Records the demo's shots with agent-browser, against the server from scripts/demo/serve-demo.sh.
// Writes video/public/clips/<shot>.mp4 and, per shot, its length and camera moves to video/src/clips.json.
// Usage: node scripts/demo/capture.mjs [shot,shot...]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { shots } from './shots.mjs'

const BASE = 'http://localhost:3100'
const VIEW = { width: 1600, height: 900 }
const ROOT = path.resolve(import.meta.dirname, '../..')
const CLIPS = path.join(ROOT, 'video/public/clips')
const MANIFEST = path.join(ROOT, 'video/src/clips.json')
const HELPERS = path.join(import.meta.dirname, 'page-helpers.js')
const ONLY = process.argv[2]?.split(',')
const accounts = {
  admin: ['user1@demo.invalid', 'demo-admin-pass'],
  fellow: ['user3@demo.invalid', 'demo-fellow-pass'],
  member: ['user33@demo.invalid', 'demo-member-pass'],
}

const ab = (role, args, input) => {
  try {
    return execFileSync('agent-browser', ['--session', `cilas-demo-${role}`, ...args], {
      encoding: 'utf8',
      input,
      timeout: 240_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    throw new Error(`${args.slice(0, 3).join(' ')}: ${String(error.stderr || error.stdout).trim()}`)
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const js = (role, code) => {
  const out = JSON.parse(ab(role, ['eval', '--json', '--stdin'], code))
  if (!out.success) throw new Error(out.error)
  return out.data.result
}

// Spaces and the admin keep live connections open, so a page never goes network-idle.
const settle = async (role) => {
  ab(role, ['wait', '--load', 'load'])
  await sleep(1500)
}

const launched = new Set()
const browserFor = async (role) => {
  if (launched.has(role)) return
  try {
    ab(role, ['close'])
  } catch {}
  const launch = [
    '--init-script',
    HELPERS,
    '--args',
    `--force-device-scale-factor=2,--window-size=${VIEW.width},${VIEW.height + 143}`,
    'open',
    `${BASE}/en/login`,
  ]
  try {
    ab(role, launch)
  } catch {
    await sleep(3000)
    ab(role, ['open', `${BASE}/en/login`])
  }
  const size = js(role, 'innerWidth + "x" + innerHeight')
  if (size !== `${VIEW.width}x${VIEW.height}`) throw new Error(`viewport is ${size}`)
  await settle(role)
  if (accounts[role]) {
    const [email, password] = accounts[role]
    ab(role, ['find', 'label', 'Email', 'fill', email])
    ab(role, ['find', 'label', 'Password', 'fill', password])
    ab(role, ['find', 'role', 'button', 'click', '--name', 'Sign in'])
    await sleep(6000)
  }
  launched.add(role)
}

const record = async ({ id, role, theme, url, steps }) => {
  await browserFor(role)
  ab(role, ['set', 'media', theme])
  try {
    ab(role, ['open', BASE + url])
  } catch {
    // A page's first compile on the dev server can outlast the daemon's read.
    await sleep(15000)
  }
  await settle(role)
  js(role, `document.querySelector('[aria-label="Dismiss"]')?.click(); true`)
  await sleep(900)
  ab(role, ['mouse', 'move', String(VIEW.width * 0.62), String(VIEW.height * 0.55)])

  const file = path.join(CLIPS, `${id}.mp4`)
  ab(role, ['record', 'start', file, '--cursor', '--fps', '30'])
  const start = Date.now()
  const now = () => Number(((Date.now() - start) / 1000).toFixed(2))
  const camera = [{ t: 0, z: 1, x: 0.5, y: 0.5 }]
  let zoomed = false
  const push = (z, x, y) => {
    camera.push({ t: now(), z, x: x / VIEW.width, y: y / VIEW.height })
    zoomed = z > 1
  }

  const page = {
    wait: sleep,
    eval: (code) => js(role, code),
    press: (key) => ab(role, ['press', key]),
    async type(text) {
      for (const word of text.split(/(?<= )/)) {
        ab(role, ['keyboard', 'type', word])
        await sleep(60)
      }
    },
    async release() {
      if (!zoomed) return
      push(1, VIEW.width / 2, VIEW.height / 2)
      await sleep(800)
    },
    async move(spec) {
      const target = JSON.stringify(spec)
      if (!js(role, `__demo.reveal(${target})`)) throw new Error(`not found: ${target}`)
      await sleep(900)
      const box = js(role, `__demo.box(${target})`)
      ab(role, [
        'mouse',
        'move',
        String(box.x),
        String(box.y),
        '--duration',
        '650',
        '--steps',
        '26',
      ])
      return box
    },
    async focus(spec, zoom = 1.5, hold = 1600) {
      await this.release()
      const box = await this.move(spec)
      push(zoom, box.x, box.y)
      await sleep(900 + hold)
    },
    async click(spec, { zoom = 1.35, hold = false, settle = 1300 } = {}) {
      const box = await this.move(spec)
      if (zoom > 1) push(zoom, box.x, box.y)
      await sleep(zoom > 1 ? 800 : 250)
      ab(role, ['mouse', 'down'])
      ab(role, ['mouse', 'up'])
      await sleep(settle)
      if (!hold) await this.release()
    },
    async drag(spec, dx, dy, zoom = 1.3) {
      const box = await this.move(spec)
      push(zoom, box.x + dx / 2, box.y + dy / 2)
      await sleep(900)
      ab(role, ['mouse', 'down'])
      const to = [String(box.x + dx), String(box.y + dy)]
      ab(role, ['mouse', 'move', ...to, '--duration', '1100', '--steps', '40'])
      ab(role, ['mouse', 'up'])
      await sleep(1200)
    },
    async scroll(pixels, pause = 900) {
      await this.release()
      const steps = 24
      for (let i = 0; i < steps; i++) ab(role, ['mouse', 'wheel', String(pixels / steps)])
      await sleep(pause)
    },
  }

  try {
    await steps(page)
  } catch (error) {
    ab(role, ['screenshot', path.join(CLIPS, `${id}.failed.png`)])
    throw error
  } finally {
    await page.release()
    await sleep(400)
    ab(role, ['record', 'stop'])
  }
  return { camera }
}

// A clip's length is the file's, so the film never plays past the end of a recording.
const probe = (id) =>
  Number(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        path.join(CLIPS, `${id}.mp4`),
      ],
      {
        encoding: 'utf8',
      },
    ),
  )

mkdirSync(CLIPS, { recursive: true })
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}
const failed = []
for (const shot of shots) {
  if (ONLY && !ONLY.includes(shot.id)) continue
  try {
    manifest[shot.id] = await record(shot)
    manifest[shot.id].seconds = probe(shot.id)
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n')
    console.log(`ok ${shot.id} ${manifest[shot.id].seconds}s`)
  } catch (error) {
    failed.push(shot.id)
    console.log(`FAILED ${shot.id}: ${String(error.message).split('\n')[0]}`)
  }
}
for (const role of launched) ab(role, ['close'])
process.exitCode = failed.length ? 1 : 0
