// @vitest-environment node
// React Email renders with react-dom/server, which needs Node's streams.
import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { EMAIL_IDS, EMAILS, type EmailId, type VersionOf } from '@/emails/catalog'
import { sampleMail } from '@/emails/samples'
import { withDefaults } from '@/emails/settings'

/** No newsletter issues: the newsletter sample then has nothing to show. */
const payload = { find: async () => ({ docs: [] }) } as unknown as Payload

describe('the email catalog', () => {
  const cases = EMAIL_IDS.filter((id) => id !== 'newsletter').flatMap((id) =>
    (EMAILS[id].localized ? (['en', 'ar'] as const) : (['en'] as const)).flatMap((locale) =>
      Object.keys(EMAILS[id].versions).map((version) => [id, version, locale] as const),
    ),
  )

  it.each(cases)('renders %s (%s) in %s', async (id, version, locale) => {
    const settings = withDefaults({}, { locale })
    const mail = await sampleMail(id as EmailId, version as VersionOf<EmailId>, {
      payload,
      settings,
      locale,
    })
    expect(mail?.subject).toBeTruthy()
    expect(mail?.html).toContain('<html')
    expect(mail?.subject).not.toMatch(/\{\w+\}/)
  })

  it('shows nothing for the newsletter before the first issue', async () => {
    const mail = await sampleMail('newsletter', 'latest', {
      payload,
      settings: withDefaults({}),
      locale: 'en',
    })
    expect(mail).toBeNull()
  })
})

describe('the language of the texts', () => {
  it('uses the Arabic default before the admin’s English text', () => {
    const s = withDefaults(
      {},
      { locale: 'ar', fallback: { texts: { spaces: { stop: 'Stop it all' } } } },
    )
    expect(s.texts.spaces.stop).toBe(EMAILS.spaces.texts.ar.stop)
  })

  it('uses the admin’s English text where an email has no Arabic default', () => {
    const s = withDefaults(
      {},
      { locale: 'ar', fallback: { texts: { acceptance: { button: 'Log in' } } } },
    )
    expect(s.texts.acceptance.button).toBe('Log in')
  })

  it('keeps the admin’s Arabic text first', () => {
    const s = withDefaults(
      { texts: { spaces: { stop: 'أوقف' } } },
      { locale: 'ar', fallback: { texts: { spaces: { stop: 'Stop it all' } } } },
    )
    expect(s.texts.spaces.stop).toBe('أوقف')
  })

  it('writes the digest subject for one item and for many', async () => {
    const settings = withDefaults({})
    const one = await sampleMail('spaces', 'announcement', { payload, settings, locale: 'en' })
    expect(one?.subject).toBe('Announcement in Writing workshop')
    const digest = await sampleMail('spaces', 'digest', { payload, settings, locale: 'en' })
    expect(digest?.subject).toBe('Your CILAS spaces: 5 new items')
  })
})
