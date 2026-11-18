import { http, HttpResponse } from 'msw'
import { beforeEach } from 'vitest'

export type SentMail = {
  from: string
  to: string | string[]
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

const recipients = (mail: SentMail) => (Array.isArray(mail.to) ? mail.to : [mail.to])

/**
 * Resend's send endpoint as an MSW handler. The runner gives Payload a test
 * Resend key, so it builds its real Resend adapter, and each send lands in
 * `sent` instead of leaving the machine. A send to `failFor` fails as Resend
 * refuses a recipient. Both reset before each test.
 */
export const resendInbox = () => {
  const inbox = { sent: [] as SentMail[], failFor: null as string | null }
  beforeEach(() => {
    inbox.sent = []
    inbox.failFor = null
  })
  return Object.assign(inbox, {
    to: (address: string) => inbox.sent.filter((mail) => recipients(mail).includes(address)),
    handler: http.post('https://api.resend.com/emails', async ({ request }) => {
      const mail = (await request.json()) as SentMail
      if (inbox.failFor && recipients(mail).includes(inbox.failFor)) {
        return HttpResponse.json(
          { statusCode: 422, name: 'validation_error', message: 'Recipient refused' },
          { status: 422 },
        )
      }
      inbox.sent.push(mail)
      return HttpResponse.json({ id: `mail-${inbox.sent.length}` })
    }),
  })
}
