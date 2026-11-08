// Records the README demo against a server started by scripts/demo/serve-demo.sh.
// One webm and one timeline.json per chapter, then scripts/demo/compose.mjs builds the film.
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3000'
const OUT = process.argv[2]
const ONLY = process.argv[3]?.split(',')
const VIEWPORT = { width: 1440, height: 900 }
const accounts = {
  admin: ['user1@demo.invalid', 'demo-admin-pass', '/admin'],
  fellow: ['user3@demo.invalid', 'demo-fellow-pass', '/en/spaces'],
  member: ['user33@demo.invalid', 'demo-member-pass', '/en/spaces'],
}
const results = []
let currentPage

const overlay = () => {
  const mount = () => {
    if (document.getElementById('demo-cursor')) return
    const style = document.createElement('style')
    style.textContent =
      'nextjs-portal{display:none!important}@keyframes demo-ring{from{transform:translate(-50%,-50%) scale(.2);opacity:.9}to{transform:translate(-50%,-50%) scale(1);opacity:0}}'
    const cursor = document.createElement('div')
    cursor.id = 'demo-cursor'
    cursor.style.cssText =
      'position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,177,27,.75);border:2px solid #111;box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;left:-40px;top:-40px;transition:transform .12s'
    document.documentElement.append(style, cursor)
    addEventListener(
      'mousemove',
      (e) => {
        cursor.style.left = e.clientX + 'px'
        cursor.style.top = e.clientY + 'px'
      },
      true,
    )
    addEventListener(
      'mousedown',
      (e) => {
        cursor.style.transform = 'scale(.65)'
        const ring = document.createElement('div')
        ring.style.cssText = `position:fixed;z-index:2147483646;left:${e.clientX}px;top:${e.clientY}px;width:92px;height:92px;border-radius:50%;border:3px solid #ffb11b;pointer-events:none;animation:demo-ring .55s cubic-bezier(.2,.7,.2,1) forwards`
        document.documentElement.append(ring)
        setTimeout(() => ring.remove(), 600)
      },
      true,
    )
    addEventListener('mouseup', () => (cursor.style.transform = ''), true)
  }
  if (document.documentElement) mount()
  else
    new MutationObserver(
      (_, observer) => document.documentElement && (observer.disconnect(), mount()),
    ).observe(document, { childList: true })
}

const wait = (page, ms = 1200) => page.waitForTimeout(ms)
let timeline
const now = () => (Date.now() - timeline.start) / 1000
const caption = (_page, text) => timeline.captions.push({ t: now(), text })
const camera = (z, x, y, duration = 0.8) => {
  timeline.camera.push({ t: now(), z, x, y, duration })
  timeline.zoomed = z > 1
}
const release = async (page) => {
  if (!timeline.zoomed) return
  camera(1, 0.5, 0.5, 0.7)
  await wait(page, 750)
}
const go = async (page, url, text) => {
  const cutFrom = now()
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 150000 })
  await page
    .waitForFunction(
      () => !document.querySelector('[class*="loading" i],[class*="skeleton" i]'),
      null,
      { timeout: 15000 },
    )
    .catch(() => {})
  await page.waitForTimeout(700)
  timeline.cuts.push([cutFrom, now()])
  if (timeline.zoomed) camera(1, 0.5, 0.5, 0.01)
  if (text) caption(page, text)
  await wait(page, 1500)
}
const moveTo = async (page, locator) => {
  await locator.waitFor({ state: 'visible', timeout: 8000 })
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  await wait(page, 900)
  const box = await locator.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 })
  await wait(page, 200)
  return box
}
const focus = async (page, locator, zoom = 1.5, hold = 1500) => {
  const box = await moveTo(page, locator)
  camera(zoom, (box.x + box.width / 2) / VIEWPORT.width, (box.y + box.height / 2) / VIEWPORT.height)
  await wait(page, 850 + hold)
}
const click = async (page, locator, { zoom = 1.4, hold = false } = {}) => {
  const box = await moveTo(page, locator)
  camera(
    zoom,
    (box.x + box.width / 2) / VIEWPORT.width,
    (box.y + box.height / 2) / VIEWPORT.height,
    0.7,
  )
  await wait(page, 750)
  await page.mouse.down()
  await page.mouse.up()
  await wait(page, 1300)
  if (!hold) await release(page)
}
const scroll = async (page, pixels, pause = 900) => {
  await release(page)
  const step = pixels / 30
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, step)
    await page.waitForTimeout(28)
  }
  await wait(page, pause)
}
const showTop = async (page, locator, offset = 110) => {
  await release(page)
  await locator.evaluate(
    (el, top) =>
      window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - top, behavior: 'smooth' }),
    offset,
  )
  await wait(page, 1200)
}
const type = (locator, text) => locator.pressSequentially(text, { delay: 28 })
const step = async (chapter, name, fn) => {
  try {
    await fn()
    results.push(['ok', chapter, name])
  } catch (error) {
    results.push([
      'FAILED',
      chapter,
      name,
      String(error.message).split('\n').slice(0, 3).join(' ').slice(0, 220),
    ])
    await currentPage
      ?.screenshot({ path: path.join(OUT, `failed-${chapter}-${name.replace(/\W+/g, '-')}.png`) })
      .catch(() => {})
  }
}

