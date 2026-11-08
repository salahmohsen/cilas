// Builds the film: node scripts/demo/compose.mjs <recordings-dir> <output-dir>
// Removes page loads, adds camera pushes and captions, renders title cards, then joins everything.
import { spawn } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const [IN, OUT] = process.argv.slice(2)
const WORK = path.join(IN, '_work')
const FPS = 30
const SIZE = { width: 1440, height: 900 }
const BASE = 'http://localhost:3000'
const here = path.dirname(new URL(import.meta.url).pathname)

const CHAPTERS = {
  '01-public': {
    number: '01',
    title: 'Discover',
    sub: 'Courses, events and open registration, in two languages',
    color: '#ffb11b',
    ink: '#111',
  },
  '02-apply': {
    number: '02',
    title: 'Apply',
    sub: 'Application forms built in the CMS',
    color: '#14d18c',
    ink: '#111',
  },
  '03-spaces': {
    number: '03',
    title: 'Belong',
    sub: 'A private space for every course and cohort',
    color: '#2f6fe4',
    ink: '#fff',
  },
  '04-fellow': {
    number: '04',
    title: 'Moderate',
    sub: 'Fellows keep the conversation well',
    color: '#ff7aa2',
    ink: '#111',
  },
  '05-admin': {
    number: '05',
    title: 'Run the institute',
    sub: 'One CMS for teaching, people and publishing',
    color: '#111',
    ink: '#fff',
  },
}

const run = (cmd, args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'inherit'] })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.on('close', (code) =>
      code ? reject(new Error(`${cmd} exited ${code}`)) : resolve(out.trim()),
    )
    if (input) input(child.stdin)
  })
const duration = async (file) =>
  Number(
    await run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      file,
    ]),
  )
const n = (v) => Number(v.toFixed(3))

/** Eased sum of steps, so each camera move starts from where the last one ended. */
const track = (keys, initial, pick) => {
  let value = initial
  const terms = [String(initial)]
  for (const key of keys) {
    const next = pick(key)
    const delta = n(next - value)
    value = next
    if (!delta) continue
    const u = `clip((in/${FPS}-${n(key.t)})/${n(key.duration)},0,1)`
    terms.push(`${delta}*(${u})^3*(${u}*(${u}*6-15)+10)`)
  }
  return terms.join('+')
}

const browser = await chromium.launch()
await rm(WORK, { recursive: true, force: true })
await mkdir(WORK, { recursive: true })

const logo = `data:image/webp;base64,${(await readFile('public/assets/images/logo.webp')).toString('base64')}`
const script = await readFile(path.join(here, 'cards.js'), 'utf8')
const page = await (await browser.newContext({ viewport: SIZE })).newPage()
await page.goto(`${BASE}/en`, { waitUntil: 'load', timeout: 150000 })
await page.waitForTimeout(4000)
const site = await page.evaluate(() => {
  const text = document.body.innerText
  const stat = (label) => Number(text.match(new RegExp(`${label}\\D*(\\d+)`))?.[1] ?? 0)
  return {
    serif: getComputedStyle(document.querySelector('h1,h2')).fontFamily.replaceAll('"', "'"),
    sans: getComputedStyle(document.body).fontFamily.replaceAll('"', "'"),
    stats: [
      { value: stat('Years of teaching'), label: 'Years of teaching' },
      { value: stat('Courses'), label: 'Courses' },
      { value: stat('Fellows'), label: 'Fellows' },
    ],
  }
})

const renderCard = async (name, seconds, props) => {
  await page.goto(`${BASE}/en`, { waitUntil: 'load', timeout: 150000 })
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
  await page.addScriptTag({ content: script })
  await page.evaluate((p) => window.mountFilm(p), {
    ...props,
    logo,
    serif: site.serif,
    sans: site.sans,
  })
  await page.waitForTimeout(500)
  const file = path.join(WORK, `${name}.mp4`)
  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-y',
      '-v',
      'error',
      '-f',
      'image2pipe',
      '-framerate',
      String(FPS),
      '-vcodec',
      'mjpeg',
      '-i',
      '-',
      '-c:v',
      'libx264',
      '-crf',
      '16',
      '-preset',
      'fast',
      '-pix_fmt',
      'yuv420p',
      file,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  for (let frame = 0; frame < seconds * FPS; frame++) {
    await page.evaluate((t) => window.seek(t), frame / FPS)
    ffmpeg.stdin.write(await page.screenshot({ type: 'jpeg', quality: 95 }))
  }
  ffmpeg.stdin.end()
  await new Promise((resolve) => ffmpeg.on('close', resolve))
  return file
}

const captionPng = async (text, file) => {
  const context = await browser.newContext({ viewport: SIZE })
  const p = await context.newPage()
  await p.setContent(
    `<body style="margin:0;background:transparent"><div id="c" style="display:inline-flex;align-items:center;gap:14px;background:#0b0b0b;color:#fff;font:500 26px/1.2 ${site.sans};padding:15px 26px 15px 20px;border-radius:12px;white-space:nowrap"><span style="width:12px;height:12px;border-radius:50%;background:#ffb11b"></span>${text}</div></body>`,
  )
  await p.locator('#c').screenshot({ path: file, omitBackground: true })
  const box = await p.locator('#c').boundingBox()
  await context.close()
  return box
}

