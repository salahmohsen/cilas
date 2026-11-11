// @vitest-environment node
// React Email renders with react-dom/server, which needs Node's streams.
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.RESEND_API_KEY = 'key'
})

import { cardOf } from '@/emails/cards'
import { MessageEmail } from '@/emails/message'
import { newsletterMail } from '@/emails/newsletter'
import { renderEmail } from '@/emails/render'
import { DEFAULT_TEXTS, fill, paragraphs, withDefaults } from '@/emails/settings'
import { acceptanceMail, rejectionMail, resetMail, reviewMail } from '@/emails/transactional'
import { sendBroadcast } from '@/lib/broadcast'

const bodyOf = (intro: { root: { children: unknown[] } }, ...blocks: Record<string, unknown>[]) => [
  {
    body: {
      root: {
        type: 'root',
        children: [...intro.root.children, ...blocks.map((fields) => ({ type: 'block', fields }))],
      },
    },
  },
]

describe('fill', () => {
  it('puts values into {placeholders} and leaves unknown ones', () => {
    expect(fill('Dear {name}, see {title}. {other}', { name: 'Mona', title: 'Bridge' })).toBe(
      'Dear Mona, see Bridge. {other}',
    )
  })
})

describe('paragraphs', () => {
  it('splits on blank lines and drops empty ones', () => {
    expect(paragraphs('One\nstill one\n\n\nTwo\n')).toEqual(['One\nstill one', 'Two'])
  })
})

describe('withDefaults', () => {
  it('uses the default text where the global leaves one empty', () => {
    const s = withDefaults({ texts: { acceptance: { subject: '' } } })
    expect(s.texts.acceptance.subject).toBe(DEFAULT_TEXTS.acceptance.subject)
    expect(s.fromName).toBe('CILAS')
    expect(s.accent).toBe('#000000')
  })

  it('keeps what the admin wrote', () => {
    const s = withDefaults({ from_name: 'CILAS Admissions', accent: '#614500' })
    expect(s.fromName).toBe('CILAS Admissions')
    expect(s.accent).toBe('#614500')
  })
})

describe('MessageEmail', () => {
  const settings = withDefaults({
    logo: { url: 'https://cdn.test/logo.png', alt: 'CILAS' },
    accent: '#614500',
    footer: 'CILAS, Cairo',
  })

  it('renders the logo, paragraphs, button and footer, in HTML and text', async () => {
    const { html, text } = await renderEmail(
      <MessageEmail
        settings={settings}
        preview="You are accepted"
        paragraphs={['Dear Mona,', 'You are accepted.']}
        button={{ label: 'Sign in', url: 'https://ci-las.org/en/login' }}
      />,
    )
    expect(html).toContain('https://cdn.test/logo.png')
    expect(html).toContain('You are accepted.')
    expect(html).toContain('href="https://ci-las.org/en/login"')
    expect(html).toContain('#614500')
    expect(html).toContain('CILAS, Cairo')
    expect(html).toContain('A pedagogy of discovery and attunement.')
    expect(text).toContain('Dear Mona,')
    expect(text).toContain('https://ci-las.org/en/login')
  })

  it('escapes what people wrote', async () => {
    const { html } = await renderEmail(
      <MessageEmail settings={settings} preview="x" paragraphs={['<b>Mona</b>']} />,
    )
    expect(html).toContain('&lt;b&gt;Mona&lt;/b&gt;')
  })
})

