import { afterEach, describe, expect, it, vi } from 'vitest'

import { contactsCsv, listContacts, subscribe, type Contact } from '@/lib/resend-contacts'

const contact = (over: Partial<Contact>): Contact => ({
  id: 'c1',
  email: 'mona@example.com',
  first_name: 'Mona',
  last_name: 'Adel',
  created_at: '2026-10-06 23:47:56.678+00',
  unsubscribed: false,
  ...over,
})

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
  afterEach(() => vi.restoreAllMocks())

  it('creates a new contact in the segment', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ id: 'c1' }))
    expect(await subscribe('key', 'seg', 'mona@example.com')).toBe(true)
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://api.resend.com/contacts')
    expect(JSON.parse(init!.body as string)).toEqual({
      email: 'mona@example.com',
      unsubscribed: false,
      segments: [{ id: 'seg' }],
    })
  })

  it('adds an existing contact to the segment and subscribes it again', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ message: 'exists' }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ id: 'seg' }))
      .mockResolvedValueOnce(Response.json({ id: 'c1' }))
    expect(await subscribe('key', 'seg', 'mona@example.com')).toBe(true)
    expect(fetch.mock.calls.map(([url, init]) => [init?.method, url])).toEqual([
      ['POST', 'https://api.resend.com/contacts'],
      ['POST', 'https://api.resend.com/contacts/mona%40example.com/segments/seg'],
      ['PATCH', 'https://api.resend.com/contacts/mona%40example.com'],
    ])
  })

  it('reads every page of the segment', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ has_more: true, data: [contact({ id: 'a' })] }))
      .mockResolvedValueOnce(Response.json({ has_more: false, data: [contact({ id: 'b' })] }))
    expect((await listContacts('key', 'seg')).map((c) => c.id)).toEqual(['a', 'b'])
    expect(String(fetch.mock.calls[1]![0])).toContain('after=a')
  })
})
