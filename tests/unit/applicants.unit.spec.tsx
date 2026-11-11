import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import messages from '../../messages/en.json'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApplicantsGrid } from '@/components/admin/applicants-grid'
import type { ApplicantsData } from '@/forms/applicants'

const navigation = vi.hoisted(() => ({ search: '', push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  usePathname: () => '/admin/applicants',
  useRouter: () => navigation,
}))
vi.mock('@/i18n/navigation', () => ({ Link: 'a' }))
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
      decided: null,
      target: 'courses',
      formId: 1,
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
          contribution: null,
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
          contribution: null,
          need_reduction: true,
          amount: 50,
        },
      ],
    },
  ],
}

const view = (ui: ReactNode) =>
  render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={{ Forms: messages.Forms }}>
        {children}
      </NextIntlClientProvider>
    ),
  })
const slow = { timeout: 3000 }
/** Accept asks first: open the dialog, read what follows, confirm. */
async function accept() {
  fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText(/An email goes to a@example.test/)).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Accept' }))
}

describe('applicant review', () => {
  it('matches course, cycle and reduction on the same choice', () => {
    navigation.search = 'course=1&reduction=yes'
    view(<ApplicantsGrid data={data} ar={false} admin />)
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
    view(<ApplicantsGrid data={data} ar={false} admin />)
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
    view(<ApplicantsGrid data={data} ar={false} admin />)
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(fetcher).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('What happens next')).toBeTruthy()
    expect(within(dialog).getByText(/No email goes to a@example.test/)).toBeTruthy()
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

  it('returns focus to the Reject button when the dialog is cancelled', async () => {
    view(<ApplicantsGrid data={data} ar={false} admin />)
    const reject = screen.getByRole('button', { name: 'Reject' })
    fireEvent.click(reject)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(document.activeElement).toBe(reject))
  })

  it('updates a pending filter immediately after acceptance', async () => {
    navigation.search = 'status=new'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, emailed: true }) }),
    )
    view(<ApplicantsGrid data={data} ar={false} admin />)
    await accept()
    expect(await screen.findByText('No matching applications', {}, slow)).toBeTruthy()
  })

  it('keeps email delivery warnings visible after a status filter removes the card', async () => {
    navigation.search = 'status=new'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, emailed: false }) }),
    )
    view(<ApplicantsGrid data={data} ar={false} admin />)
    await accept()
    expect(await screen.findByText('No matching applications', {}, slow)).toBeTruthy()
    expect(
      screen.getByText('Accepted, but the email did not send. Contact the applicant directly.'),
    ).toBeTruthy()
  })

  it('shows the status above the name and opens the application', async () => {
    view(<ApplicantsGrid data={data} ar={false} admin />)
    expect(screen.getByRole('heading', { level: 2, name: 'Applications' })).toBeTruthy()
    expect(screen.getAllByText(/Pending/).length).toBeGreaterThan(0)
    expect(screen.getByText('a@example.test')).toBeTruthy()
    // One tile per course.
    expect(screen.getByText('Writing')).toBeTruthy()
    expect(screen.getByText('History')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Applicant: Writing, History' }))
    expect(await screen.findByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('shows the decision date in the status once decided', async () => {
    const decided: ApplicantsData = {
      ...data,
      applications: [
        { ...data.applications[0], status: 'accepted', decided: '2026-11-11T10:00:00Z' },
      ],
    }
    view(<ApplicantsGrid data={decided} ar={false} admin={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Applicant: Writing, History' }))
    expect(await screen.findByText('Accepted · 11/11/2026')).toBeTruthy()
  })

  it('does not show mutation controls to fellows', () => {
    view(<ApplicantsGrid data={data} ar={false} admin={false} />)
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull()
  })
})
