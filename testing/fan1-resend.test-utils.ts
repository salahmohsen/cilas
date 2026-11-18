import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'

vi.stubEnv('RESEND_API_KEY', 're_test_key')

export type ResendMail = { to: string | string[]; subject: string }

const recipients = (mail: ResendMail) => (Array.isArray(mail.to) ? mail.to : [mail.to])

/**
 * The Resend REST endpoint as MSW handlers. Import this file before
 * `@/payload.config`: it gives the config a Resend key, so Payload builds its
 * real Resend adapter, and every send lands in `sent` instead of leaving the
 * machine. `fail` makes the next send fail as Resend does.
 */
export const resendInbox = () => {
  const sent: ResendMail[] = []
  const endpoint = 'https://api.resend.com/emails'
  const handler = http.post(endpoint, async ({ request }) => {
    sent.push((await request.json()) as ResendMail)
    return HttpResponse.json({ id: `sent-${sent.length}` })
  })
  const failure = (message: string) =>
    http.post(
      endpoint,
      () =>
        HttpResponse.json({ name: 'application_error', message, statusCode: 500 }, { status: 500 }),
      { once: true },
    )
  return {
    sent,
    handler,
    failure,
    to: (address: string) => sent.filter((mail) => recipients(mail).includes(address)),
  }
}