describe('transactional mails', () => {
  const settings = withDefaults({})
  const site = 'https://ci-las.org/'

  it('tells a new account how to sign in', async () => {
    const mail = await acceptanceMail(settings, {
      name: 'Mona',
      email: 'mona@example.com',
      title: 'Bridge 2026',
      newAccount: true,
      site,
    })
    expect(mail.subject).toBe('You are accepted to Bridge 2026')
    expect(mail.html).toContain('We made a CILAS account for mona@example.com')
    expect(mail.html).toContain('href="https://ci-las.org/en/login"')
  })

  it('uses the admin’s own text', async () => {
    const mail = await acceptanceMail(
      withDefaults({ texts: { acceptance: { subject: 'Welcome, {name}!' } } }),
      { name: 'Mona', email: 'm@x.co', title: 'T', newAccount: false, site },
    )
    expect(mail.subject).toBe('Welcome, Mona!')
    expect(mail.html).toContain('Sign in with your CILAS account as usual.')
  })

  it('tells a rejected applicant kindly, names the course and has no button', async () => {
    const mail = await rejectionMail(settings, {
      name: 'Mona',
      email: 'mona@example.com',
      title: 'Bridge 2026',
    })
    expect(mail.subject).toBe('Your application to Bridge 2026')
    expect(mail.text).toContain('Dear Mona')
    expect(mail.text).toContain('We are sorry that we cannot offer you a place this time.')
    expect(mail.html).not.toContain('/en/login')
  })

  it('adds the editor’s note only where the state carries one', async () => {
    const asked = await reviewMail(settings, 'changes_requested', 'Essay', 'Shorten it')
    expect(asked.subject).toBe('Changes requested: Essay')
    expect(asked.text).toContain('Shorten it')
    const approved = await reviewMail(settings, 'approved', 'Essay', 'Shorten it')
    expect(approved.text).not.toContain('Shorten it')
    const submitted = await reviewMail(settings, 'submitted', 'Essay', null)
    expect(submitted.subject).toBe('Submitted for review: Essay')
  })

  it('links the reset button to the token', async () => {
    const mail = await resetMail(settings, { email: 'm@x.co', token: 'abc', site })
    expect(mail.html).toContain('href="https://ci-las.org/admin/reset/abc"')
  })
})

describe('cardOf', () => {
  const site = 'https://ci-las.org'
  const labels = { site, read: 'Read more', apply: 'Apply' }

  it('makes a course card with its cycle and summary', () => {
    const card = cardOf(
      {
        relationTo: 'courses',
        value: {
          id: 1,
          title: 'Reading Plato',
          slug: 'reading-plato',
          summary: 'Book by book.',
          cover_image: { url: 'https://cdn.test/plato.jpg', alt: 'Plato' },
          cycle: { season: 'fall', start_year: 2026 },
        },
      },
      'Starts 3 Nov',
      labels,
    )
    expect(card).toEqual({
      kind: 'Course',
      title: 'Reading Plato',
      byline: [],
      children: [],
      meta: 'Fall 2026',
      text: 'Book by book.',
      note: 'Starts 3 Nov',
      // No crop on record: the grid falls back to the full image.
      image: {
        url: 'https://cdn.test/plato.jpg',
        alt: 'Plato',
        thumb: 'https://cdn.test/plato.jpg',
      },
      url: 'https://ci-las.org/en/study/reading-plato',
      button: 'Read more',
    })
  })

  it('links a Bridge programme to the Bridge page with Apply', () => {
    const card = cardOf(
      {
        relationTo: 'programmes',
        value: { id: 2, title: 'Bridge 2026', kind: 'bridge', tagline: 'A year.' },
      },
      null,
      labels,
    )
    expect(card).toMatchObject({
      kind: 'Programme',
      url: 'https://ci-las.org/en/study/bridge',
      button: 'Apply',
    })
  })

  it('skips a pick that is not populated, or a programme with no page', () => {
    expect(cardOf({ relationTo: 'articles', value: 5 }, null, labels)).toBeNull()
    expect(
      cardOf(
        { relationTo: 'programmes', value: { id: 3, title: 'Residency', kind: 'residency' } },
        null,
        labels,
      ),
    ).toBeNull()
  })
})