const browser = await chromium.launch()
const states = {}
for (const [role, [email, password, next]] of Object.entries(accounts)) {
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  await page.goto(`${BASE}/en/login?next=${encodeURIComponent(next)}`, { timeout: 150000 })
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 })
  states[role] = await context.storageState()
  await context.close()
}

const chapter = async (name, role, fn) => {
  if (ONLY && !ONLY.includes(name)) return
  const context = await browser.newContext({
    viewport: VIEWPORT,
    storageState: role ? states[role] : undefined,
    recordVideo: { dir: path.join(OUT, name), size: VIEWPORT },
  })
  await context.addInitScript(overlay)
  timeline = { start: Date.now(), cuts: [], captions: [], camera: [], zoomed: false }
  const page = await context.newPage()
  currentPage = page
  await fn(page, (label, body) => step(name, label, body))
  timeline.end = now()
  const { start: _start, zoomed: _zoomed, ...saved } = timeline
  await context.close()
  await writeFile(path.join(OUT, name, 'timeline.json'), JSON.stringify(saved, null, 1))
}

await chapter('01-public', null, async (page, s) => {
  await s('home', async () => {
    await go(page, '/en', 'A bilingual home for the Cairo Institute of Liberal Arts and Sciences')
    await wait(page, 3500)
  })
  await s('open for registration', async () => {
    caption(page, 'Open for registration, nearest deadline first')
    await showTop(page, page.locator('#open'), 90)
    await wait(page, 2000)
    await focus(
      page,
      page.locator('#open').getByText('Closes', { exact: false }).filter({ visible: true }).first(),
      1.5,
      1800,
    )
    await release(page)
  })
  await s('upcoming events on home', async () => {
    caption(page, 'Upcoming events, with registration')
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: 'Upcoming events' }),
    })
    await showTop(page, section, 90)
    await wait(page, 1800)
    await focus(page, section.getByText('View event').nth(1), 1.45, 1800)
    await release(page)
  })
  await s('events', async () => {
    await go(page, '/en/events', 'Events: upcoming and past')
    await showTop(page, page.getByRole('heading', { name: 'Upcoming events' }), 90)
    await wait(page, 2200)
    await showTop(page, page.getByRole('heading', { name: 'Past events' }), 90)
    await wait(page, 900)
    await click(page, page.getByRole('button', { name: 'Talk', exact: true }))
    await wait(page, 1000)
  })
  await s('event detail and registration', async () => {
    await go(
      page,
      '/en/events/faces-1968-screening',
      'Event page with registration and calendar export',
    )
    await click(page, page.getByRole('button', { name: 'Add to calendar' }))
    await wait(page, 1200)
    await page.keyboard.press('Escape')
    await focus(page, page.getByRole('link', { name: 'Register for this event' }))
    await release(page)
    await scroll(page, 600, 1200)
  })
  await s('study catalogue', async () => {
    await go(page, '/en/study', 'The full course archive')
    await click(page, page.getByRole('button', { name: 'Add filter' }))
    await wait(page, 1200)
    await page.keyboard.press('Escape')
    await scroll(page, 700, 800)
  })
  await s('course', async () => {
    await go(
      page,
      '/en/study/minds-machines-and-meaning',
      'Course page: fellows, sessions, readings',
    )
    await focus(page, page.getByRole('link', { name: 'Apply' }).nth(1))
    await release(page)
    await scroll(page, 800, 1200)
  })
  await s('study with AI', async () => {
    await caption(page, 'One click sends the syllabus to an AI study partner')
    await focus(
      page,
      page.getByRole('button', { name: 'How to discuss this page with AI' }),
      1.6,
      1800,
    )
    await release(page)
  })
  await s('bridge programme', async () => {
    await go(page, '/en/study/bridge', 'The Bridge Programme and its archive')
    await scroll(page, 600, 1200)
  })
  await s('calendar', async () => {
    await go(page, '/en/calendar', 'Calendar of courses and events')
    await wait(page, 1500)
    await click(page, page.getByRole('link', { name: 'Agenda', exact: true }))
    await wait(page, 1800)
  })
  await s('search', async () => {
    await caption(page, 'Bilingual search across courses, articles and people')
    await click(page, page.getByRole('button', { name: 'Search the site' }))
    await type(
      page
        .getByRole('dialog')
        .getByRole('combobox')
        .or(page.getByRole('dialog').getByRole('searchbox'))
        .first(),
      'philosophy',
    )
    await wait(page, 2800)
    await page.keyboard.press('Escape')
  })
  await s('people', async () => {
    await go(page, '/en/people/fellows', 'Fellows and their teaching')
    await scroll(page, 500, 1000)
  })
  await s('articles', async () => {
    await go(page, '/en/articles', 'Articles and publications')
    await scroll(page, 500, 1000)
  })
  await s('dark and Arabic', async () => {
    await go(page, '/en', 'Light and dark themes')
    await click(page, page.getByRole('button', { name: 'Switch to dark mode' }))
    await wait(page, 1800)
    await go(page, '/ar', 'Full Arabic, right to left')
    await wait(page, 3000)
    await showTop(page, page.locator('#open'), 90)
    await wait(page, 2500)
  })
})

