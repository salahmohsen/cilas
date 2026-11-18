import { http, HttpResponse } from 'msw'
import type { Payload } from 'payload'
import { beforeEach } from 'vitest'

import { payloadServices } from './fan2-payload-services.test-utils'
import { mockNetwork } from './msw-node.test-utils'

export type SentMail = {
  from: string
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

export const captureResendMail = () => {
  const mail = { sent: [] as SentMail[], failFor: null as string | null }
  const network = mockNetwork(
    http.post('https://api.resend.com/emails', async ({ request }) => {
      const body = (await request.json()) as SentMail
      if (mail.failFor && body.to === mail.failFor) {
        return HttpResponse.json(
          { statusCode: 422, name: 'validation_error', message: 'boom' },
          { status: 422 },
        )
      }
      mail.sent.push(body)
      return HttpResponse.json({ id: `mail-${mail.sent.length}` })
    }),
    ...payloadServices,
  )
  beforeEach(() => {
    mail.sent = []
    mail.failFor = null
  })
  return { mail, network }
}

export const requireResendAdapter = (payload: Payload) => {
  if (payload.email.name !== 'resend-rest') {
    throw new Error('Set RESEND_API_KEY in .env: these tests read mail at the Resend API.')
  }
}