describe('newsletterMail', () => {
  const settings = withDefaults({}, { site: 'https://ci-las.org' })
  const paragraph = (text: string) => ({
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: null,
      children: [
        {
          type: 'paragraph',
          version: 1,
          format: '',
          indent: 0,
          direction: null,
          textFormat: 0,
          textStyle: '',
          children: [
            { type: 'text', version: 1, text, format: 0, mode: 'normal', style: '', detail: 0 },
          ],
        },
      ],
    },
  })

  it('renders the intro, the sections in order, the sign-off and the unsubscribe link', async () => {
    const mail = await newsletterMail(
      {
        title: 'October at CILAS',
        preheader: 'Two new courses',
        sections: bodyOf(
          paragraph('مرحبا بكم في سيلاس'),
          {
            blockType: 'newsletterPicks',
            items: [
              {
                type: 'course',
                course: {
                  id: 1,
                  title: 'Reading Plato',
                  slug: 'reading-plato',
                  fellows: [
                    { name: 'Mona', slug: 'mona', visible: true },
                    { name: 'Ali', slug: 'ali', visible: false },
                  ],
                  description: paragraph('Plato, book by book, in Cairo.'),
                },
                note: 'Starts 3 Nov',
              },
              { type: 'article', article: 9, note: null },
              {
                type: 'cycle',
                cycle: {
                  id: 5,
                  title: 'Fall 2026',
                  season: 'fall',
                  start_year: 2026,
                  courses: {
                    docs: [
                      {
                        id: 2,
                        title: 'Urban Culture',
                        slug: 'urban',
                        _status: 'published',
                        tier: 'public',
                      },
                    ],
                  },
                },
              },
            ],
          },
          {
            blockType: 'gallery',
            columnCount: '3',
            images: [
              { image: { url: 'https://cdn.test/a.jpg', alt: 'A' }, caption: 'يوم في سيلاس' },
              { image: 4 },
            ],
          },
          { blockType: 'newsletterQuote', text: 'Learning is a commons.', attribution: 'A fellow' },
        ),
      },
      settings,
      { unsubscribe: '{{{RESEND_UNSUBSCRIBE_URL}}}' },
    )
    expect(mail.subject).toBe('October at CILAS')
    expect(mail.html).toContain('<p dir="auto"')
    // A visible fellow links to their profile; a hidden one is plain text.
    expect(mail.html).toMatch(/href="https:\/\/ci-las.org\/en\/people\/mona"[^>]*>Mona<\/a>/)
    expect(mail.html).not.toContain('/en/people/ali')
    expect(mail.html).toContain('Ali')
    expect(mail.html).toContain('Starts 3 Nov')
    expect(mail.html).toContain('Plato, book by book, in Cairo.')
    expect(mail.html).toContain('Urban Culture')
    expect(mail.html).toContain('href="https://ci-las.org/en/study/urban"')
    expect(mail.html).not.toMatch(/color:\s*#0000ee|color:\s*blue/i)
    expect(mail.html).toContain('https://cdn.test/a.jpg')
    expect(mail.html).toContain('يوم في سيلاس')
    expect(mail.html).toContain('Learning is a commons.')
    expect(mail.html).toContain('From CILAS, with love.')
    expect(mail.html).toContain('10 Darb El Labana')
    expect(mail.html).toContain('https://www.google.com/maps/search/')
    expect(mail.html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}')
    expect(mail.html.indexOf('Reading Plato')).toBeLessThan(
      mail.html.indexOf('Learning is a commons.'),
    )
  })
})

describe('cards for collections, cycles and events', () => {
  const labels = { site: 'https://ci-las.org', read: 'Read more', apply: 'Apply' }

  it('links an article collection to its list', () => {
    const card = cardOf(
      {
        relationTo: 'publications',
        value: {
          id: 3,
          title: 'Bridge Papers',
          slug: 'bridge-papers',
          editors: [{ name: 'Sara', slug: 'sara' }],
          articles: [1, 2],
        },
      },
      null,
      labels,
    )
    expect(card).toMatchObject({
      kind: 'Collection',
      byline: [{ name: 'Sara', url: 'https://ci-las.org/en/people/sara' }],
      meta: '2 texts',
      url: 'https://ci-las.org/en/articles?publication=bridge-papers',
    })
  })

  it('lists a cycle’s public courses only', () => {
    const card = cardOf(
      {
        relationTo: 'cycles',
        value: {
          id: 5,
          title: 'Fall 2026',
          season: 'fall',
          start_year: 2026,
          courses: {
            docs: [
              { id: 1, title: 'Open', slug: 'open', _status: 'published', tier: 'public' },
              { id: 2, title: 'Draft', slug: 'draft', _status: 'draft', tier: 'public' },
              { id: 3, title: 'Members', slug: 'members', _status: 'published', tier: 'community' },
            ],
          },
        },
      },
      null,
      labels,
    )
    expect(card).toMatchObject({
      kind: 'Cycle',
      meta: '1 course',
      url: 'https://ci-las.org/en/study?season=fall&year=2026',
    })
    expect(card!.children.map((c) => [c.kind, c.title, c.url])).toEqual([
      ['Course', 'Open', 'https://ci-las.org/en/study/open'],
    ])
  })

  it('gives an event its day, time and place', () => {
    const card = cardOf(
      {
        relationTo: 'events',
        value: {
          id: 7,
          title: 'Balcony gathering',
          schedule: {
            start_date: '2026-07-24T00:00:00.000Z',
            slots: [{ start_time: '14:00', end_time: '18:30' }],
          },
          place: { name: 'CILAS, Darb El Ahmar' },
        },
      },
      null,
      labels,
    )
    expect(card).toMatchObject({
      kind: 'Event',
      meta: 'Friday 24 July 2026, 14:00–18:30 · CILAS, Darb El Ahmar',
      url: 'https://ci-las.org/en/calendar',
    })
  })
})

