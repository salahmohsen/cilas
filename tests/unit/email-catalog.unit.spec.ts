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
    })
    expect(mail?.subject).toBeTruthy()
    expect(mail?.html).toContain('<html')
    expect(mail?.subject).not.toMatch(/\{\w+\}/)
  })

  it('shows nothing for the newsletter before the first issue', async () => {
    const mail = await sampleMail('newsletter', 'latest', {
      payload,
      settings: withDefaults({}),
    })
    expect(mail).toBeNull()
  })
})

describe('the language of the texts', () => {
  it('gives every localized email an Arabic text for each English one', () => {
    for (const id of EMAIL_IDS) {
      const email = EMAILS[id]
      if (email.localized)
        expect(Object.keys(email.texts.ar).sort()).toEqual(Object.keys(email.texts.en).sort())
    }
  })

  it('uses the Arabic default where the Arabic text is empty', () => {
    const s = withDefaults({ texts: { acceptance: { button: ' ' } } }, { locale: 'ar' })
    expect(s.texts.acceptance.button).toBe(EMAILS.acceptance.texts.ar.button)
    expect(s.locale).toBe('ar')
  })

  it('keeps the admin’s own text', () => {
    const s = withDefaults({ texts: { spaces: { stop: 'أوقف' } } }, { locale: 'ar' })
    expect(s.texts.spaces.stop).toBe('أوقف')
  })

  it('ignores a text that is not a string', () => {
    const s = withDefaults({ texts: { reset: { subject: 42 as unknown as string } } })
    expect(s.texts.reset.subject).toBe(EMAILS.reset.texts.en.subject)
  })

  it('writes the digest subject for one item and for many', async () => {
    const settings = withDefaults({})
    const one = await sampleMail('spaces', 'announcement', { payload, settings })
    expect(one?.subject).toBe('Announcement in Writing workshop')
    const digest = await sampleMail('spaces', 'digest', { payload, settings })
    expect(digest?.subject).toBe('Your CILAS spaces: 5 new items')
  })
})
