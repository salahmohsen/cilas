// @vitest-environment node
// React Email renders with react-dom/server, which needs Node's streams.
import { describe, expect, it } from 'vitest'

import { MessageEmail } from '@/emails/message'
import { renderEmail } from '@/emails/render'
import { DEFAULT_TEXTS, fill, paragraphs, withDefaults } from '@/emails/settings'
import { acceptanceMail, resetMail, reviewMail } from '@/emails/transactional'

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
