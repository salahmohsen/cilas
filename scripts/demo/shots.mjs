// The demo's shots, in film order. Each shot is one recording of one page state.
// A step names what the viewer sees: visible text or a label, never a CSS class.
const shot = (id, role, theme, url, steps) => ({ id, role, theme, url, steps })

export const shots = [
  shot('home', 'visitor', 'light', '/en', async (p) => {
    await p.wait(2200)
    await p.scroll(620, 1400)
    await p.focus({ text: 'Closes', loose: true, css: '#open *' }, 1.45, 1800)
    await p.scroll(760, 2200)
  }),

  shot('study', 'visitor', 'light', '/en/study', async (p) => {
    await p.wait(1200)
    await p.click({ text: 'Grid' }, { zoom: 1.4 })
    await p.wait(1200)
    await p.scroll(420, 1200)
    await p.click({ text: 'Add filter' }, { zoom: 1.3, hold: true, settle: 1800 })
    p.press('Escape')
    await p.wait(500)
  }),

  shot('course', 'visitor', 'light', '/en/study/minds-machines-and-meaning', async (p) => {
    await p.wait(1500)
    await p.focus({ text: 'Course flow', css: 'h2' }, 1.2, 600)
    await p.click(
      { text: 'How do language models work, and do they understand?', loose: true, css: 'button' },
      { zoom: 1.35, hold: true, settle: 2400 },
    )
    await p.release()
    await p.eval(`location.hash = 'session-6'; true`)
    await p.wait(2600)
    await p.focus({ text: 'Apply', css: 'a' }, 1.5, 1200)
    await p.focus({ text: 'How to discuss this page with AI' }, 1.6, 1600)
  }),

  shot('calendar', 'visitor', 'light', '/en/calendar', async (p) => {
    await p.wait(1500)
    await p.click(
      { text: 'Minds, Machines and Meaning, Thursday, November 19', loose: true, css: 'a' },
      { zoom: 1.25, settle: 1200 },
    )
    await p.click(
      { text: 'Minds, Machines and Meaning', loose: true, minX: 1200 },
      { zoom: 1.6, hold: true, settle: 2600 },
    )
    await p.focus({ text: 'View course', loose: true, minX: 1200 }, 1.6, 900)
    await p.click({ text: 'Week' }, { zoom: 1.2, settle: 2200 })
    await p.click({ text: 'Agenda' }, { zoom: 1.2, settle: 2000 })
    await p.click(
      { text: 'Add to calendar', css: 'button' },
      { zoom: 1.5, hold: true, settle: 2000 },
    )
    p.press('Escape')
    await p.wait(400)
  }),

  shot('events', 'visitor', 'light', '/en/events', async (p) => {
    await p.wait(1800)
    await p.focus(
      { text: 'Film Screening: Faces (1968)', loose: true, css: 'h3, h2, a' },
      1.4,
      1400,
    )
    await p.scroll(520, 1400)
  }),

  shot('event', 'visitor', 'light', '/en/events/faces-1968-screening', async (p) => {
    await p.wait(1600)
    await p.click(
      { text: 'Add to calendar', css: 'button' },
      { zoom: 1.6, hold: true, settle: 2200 },
    )
    p.press('Escape')
    await p.focus({ text: 'Register for this event', loose: true, css: 'a' }, 1.6, 1400)
    await p.scroll(600, 1200)
  }),

  shot('search', 'visitor', 'light', '/en', async (p) => {
    await p.wait(800)
    await p.click({ text: 'Search the site' }, { zoom: 1, settle: 1000 })
    await p.type('buddhist')
    await p.wait(3000)
    p.press('Escape')
    await p.wait(300)
  }),

  shot('apply', 'visitor', 'light', '/en/study/bridge/apply', async (p) => {
    await p.wait(1500)
    await p.click({ css: '[name=name]' }, { zoom: 1.45, hold: true, settle: 400 })
    await p.type('Sample Applicant')
    await p.click({ css: '[name=email]' }, { zoom: 1.45, hold: true, settle: 400 })
    await p.type('applicant@demo.invalid')
    await p.scroll(1400, 1000)
    await p.scroll(1400, 1000)
    await p.focus({ text: 'Send my application', loose: true, css: 'button' }, 1.5, 1600)
  }),

  shot('login', 'login', 'light', '/en/login', async (p) => {
    await p.wait(1000)
    await p.click({ css: 'input[type=email]' }, { zoom: 1.5, hold: true, settle: 300 })
    await p.type('user33@demo.invalid')
    await p.click({ css: 'input[type=password]' }, { zoom: 1.5, hold: true, settle: 300 })
    await p.type('demo-member-pass')
    await p.click({ text: 'Sign in', css: 'button' }, { zoom: 1.5, settle: 5000 })
  }),

  shot('spaces', 'member', 'light', '/en/spaces', async (p) => {
    await p.wait(2400)
    await p.scroll(400, 1600)
  }),

  shot('space-feed', 'member', 'light', '/en/spaces/course/buddhist-psychology', async (p) => {
    await p.wait(1800)
    await p.focus({ text: 'Session 4', css: 'h2, h3, p, div, span' }, 1.4, 1400)
    await p.scroll(900, 1400)
    await p.click({ text: 'Add reaction' }, { zoom: 1.6, hold: true, settle: 1100 })
    await p.click({ text: 'Like' }, { zoom: 1.6, settle: 1400 })
  }),

  shot('space-calendar', 'member', 'light', '/en/spaces/course/buddhist-psychology', async (p) => {
    await p.wait(1200)
    await p.click({ text: 'Calendar', css: 'main button' }, { zoom: 1.3, settle: 2200 })
    await p.click(
      { text: 'Session 4', loose: true, css: 'main button' },
      { zoom: 1.3, settle: 2600 },
    )
    await p.focus({ text: 'View posts', loose: true }, 1.4, 900)
    await p.release()
    p.press('Escape')
    await p.wait(700)
  }),

  shot('fellow-schedule', 'fellow', 'light', '/en/spaces/course/buddhist-psychology', async (p) => {
    await p.wait(1200)
    await p.click({ text: 'Calendar', css: 'main button' }, { zoom: 1, settle: 2000 })
    await p.click({ text: 'Edit', css: 'main button' }, { zoom: 1.4, settle: 1200 })
    await p.drag({ text: 'Session 4', loose: true, css: 'main button' }, 306, 0)
    await p.focus({ text: 'Save', css: 'main button' }, 1.5, 300)
    await p.click({ text: 'Save', css: 'main button' }, { zoom: 1.5, hold: true, settle: 4500 })
  }),

  shot('admin-dashboard', 'admin', 'dark', '/admin', async (p) => {
    await p.wait(2500)
    await p.focus({ text: 'Applications waiting', loose: true }, 1.5, 1400)
    await p.scroll(600, 1600)
  }),

  shot('admin-applicants', 'admin', 'dark', '/admin/applicants', async (p) => {
    await p.wait(2200)
    await p.click({ text: 'Review' }, { zoom: 1.35, settle: 2600 })
    await p.click(
      { text: 'Accept:', loose: true, css: 'button' },
      { zoom: 1.5, hold: true, settle: 1400 },
    )
    await p.click(
      { text: 'Accept', loose: true, css: 'button', maxX: 1000 },
      { zoom: 1.5, hold: true, settle: 2600 },
    )
  }),

  shot('admin-course', 'admin', 'dark', '/admin/collections/courses/404', async (p) => {
    await p.wait(2500)
    await p.click({ text: 'Sessions', css: '[role=tab], button' }, { zoom: 1, settle: 3500 })
    await p.drag({ text: 'What is intelligence?', loose: true, css: '[data-span-id]' }, 91, 0, 1.4)
    await p.click({ text: 'Save schedule', css: 'button' }, { zoom: 1.4, hold: true, settle: 3000 })
    await p.focus(
      { text: 'Announce this change?', loose: true, css: 'h2, [role=dialog] *' },
      1.3,
      1800,
    )
    await p.click(
      { text: 'Publish to space', css: 'button' },
      { zoom: 1.5, hold: true, settle: 2600 },
    )
  }),

  shot('ar-home', 'visitor', 'dark', '/ar', async (p) => {
    await p.wait(2200)
    await p.scroll(620, 2200)
  }),

  shot('ar-calendar', 'visitor', 'dark', '/ar/calendar', async (p) => {
    await p.wait(1500)
    await p.click({ text: 'Minds', loose: true, css: 'a' }, { zoom: 1.3, settle: 2400 })
  }),

  shot('ar-course', 'visitor', 'dark', '/ar/study/minds-machines-and-meaning', async (p) => {
    await p.wait(1800)
    await p.scroll(700, 2400)
  }),
]
