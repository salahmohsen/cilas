import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { readProfile, saveProfile } from '@/lib/profile'
import { formEmailRichText } from '@/forms/email-rich-text'
import type { User } from '@/payload-types'

const text = (value: string) => ({
  type: 'text',
  version: 1,
  text: value,
  format: 0,
  detail: 0,
  style: '',
  mode: 'normal',
})
const paragraph = (children: unknown[]) => ({
  type: 'paragraph',
  version: 1,
  children,
  format: '',
  indent: 0,
  direction: null,
})
const document = (children: unknown[]) => ({
  root: { type: 'root', version: 1, children, format: '', indent: 0, direction: null },
})

describe('protected profile bios', () => {
  const bio = document([
    paragraph([
      text('Taught by '),
      {
        type: 'inlineBlock',
        version: 1,
        fields: { id: 'm', blockType: 'mention', type: 'person', person: 1, label: 'Mona' },
      },
    ]),
  ])
  const user = { id: 7, person: 7, collection: 'users' } as User

  it('shows a readable bio and refuses a replacement that would discard its mention', async () => {
    const update = vi.fn()
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 7,
        visible: true,
        name: { en: 'Reader', ar: '' },
        bio: { en: bio },
        website: '',
        social_links: [],
      }),
      update,
    } as unknown as Payload
    const profile = await readProfile(payload, user)
    expect(profile?.bio.en).toBe('Taught by Mona')
    expect(profile?.bioReadOnly?.en).toBe(true)
    const result = await saveProfile(payload, user, {
      name: { en: 'Reader', ar: '' },
      bio: { en: 'Replacement', ar: '' },
      website: '',
      socialLinks: [],
    })
    expect(result).toEqual({ ok: false, error: 'bio' })
    expect(update).not.toHaveBeenCalled()
  })
})

describe('form email substitutions', () => {
  it('escapes submitted text, sanitizes substituted links, and keeps the submission ID', async () => {
    const message = document([
      paragraph([
        text('{{name}} {{formSubmissionID}}'),
        {
          type: 'link',
          version: 3,
          fields: { linkType: 'custom', url: '{{url}}' },
          children: [text('Link')],
        },
      ]),
    ])
    const findByID = vi.fn().mockResolvedValue({ emails: [{ message }] })
    const params = {
      data: {
        form: 1,
        submissionData: [
          { field: 'name', value: '<script>bad</script>' },
          { field: 'url', value: 'javascript:alert(1)' },
        ],
      },
      doc: { id: 42 },
      req: { locale: 'en', payload: { findByID } },
    } as unknown as Parameters<typeof formEmailRichText>[1]
    const [mail] = await formEmailRichText(
      [
        {
          to: 'reader@example.com',
          from: 'cilas@example.com',
          replyTo: 'cilas@example.com',
          subject: 'Test',
          html: '',
        },
      ],
      params,
    )
    expect(mail.html).toContain('&lt;script&gt;bad&lt;/script&gt; 42')
    expect(mail.html).not.toContain('href="javascript:')
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ overrideAccess: false }))
  })
})
