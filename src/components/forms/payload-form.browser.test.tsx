import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PayloadForm } from '@/components/forms/payload-form'
import type { Form } from '@/payload-types'

import { renderWithIntl } from '../../../testing/intl.test-utils'
import { mockNetwork } from '../../../testing/msw-browser.test-utils'

const mona = { email: 'mona@example.com', person: { name: 'Mona Adel' } }
const network = mockNetwork(http.get('/api/users/me', () => HttpResponse.json({ user: mona })))
const nobody = () => http.get('/api/users/me', () => HttpResponse.json({ user: null }))

const formOf = (fields: NonNullable<Form['fields']>) =>
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
  let posts: unknown[] = []
  const accept = () =>
    network.use(
      http.post('/api/form-submissions', async ({ request }) => {
        posts.push(await request.json())
        return HttpResponse.json({}, { status: 201 })
      }),
    )

  beforeEach(() => {
    localStorage.clear()
    posts = []
  })

  afterEach(cleanup)

  it('never posts from preview, including a programmatic form submit', async () => {
    accept()
    const { container } = renderWithIntl(
      <PayloadForm confirmation={null} form={formOf([])} preview />,
    )
    const name = await screen.findByRole('textbox', { name: /Name/ })
    await waitFor(() => expect(name).toHaveValue('Mona Adel'))
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByText('Preview: submitting is turned off')).toBeInTheDocument()
    await act(async () => {
      fireEvent.submit(container.querySelector('form')!)
    })
    expect(posts).toEqual([])
  })

  it('renders a select question as a dropdown, not a text input', async () => {
    renderWithIntl(<PayloadForm confirmation={null} form={formOf([selectBlock as never])} />)
    await screen.findByRole('combobox', { name: /Track/ })
    expect(screen.queryByRole('textbox', { name: /Track/ })).toBeNull()
  })

  it('saves the chosen option as its value', async () => {
    accept()
    renderWithIntl(<PayloadForm confirmation={null} form={formOf([selectBlock as never])} />)
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
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(posts).toHaveLength(1))
    const body = posts[0] as { submissionData: { field: string; value: string }[] }
    expect(body.submissionData.find((a) => a.field === 'track')).toEqual({
      field: 'track',
      value: 'film',
    })
  })

  it('fills name and email from the signed-in account and locks them', async () => {
    renderWithIntl(<PayloadForm confirmation={null} form={formOf([selectBlock as never])} />)
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
    accept()
    renderWithIntl(
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
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    const body = posts[0] as { choices: unknown; submissionData: unknown[] }
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
    accept()
    renderWithIntl(
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
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Why film?' })).toHaveAttribute(
        'aria-invalid',
        'true',
      ),
    )
    expect(posts).toEqual([])
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
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect((posts[0] as { choices: unknown }).choices).toEqual([
      { course: 11, need_reduction: false, answers: [] },
    ])
  })

  it('starts at the admin default and snaps uneven contribution amounts with keys', async () => {
    accept()
    renderWithIntl(
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
    expect(slider).toHaveAttribute('aria-valuetext', '350 EGP')
    expect(slider).toHaveAttribute('aria-valuenow', '1')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider).toHaveAttribute('aria-valuenow', '2')
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Mona Adel'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect((posts[0] as { choices: { amount: number }[] }).choices[0]!.amount).toBe(900)
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
    const view = renderWithIntl(
      <PayloadForm confirmation={null} form={formOf([])} application={application} />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Film' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Why film/ }), {
      target: { value: 'Keep my answer' },
    })
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'I need a lower contribution' }))
    await waitFor(() => expect(localStorage.getItem('cilas-form-7')).toContain('Keep my answer'))
    view.unmount()
    renderWithIntl(<PayloadForm confirmation={null} form={formOf([])} application={application} />)
    expect(screen.getByRole('checkbox', { name: 'Film' })).toBeChecked()
    expect(screen.getByRole('textbox', { name: /Why film/ })).toHaveValue('Keep my answer')
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByRole('checkbox', { name: 'I need a lower contribution' })).toBeChecked()
  })

  it.each([100, 0])('shows a single contribution of %s without a slider', (amount) => {
    renderWithIntl(
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
    expect(screen.getByText(amount === 0 ? /Free/ : /100 EGP/)).toBeVisible()
    expect(screen.queryByRole('checkbox', { name: 'Writing' })).toBeNull()
  })

  it('shows an actionable server error and keeps the answers for correction', async () => {
    network.use(
      http.post('/api/form-submissions', () =>
        HttpResponse.json(
          { errors: [{ message: 'Writing is no longer open for applications.' }] },
          { status: 400 },
        ),
      ),
    )
    renderWithIntl(
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
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(
      await screen.findByText('Writing is no longer open for applications.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Your reason/ })).toHaveValue('Keep this answer')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
  })

  it('says the server failed when it refuses without a reason', async () => {
    network.use(
      nobody(),
      http.post('/api/form-submissions', () => new HttpResponse('Bad gateway', { status: 502 })),
    )
    renderWithIntl(<PayloadForm confirmation={null} form={formOf([])} />)
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), {
      target: { value: 'Mona Adel' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Email/ }), {
      target: { value: 'mona@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(/Our server couldn’t save your answers/)).toBeInTheDocument()
  })

  it('asks the questions open to write in when nobody is signed in', async () => {
    network.use(nobody())
    renderWithIntl(<PayloadForm confirmation={null} form={formOf([selectBlock as never])} />)
    const name = await screen.findByRole('textbox', { name: /Name/ })
    await waitFor(() => expect(name).not.toBeDisabled())
    expect(screen.getByRole('textbox', { name: /Email/ })).toHaveValue('')
  })
})