const renderChapter = async (name) => {
  const dir = path.join(IN, name)
  const raw = (await readdir(dir)).find((f) => f.endsWith('.webm'))
  const timeline = JSON.parse(await readFile(path.join(dir, 'timeline.json'), 'utf8'))
  const cuts = timeline.cuts.map(([a, b]) => [Math.max(0, a), b])
  const remap = (t) => {
    let removed = 0
    for (const [a, b] of cuts)
      if (t >= b) removed += b - a
      else if (t > a) removed += t - a
    return t - removed
  }
  const length = remap(await duration(path.join(dir, raw)))
  const keys = timeline.camera.map((k) => ({ ...k, t: remap(k.t) }))
  const z = track(keys, 1, (k) => k.z)
  const x = track(keys, 0.5, (k) => k.x)
  const y = track(keys, 0.5, (k) => k.y)
  const select = cuts.map(([a, b]) => `between(t,${n(a)},${n(b)})`).join('+')
  let graph = `[0:v]fps=${FPS},select='not(${select})',setpts=N/${FPS}/TB,scale=2880:1800:flags=bicubic,zoompan=z='${z}':x='clip((${x})*iw-iw/zoom/2,0,iw-iw/zoom)':y='clip((${y})*ih-ih/zoom/2,0,ih-ih/zoom)':d=1:s=${SIZE.width}x${SIZE.height}:fps=${FPS},setpts=N/${FPS}/TB[base]`
  const inputs = ['-i', path.join(dir, raw)]
  let last = 'base'
  const captions = timeline.captions.map((c) => ({ ...c, t: remap(c.t) }))
  for (let i = 0; i < captions.length; i++) {
    const start = captions[i].t
    const end = Math.min(captions[i + 1]?.t ?? length, length)
    const show = end - start
    if (show < 0.5) continue
    const png = path.join(WORK, `${name}-caption-${i}.png`)
    const box = await captionPng(captions[i].text, png)
    inputs.push('-loop', '1', '-t', String(n(show)), '-i', png)
    const index = inputs.filter((v) => v === '-i').length - 1
    const left = Math.round((SIZE.width - box.width) / 2)
    const top = SIZE.height - box.height - 40
    graph += `;[${index}:v]format=rgba,fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=${n(Math.max(0, show - 0.3))}:d=0.3:alpha=1,setpts=PTS+${n(start)}/TB[c${i}];[${last}][c${i}]overlay=x=${left}:y='${top}+22*pow(max(0,1-(t-${n(start)})/0.35),3)':eof_action=pass[o${i}]`
    last = `o${i}`
  }
  const script = path.join(WORK, `${name}.filter`)
  await writeFile(script, graph)
  const file = path.join(WORK, `${name}.mp4`)
  await run('ffmpeg', [
    '-y',
    '-v',
    'error',
    ...inputs,
    '-/filter_complex',
    script,
    '-map',
    `[${last}]`,
    '-t',
    String(n(length)),
    '-c:v',
    'libx264',
    '-crf',
    '17',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(FPS),
    file,
  ])
  console.log('rendered', name, n(length))
  return file
}

const parts = [
  await renderCard('intro', 5.5, {
    kind: 'intro',
    title: 'Cairo Institute of Liberal Arts and Sciences',
    sub: 'One bilingual platform for teaching, community and publishing',
    stats: site.stats,
  }),
]
for (const [name, card] of Object.entries(CHAPTERS)) {
  parts.push(await renderCard(`card-${name}`, 2.6, { kind: 'chapter', ...card }))
  parts.push(await renderChapter(name))
}
parts.push(
  await renderCard('outro', 4.5, {
    kind: 'outro',
    title: 'Knowledge is made together.',
    sub: 'ci-las.org',
  }),
)
await browser.close()

const TRANSITION = 0.5
const durations = await Promise.all(parts.map(duration))
let graph = ''
let label = '0:v'
let offset = 0
for (let i = 1; i < parts.length; i++) {
  offset += durations[i - 1] - TRANSITION
  const kind = i % 2 ? 'slideleft' : 'fade'
  graph += `[${label}][${i}:v]xfade=transition=${kind}:duration=${TRANSITION}:offset=${n(offset)}[x${i}];`
  label = `x${i}`
}
const total = n(durations.reduce((a, b) => a + b, 0) - TRANSITION * (parts.length - 1))
graph += `color=c=0xffb11b:s=${SIZE.width}x5:r=${FPS}:d=${total}[bar];[${label}][bar]overlay=x='-W+W*t/${total}':y=H-5:shortest=1[out]`
const script2 = path.join(WORK, 'join.filter')
await writeFile(script2, graph)
await run('ffmpeg', [
  '-y',
  '-v',
  'error',
  ...parts.flatMap((p) => ['-i', p]),
  '-/filter_complex',
  script2,
  '-map',
  '[out]',
  '-c:v',
  'libx264',
  '-crf',
  '25',
  '-preset',
  'slow',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  '-an',
  path.join(OUT, 'cilas-demo.mp4'),
])
const palette =
  'fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4'
await run('ffmpeg', [
  '-y',
  '-v',
  'error',
  '-ss',
  '0',
  '-t',
  '24',
  '-i',
  path.join(OUT, 'cilas-demo.mp4'),
  '-vf',
  palette,
  path.join(OUT, 'cilas-demo.gif'),
])
await rm(WORK, { recursive: true, force: true })
console.log('film', total)
