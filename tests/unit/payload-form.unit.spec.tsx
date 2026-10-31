// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PayloadForm } from '@/components/forms/payload-form'
import type { Form } from '@/payload-types'

vi.mock('@/env.client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/env.client')>()
  // No Turnstile in the sandbox: the widget never answers, so a send waiting
  // on its token would hang.
  return { clientEnv: { ...actual.clientEnv, NEXT_PUBLIC_TURNSTILE_SITE_KEY: '' } }
})
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))
vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; children?: React.ReactNode }) => (
    <a href={props.href}>{props.children}</a>
  ),
}))

/** A form as the apply page sends it: the two defaults first (name, email), then questions. */
const formOf = (fields: NonNullable<Form['fields']>): Form =>
  ({
    id: 7,
    title: 'Application probe',
    fields: [
      { blockType: 'text', name: 'name', label: 'Name', required: true },
      { blockType: 'email', name: 'email', label: 'Email', required: true },
      ...fields,
    ] as NonNullable<Form['fields']>,
  }) as never as Form

const selectBlock = {
  blockType: 'select',
  name: 'track',
  label: 'Track',
  placeholder: 'Which track',
  required: true,
  options: [
    { label: 'Anthropology', value: 'anthro' },
    { label: 'Film', value: 'film' },
  ],
}

describe('the payload form', () => {
  let sent: { url: string; body: unknown; method: string }[] = []

  beforeEach(() => {
    sent = []
    // jsdom draws nothing to scroll; Radix's list scrolls to the chosen item.
    Element.prototype.scrollIntoView = () => {}
    const me = { email: 'mona@example.com', person: { name: 'Mona Adel' } }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        sent.push({ url, body: init?.body ?? null, method: init?.method ?? 'GET' })
        if (url.startsWith('/api/users/me')) return new Response(JSON.stringify({ user: me }))
        return new Response('{}', { status: 201 })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('renders a select question as a dropdown, not a text input', async () => {
    render(<PayloadForm confirmation={null} form={formOf([selectBlock as never])} />)
    await screen.findByRole('combobox', { name: /Track/ })
    expect(screen.queryByRole('textbox', { name: /Track/ })).toBeNull()
  })

  it('sends the chosen option as its label, like the radio answers', async () => {
    render(<PayloadForm confirmation={null} form={formOf([selectBlock as never])} />)
    const trigger = await screen.findByRole('combobox', { name: /Track/ })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    const options = await screen.findAllByRole('option')
    fireEvent.keyDown(options[1]!, { key: 'Enter' })

    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), {
      target: { value: 'Mona Adel' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Email/ }), {
      target: { value: 'mona@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() =>
      expect(sent.filter((s) => s.url.includes('form-submissions'))).toHaveLength(1),
    )
    const create = sent.find((s) => s.url.endsWith('/api/form-submissions'))!
    const body = JSON.parse(String(create.body)) as {
      submissionData: { field: string; value: string }[]
    }
    expect(body.submissionData.find((a) => a.field === 'track')).toEqual({
      field: 'track',
      value: 'Film', // the option's label, not its raw value.
    })
  })

  it('fills name and email from the signed-in account and locks them', async () => {
    render(<PayloadForm confirmation={null} form={formOf([selectBlock as never])} />)
    const name = await screen.findByRole('textbox', { name: /Name/ })
    const email = screen.getByRole('textbox', { name: /Email/ })
    await waitFor(() => {
      expect(name).toBeDisabled()
      expect(email).toBeDisabled()
    })
    expect(name).toHaveValue('Mona Adel')
    expect(email).toHaveValue('mona@example.com')
  })

  it('asks the questions open to write in when nobody is signed in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).startsWith('/api/users/me')
          ? new Response(JSON.stringify({ user: null }))
          : new Response('{}', { status: 201 }),
      ),
    )
    render(<PayloadForm confirmation={null} form={formOf([selectBlock as never])} />)
    const name = await screen.findByRole('textbox', { name: /Name/ })
    await waitFor(() => expect(name).not.toBeDisabled())
    expect(screen.getByRole('textbox', { name: /Email/ })).toHaveValue('')
  })
})