describe('sendBroadcast', () => {
  afterEach(() => vi.restoreAllMocks())
  const args = {
    segmentId: 'seg',
    from: 'CILAS <news@ci-las.org>',
    replyTo: null,
    subject: 'October',
    html: '<p>x</p>',
    text: 'x',
    name: 'October at CILAS',
  }

  it('creates and sends a Resend broadcast to the segment', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ id: 'b_1' }))
    expect(await sendBroadcast(args)).toBe('b_1')
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://api.resend.com/broadcasts')
    expect(JSON.parse(init!.body as string)).toEqual({
      segment_id: 'seg',
      from: 'CILAS <news@ci-las.org>',
      subject: 'October',
      html: '<p>x</p>',
      text: 'x',
      name: 'October at CILAS',
      send: true,
    })
  })

  it('throws Resend’s message on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ message: 'Segment not found' }, { status: 404 }),
    )
    await expect(sendBroadcast(args)).rejects.toThrow('Segment not found')
  })
})

describe('the layout’s brand', () => {
  it('uses the sail and the site’s social links when the global has none', async () => {
    const settings = withDefaults(
      {},
      {
        site: 'https://ci-las.org/',
        social: [
          { platform: 'youtube', url: 'https://youtube.com/@cilas' },
          { platform: 'twitter', url: 'https://x.com/cilas' },
          { platform: 'youtube', url: 'not a link' },
        ],
      },
    )
    expect(settings.logo.url).toBe('https://ci-las.org/assets/email/logo.png')
    expect(settings.social).toEqual([
      {
        platform: 'YouTube',
        url: 'https://youtube.com/@cilas',
        icon: 'https://ci-las.org/assets/email/youtube.png',
      },
      {
        platform: 'X',
        url: 'https://x.com/cilas',
        icon: 'https://ci-las.org/assets/email/twitter.png',
      },
    ])
    const { html } = await renderEmail(
      <MessageEmail settings={settings} preview="x" paragraphs={['Hi']} />,
    )
    expect(html).toContain('https://ci-las.org/assets/email/youtube.png')
    expect(html).toContain('href="https://x.com/cilas"')
    expect(html).toContain('max-width: 600px')
  })
})

describe('the footer address', () => {
  it('comes from the chosen place, linked to its map', () => {
    const s = withDefaults({
      address_place: { address: 'Somewhere 1, Cairo', map_url: 'https://maps.test/x' },
    })
    expect(s.address).toEqual({ text: 'Somewhere 1, Cairo', url: 'https://maps.test/x' })
  })

  it('falls back to the institute’s address', () => {
    expect(withDefaults({ address_place: { address: '' } }).address.text).toContain(
      'Darb El Labana',
    )
  })
})

describe('reviewMail for courses and publications', () => {
  it('names what is reviewed and links to it in the admin', async () => {
    const settings = withDefaults({})
    const mail = await reviewMail(settings, 'submitted', 'World Cinema', null, {
      noun: 'course',
      url: 'https://cilas.test/admin/collections/courses/7',
    })
    expect(mail.subject).toBe('Submitted for review: World Cinema')
    expect(mail.html).toContain('Course review')
    expect(mail.html).toContain('https://cilas.test/admin/collections/courses/7')
    expect(mail.text).toContain('Open the course')
  })
})