await chapter('02-apply', null, async (page, s) => {
  await s('fill application', async () => {
    await go(page, '/en/study/bridge/apply', 'Apply: forms are built in the CMS')
    const form = page.locator('form').first()
    await type(form.locator('[name=name]'), 'Sample Applicant')
    await form.locator('[name=email]').fill('applicant@demo.invalid')
    await form.locator('[name=song]').fill('A sample song')
    await form.locator('[name=phone]').fill('+20 100 000 0000')
    await form.locator('[name=address]').fill('Downtown, Cairo')
    await form
      .locator('[name=two_truths]')
      .fill('I read at night. I swim. I have been to the moon.')
    await form.locator('[name=high_school_name]').fill('Sample School')
    for (const field of [
      'english',
      'arabic',
      'work',
      'education',
      'interest',
      'books',
      'reflection',
      'jahin',
    ])
      await form.locator(`[name=${field}]`).fill('Sample answer for the demo.')
    const essay = 'A sample essay written for this demo. '.repeat(40)
    for (const field of ['cartoon_essay', 'review_essay'])
      await form.locator(`[name=${field}]`).fill(essay)
    await click(page, form.getByRole('radio').first())
    const boxes = form.getByRole('checkbox')
    for (const index of [2, 5]) {
      await moveTo(page, boxes.nth(index))
      await boxes.nth(index).click({ force: true })
      await wait(page, 700)
    }
  })
  await s('submit application', async () => {
    await caption(page, 'The application is saved for review')
    await click(page, page.getByRole('button', { name: 'Send my application' }), { hold: true })
    await wait(page, 4500)
    const invalid = await page
      .locator('[aria-invalid=true]')
      .evaluateAll((all) => all.map((el) => el.name || el.innerText.slice(0, 40)))
    if (invalid.length) throw new Error(`invalid: ${invalid.join(', ')}`)
  })
})

