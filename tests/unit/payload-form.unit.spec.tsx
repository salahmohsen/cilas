// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    localStorage.clear()
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

  it('never posts from preview, including a programmatic form submit', async () => {
    const { container } = render(<PayloadForm confirmation={null} form={formOf([])} preview />)
    const name = await screen.findByRole('textbox', { name: /Name/ })
    await waitFor(() => expect(name).toHaveValue('Mona Adel'))
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
    expect(screen.getByText('preview')).toBeInTheDocument()
    await act(async () => {
      fireEvent.submit(container.querySelector('form')!)
    })
    expect(sent.filter((request) => request.method === 'POST')).toEqual([])
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

  it('serializes the existing course page as a cycle choice', async () => {
    render(
      <PayloadForm
        confirmation={null}
        form={formOf([])}
        target={{ relationTo: 'cycles', value: 10 }}
        application={{
          initialCourse: 11,
          selectable: true,
          courses: [
            {
              id: 11,
              title: 'Writing',
              questions: [{ blockType: 'text', name: 'reason', label: 'Why this course?' }],
              contribution: { options: [{ amount: 100, default: true }] },
            },
          ],
        }}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Mona Adel'),
    )
    fireEvent.change(screen.getByRole('textbox', { name: /Why this course/ }), {
      target: { value: 'To learn' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(sent.some((s) => s.method === 'POST')).toBe(true))
    const body = JSON.parse(String(sent.find((s) => s.method === 'POST')!.body))
    expect(body).toMatchObject({
      target: { relationTo: 'cycles', value: 10 },
      choices: [{ course: 11, amount: 100, answers: [{ name: 'reason', value: 'To learn' }] }],
      submissionData: [
        { field: 'name', value: 'Mona Adel' },
        { field: 'email', value: 'mona@example.com' },
      ],
    })
    expect(body.submissionData).toHaveLength(2)
  })

  it('drops required course answers on untick and starts again empty', async () => {
    render(
      <PayloadForm
        confirmation={null}
        form={formOf([])}
        application={{
          initialCourse: 11,
          selectable: true,
          courses: [
            { id: 11, title: 'Writing', questions: [], contribution: null },
            {
              id: 12,
              title: 'Film',
              questions: [
                { blockType: 'text', name: 'reason', label: 'Why film?', required: true },
              ],
              contribution: null,
            },
          ],
        }}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Film' }))
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Mona Adel'),
    )
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Why film?' })).toHaveAttribute(
        'aria-invalid',
        'true',
      ),
    )
    expect(sent.some((s) => s.method === 'POST')).toBe(false)
    fireEvent.change(screen.getByRole('textbox', { name: 'Why film?' }), {
      target: { value: 'Discard me' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Film' }))
    expect(screen.queryByRole('textbox', { name: 'Why film?' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Film' }))
    expect(screen.getByRole('textbox', { name: 'Why film?' })).toHaveValue('')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Film' }))
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Mona Adel'),
    )
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(sent.some((s) => s.method === 'POST')).toBe(true))
    expect(JSON.parse(String(sent.find((s) => s.method === 'POST')!.body)).choices).toEqual([
      { course: 11, need_reduction: false, answers: [] },
    ])
  })

  it('starts at the admin default and snaps uneven contribution amounts with keys', async () => {
    render(
      <PayloadForm
        confirmation={null}
        form={formOf([])}
        application={{
          initialCourse: 11,
          selectable: false,
          courses: [
            {
              id: 11,
              title: 'Writing',
              questions: [],
              contribution: {
                options: [{ amount: 900 }, { amount: 100 }, { amount: 350, default: true }],
              },
            },
          ],
        }}
      />,
    )
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuetext', 'amountEGP')
    expect(slider).toHaveAttribute('aria-valuenow', '1')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider).toHaveAttribute('aria-valuenow', '2')
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Mona Adel'),
    )
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(sent.some((s) => s.method === 'POST')).toBe(true))
    expect(JSON.parse(String(sent.find((s) => s.method === 'POST')!.body)).choices[0].amount).toBe(
      900,
    )
  })

  it('restores course selection, answers and contributions from the device draft', async () => {
    const application = {
      initialCourse: 11,
      selectable: true,
      courses: [
        { id: 11, title: 'Writing', questions: [], contribution: null },
        {
          id: 12,
          title: 'Film',
          questions: [{ blockType: 'text' as const, name: 'reason', label: 'Why film?' }],
          contribution: {
            options: [{ amount: 100, default: true }, { amount: 900 }],
            need_based_deductions: true,
          },
        },
      ],
    }
    const view = render(
      <PayloadForm confirmation={null} form={formOf([])} application={application} />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Film' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Why film/ }), {
      target: { value: 'Keep my answer' },
    })
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'needReduction' }))
    await waitFor(() => expect(localStorage.getItem('cilas-form-7')).toContain('Keep my answer'))
    view.unmount()
    render(<PayloadForm confirmation={null} form={formOf([])} application={application} />)
    expect(screen.getByRole('checkbox', { name: 'Film' })).toBeChecked()
    expect(screen.getByRole('textbox', { name: /Why film/ })).toHaveValue('Keep my answer')
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByRole('checkbox', { name: 'needReduction' })).toBeChecked()
  })

  it.each([100, 0])('shows a single contribution of %s without a slider', (amount) => {
    render(
      <PayloadForm
        confirmation={null}
        form={formOf([])}
        application={{
          initialCourse: 11,
          selectable: false,
          courses: [
            {
              id: 11,
              title: 'Writing',
              questions: [],
              contribution: { options: [{ amount, default: true }] },
            },
          ],
        }}
      />,
    )
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.getByText(amount === 0 ? /free/ : /amountEGP/)).toBeVisible()
    expect(screen.queryByRole('checkbox', { name: 'Writing' })).toBeNull()
  })

  it('shows an actionable server error and keeps the answers for correction', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).startsWith('/api/users/me')
          ? new Response(
              JSON.stringify({
                user: { email: 'mona@example.com', person: { name: 'Mona Adel' } },
              }),
            )
          : new Response(
              JSON.stringify({
                errors: [{ message: 'Writing is no longer open for applications.' }],
              }),
              { status: 400 },
            ),
      ),
    )
    render(
      <PayloadForm
        confirmation={null}
        form={formOf([{ blockType: 'text', name: 'reason', label: 'Your reason' }])}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Mona Adel'),
    )
    fireEvent.change(screen.getByRole('textbox', { name: /Your reason/ }), {
      target: { value: 'Keep this answer' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(
      await screen.findByText('Writing is no longer open for applications.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Your reason/ })).toHaveValue('Keep this answer')
    expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled()
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
