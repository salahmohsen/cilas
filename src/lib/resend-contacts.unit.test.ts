import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.RESEND_API_KEY = 'key'
})

import { contactsCsv, listContacts, subscribe, type Contact } from '@/lib/resend-contacts'

import { mockNetwork } from '../../testing/msw-node.test-utils'

const contact = (over: Partial<Contact>) =>
  ({
    id: 'c1',
    email: 'mona@example.com',
    first_name: 'Mona',
    last_name: 'Adel',
    created_at: '2026-10-06 23:47:56.678+00',
    unsubscribed: false,
    ...over,
  }) satisfies Contact

describe('contactsCsv', () => {
  it('writes Mailchimp’s columns for subscribed contacts only', () => {
    const csv = contactsCsv([
      contact({}),
      contact({ id: 'c2', email: 'gone@example.com', unsubscribed: true }),
      contact({ id: 'c3', email: 'q@example.com', first_name: 'Sara, "Sasa"', last_name: null }),
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Email Address,First Name,Last Name,Subscribed At',
      'mona@example.com,Mona,Adel,2026-10-06',
      'q@example.com,"Sara, ""Sasa""",,2026-10-06',
      '',
    ])
  })

  it('adds everyone with a Status column when asked', () => {
    const csv = contactsCsv(
      [contact({}), contact({ id: 'c2', email: 'gone@example.com', unsubscribed: true })],
      {
        all: true,
      },
    )
    expect(csv).toContain('Email Address,First Name,Last Name,Subscribed At,Status')
    expect(csv).toContain('gone@example.com,Mona,Adel,2026-10-06,unsubscribed')
  })
})

describe('Resend calls', () => {
  const network = mockNetwork()

  it('creates a new contact in the segment', async () => {
    const bodies: unknown[] = []
    network.use(
      http.post('https://api.resend.com/contacts', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ id: 'c1' })
      }),
    )
    expect(await subscribe('seg', 'mona@example.com')).toBe(true)
    expect(bodies).toEqual([
      { email: 'mona@example.com', unsubscribed: false, segments: [{ id: 'seg' }] },
    ])
  })

  it('adds an existing contact to the segment and subscribes it again', async () => {
    const calls: string[][] = []
    const seen = (request: Request) => calls.push([request.method, request.url])
    network.use(
      http.post('https://api.resend.com/contacts', ({ request }) => {
        seen(request)
        return HttpResponse.json({ message: 'exists' }, { status: 409 })
      }),
      http.post(
        'https://api.resend.com/contacts/mona%40example.com/segments/seg',
        ({ request }) => {
          seen(request)
          return HttpResponse.json({ id: 'seg' })
        },
      ),
      http.patch('https://api.resend.com/contacts/mona%40example.com', ({ request }) => {
        seen(request)
        return HttpResponse.json({ id: 'c1' })
      }),
    )
    expect(await subscribe('seg', 'mona@example.com')).toBe(true)
    expect(calls).toEqual([
      ['POST', 'https://api.resend.com/contacts'],
      ['POST', 'https://api.resend.com/contacts/mona%40example.com/segments/seg'],
      ['PATCH', 'https://api.resend.com/contacts/mona%40example.com'],
    ])
  })

  it('reads every page of the segment', async () => {
    const afters: (string | null)[] = []
    network.use(
      http.get('https://api.resend.com/segments/seg/contacts', ({ request }) => {
        const after = new URL(request.url).searchParams.get('after')
        afters.push(after)
        return after
          ? HttpResponse.json({ has_more: false, data: [contact({ id: 'b' })] })
          : HttpResponse.json({ has_more: true, data: [contact({ id: 'a' })] })
      }),
    )
    expect((await listContacts('seg')).map((c) => c.id)).toEqual(['a', 'b'])
    expect(afters).toEqual([null, 'a'])
  })
})
