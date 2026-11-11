import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApplicantsGrid } from '@/components/admin/applicants-grid'
import { PayloadAnswers } from '@/components/forms/payload-question'
import type { ApplicantsData } from '@/forms/applicants'

const navigation = vi.hoisted(() => ({ search: '', push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  usePathname: () => '/admin/applicants',
  useRouter: () => navigation,
}))
vi.mock('@/components/RichTextField', () => ({ RichTextField: () => null }))

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }))
})
beforeEach(() => {
  navigation.search = ''
  vi.clearAllMocks()
})

const data: ApplicantsData = {
  courses: [
    { id: 1, title: 'Writing', count: 1 },
    { id: 2, title: 'History', count: 1 },
  ],
  applications: [
    {
      id: 10,
      name: 'Applicant',
      email: 'a@example.test',
      submitted: '2026-11-01T12:00:00Z',
      status: 'new',
      canAccept: true,
      fields: [],
      answers: [],
      choices: [
        {
          course: 1,
          title: 'Writing',
          accepted: true,
          fields: [],
          answers: [],
          cycle: { id: 7, title: 'Fall' },
          cover: undefined,
          need_reduction: false,
          amount: 100,
        },
        {
          course: 2,
          title: 'History',
          accepted: true,
          fields: [],
          answers: [],
          cycle: { id: 8, title: 'Spring' },
          cover: undefined,
          need_reduction: true,
          amount: 50,
        },
      ],
    },
  ],
}

describe('applicant review', () => {
  it('matches course, cycle and reduction on the same choice', () => {
    navigation.search = 'course=1&reduction=yes'
    render(<ApplicantsGrid data={data} ar={false} admin />)
    expect(screen.getByText('No matching applications')).toBeTruthy()
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Applicants' })).getByRole('button', {
        name: 'Clear filters',
      }),
    )
    expect(navigation.push).toHaveBeenCalledWith('/admin/applicants?', { scroll: false })
  })

  it('keeps unrelated URL parameters when clearing filters', () => {
    navigation.search = 'status=rejected&locale=ar'
    render(<ApplicantsGrid data={data} ar={false} admin />)
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Applicants' })).getByRole('button', {
        name: 'Clear filters',
      }),
    )
    expect(navigation.push).toHaveBeenCalledWith('/admin/applicants?locale=ar', { scroll: false })
  })

  it('requires rejection confirmation and keeps API failures visible for retry', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Decision unavailable. Retry.' }),
    })
    vi.stubGlobal('fetch', fetcher)
    render(<ApplicantsGrid data={data} ar={false} admin />)
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(fetcher).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        '/api/form-submissions/10/reject',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    expect(await within(dialog).findByText('Decision unavailable. Retry.')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('updates a pending filter immediately after acceptance', async () => {
    navigation.search = 'status=new'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, emailed: true }) }),
    )
    render(<ApplicantsGrid data={data} ar={false} admin />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(await screen.findByText('No matching applications')).toBeTruthy()
  })

  it('keeps email delivery warnings visible after a status filter removes the card', async () => {
    navigation.search = 'status=new'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, emailed: false }) }),
    )
    render(<ApplicantsGrid data={data} ar={false} admin />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(await screen.findByText('No matching applications')).toBeTruthy()
    expect(
      screen.getByText('Accepted, but the email did not send. Contact the applicant directly.'),
    ).toBeTruthy()
  })

  it('shows status and keeps decisions out of the card open trigger', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, emailed: true }) }),
    )
    render(<ApplicantsGrid data={data} ar={false} admin />)
    expect(screen.getByRole('heading', { level: 2, name: 'Applications' })).toBeTruthy()
    expect(screen.getAllByText(/Pending/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Accepted/ })).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Applicant' }))
    expect(await screen.findByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('does not show mutation controls to fellows', () => {
    render(<ApplicantsGrid data={data} ar={false} admin={false} />)
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull()
  })

  it('preserves historical answers and renders every answer read only', () => {
    render(
      <PayloadAnswers
        fields={[
          {
            blockType: 'select',
            name: 'choice',
            label: 'Choice',
            options: [{ value: 'current', label: 'Current option' }],
          },
        ]}
        answers={[
          { name: 'choice', label: 'Saved question', value: 'retired' },
          { name: 'removed', label: 'Removed question', value: 'Original answer' },
        ]}
      />,
    )
    expect(screen.getByLabelText('Saved question')).toHaveProperty('value', 'retired')
    expect(screen.getByLabelText('Removed question')).toHaveProperty('value', 'Original answer')
    for (const input of screen.getAllByRole('textbox'))
      expect(input).toHaveProperty('readOnly', true)
  })
})