await chapter('03-spaces', 'member', async (page, s) => {
  const composerText = `A note for the demo ${Date.now() % 1000}`
  await s('spaces home', async () => {
    await go(page, '/en/spaces', 'Spaces: private communities for each course and cohort')
    await wait(page, 2000)
  })
  await s('course feed', async () => {
    await go(
      page,
      '/en/spaces/course/buddhist-psychology',
      'Course space: posts, syllabus, events, votes',
    )
    await scroll(page, 500, 1500)
  })
  await s('react', async () => {
    await caption(page, 'React and comment')
    const add = page.getByRole('button', { name: 'Add reaction' }).first()
    await click(page, add)
    await click(page, page.getByRole('button', { name: 'Like', exact: true }).first())
  })
  await s('comment', async () => {
    await click(page, page.getByRole('button', { name: 'Comment', exact: true }).first(), {
      hold: true,
    })
    const box = page.getByPlaceholder('Write a comment').first()
    await moveTo(page, box)
    await box.click()
    await type(box, 'Thank you. This helped me prepare.')
    await wait(page, 500)
    await page.keyboard.press('Meta+Enter')
    await wait(page, 2000)
    await page.getByText('Thank you. This helped me prepare.').first().waitFor({ timeout: 6000 })
  })
  await s('create post', async () => {
    await go(page, '/en/spaces/course/buddhist-psychology', 'Write a post')
    await click(page, page.getByRole('button', { name: 'Write a post' }).first(), { hold: true })
    const editor = page.locator('[contenteditable=true]').first()
    await moveTo(page, editor)
    await editor.click()
    await type(editor, composerText)
    await wait(page, 700)
    await click(page, page.getByRole('button', { name: 'Publish post' }).first(), { hold: true })
    await wait(page, 2500)
    await page.getByText(composerText).first().waitFor({ timeout: 8000 })
  })
  await s('filters: votes and events', async () => {
    await caption(page, 'Events with RSVP, and votes')
    await click(page, page.locator('main').getByText('Events', { exact: true }).first())
    await wait(page, 1800)
    await click(page, page.getByText('Going', { exact: true }).filter({ visible: true }).first())
    await wait(page, 1800)
  })
  await s('notifications', async () => {
    await caption(page, 'In-app notifications')
    await click(page, page.getByRole('button', { name: /^Notifications/ }))
    await wait(page, 2500)
    await page.keyboard.press('Escape')
  })
  await s('settings', async () => {
    await go(page, '/en/settings', 'Profile, digest and notification settings')
    await scroll(page, 500, 1800)
  })
})

await chapter('04-fellow', 'fellow', async (page, s) => {
  await s('moderation', async () => {
    await go(page, '/en/spaces/course/buddhist-psychology', 'Fellows moderate: pin, lock, remove')
    await scroll(page, 450, 800)
    await click(page, page.getByRole('button', { name: 'More' }).filter({ visible: true }).first())
    await wait(page, 2500)
    await page.keyboard.press('Escape')
  })
})

await chapter('05-admin', 'admin', async (page, s) => {
  await s('dashboard', async () => {
    await go(page, '/admin', 'The CMS dashboard')
    await wait(page, 2500)
  })
  await s('reviews', async () => {
    await go(page, '/admin/reviews', 'One queue for applications and editorial reviews')
    await wait(page, 2500)
  })
  await s('submissions', async () => {
    await go(
      page,
      '/admin/collections/form-submissions?sort=-createdAt',
      'Applications, with CSV and JSON export',
    )
    await wait(page, 2200)
  })
  await s('accept application', async () => {
    await caption(page, 'Accepting creates the account and the membership')
    await click(page, page.locator('table tbody tr a').first())
    await wait(page, 2500)
    await click(page, page.getByRole('button', { name: 'Accept', exact: true }).first(), {
      hold: true,
    })
    await wait(page, 1200)
    await click(
      page,
      page.getByRole('dialog').getByRole('button', { name: 'Accept', exact: true }),
      { hold: true },
    )
    await page.getByText('Accepted', { exact: false }).first().waitFor({ timeout: 15000 })
    await wait(page, 2500)
  })
  await s('course admin', async () => {
    await go(page, '/admin/collections/courses', 'Courses, cycles and programmes')
    await wait(page, 1800)
    await click(
      page,
      page.locator('table tbody').getByRole('link', { name: 'Minds, Machines and Meaning' }),
    )
    await wait(page, 2500)
    await scroll(page, 700, 1500)
  })
  await s('event admin', async () => {
    await go(page, '/admin/collections/events/18', 'Events: schedule, venue, registration, pricing')
    await scroll(page, 700, 1500)
  })
  await s('newsletter', async () => {
    await go(page, '/admin/collections/newsletters', 'Newsletters written and sent from the CMS')
    await wait(page, 1500)
    await click(page, page.locator('table tbody tr a').first())
    await wait(page, 3000)
    await scroll(page, 500, 1200)
  })
  await s('people and spaces admin', async () => {
    await go(page, '/admin/collections/people', 'People, separate from login accounts')
    await wait(page, 1500)
    await go(page, '/admin/collections/spaces', 'Spaces are managed in the same CMS')
    await wait(page, 1500)
  })
  await s('site settings', async () => {
    await go(page, '/admin/globals/site-settings', 'Site settings, and a switch for Spaces')
    await scroll(page, 500, 1500)
  })
})

await browser.close()
for (const row of results) console.log(row.join(' | '))
const failed = results.filter(([state]) => state !== 'ok').length
console.log(`${results.length - failed}/${results.length} steps passed`)
process.exitCode = failed ? 1 : 0
