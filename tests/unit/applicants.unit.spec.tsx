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

const choice = (
  course: number,
  title: string,
  extra: Partial<ApplicantsData['applications'][0]['choices'][0]> = {},
) => ({
  course,
  title,
  decision: 'pending' as const,
  decided: null,
  emailFailed: false,
  fields: [],
  answers: [],
  cycle: { id: 7 + course, title: 'Fall' },
  cover: undefined,
  contribution: null,
  need_reduction: course === 2,
  amount: 100,
  ...extra,
})
const application = (choices: ReturnType<typeof choice>[]): ApplicantsData['applications'][0] => ({
  id: 10,
  name: 'Applicant',
  email: 'a@example.test',
  submitted: '2026-11-01T12:00:00Z',
  status: 'new',
  decided: null,
  target: 'courses',
  programme: null,
  formId: 1,
  fields: [],
  answers: [],
  choices,
})
const courses = [
  { id: 1, title: 'Writing', count: 1 },
  { id: 2, title: 'History', count: 1 },
]
const data: ApplicantsData = {
  courses,
  applications: [application([choice(1, 'Writing'), choice(2, 'History')])],
}
const single: ApplicantsData = { courses, applications: [application([choice(1, 'Writing')])] }

const view = (ui: ReactNode) =>
  render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={{ Forms: messages.Forms }}>
        {children}
      </NextIntlClientProvider>
    ),
  })
const slow = { timeout: 3000 }
const respond = (body: object, ok = true) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }))
const done = { ok: true, emailed: true, decided: '2026-11-11T10:00:00Z' }
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Review' }))
/** A decision asks first: open the dialog, read what follows, confirm. */
async function accept(label: string) {
  fireEvent.click(screen.getByRole('button', { name: label }))
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

  it('shows one status per course on the card and one Review button, no decision buttons', () => {
    view(<ApplicantsGrid data={data} ar={false} admin />)
    expect(screen.getByRole('heading', { level: 2, name: 'Applications' })).toBeTruthy()
    expect(screen.getAllByText('Pending')).toHaveLength(2)
    expect(screen.getByText('a@example.test')).toBeTruthy()
    expect(screen.getByText('Writing')).toBeTruthy()
    expect(screen.getByText('History')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Review' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /^(Accept|Reject)/ })).toBeNull()
  })

  it('shows each course’s decision and date on its tile', () => {
    const decided = application([
      choice(1, 'Writing', { decision: 'accepted', decided: '2026-11-11T10:00:00Z' }),
      choice(2, 'History', { decision: 'rejected', decided: '2026-11-10T10:00:00Z' }),
    ])
    view(<ApplicantsGrid data={{ courses, applications: [decided] }} ar={false} admin={false} />)
    expect(screen.getByText('Accepted · 11/11/2026')).toBeTruthy()
    expect(screen.getByText('Rejected · 10/11/2026')).toBeTruthy()
  })

  it('opens the application from the name or the Review button', async () => {
    view(<ApplicantsGrid data={data} ar={false} admin />)
    fireEvent.click(screen.getByRole('button', { name: 'Applicant: Writing, History' }))
    expect(await screen.findByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('gives one course Reject and Accept in the detail', () => {
    view(<ApplicantsGrid data={single} ar={false} admin />)
    open()
    expect(screen.getByRole('button', { name: 'Reject: Writing' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accept: Writing' })).toBeTruthy()
  })

  it('lists several courses with their own actions, and a badge once decided', () => {
    const mixed = application([
      choice(1, 'Writing'),
      choice(2, 'History', { decision: 'accepted', decided: '2026-11-11T10:00:00Z' }),
    ])
    view(<ApplicantsGrid data={{ courses, applications: [mixed] }} ar={false} admin />)
    open()
    const list = screen.getByRole('list', { name: 'Course' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(within(list).getByRole('button', { name: 'Accept: Writing' })).toBeTruthy()
    expect(within(list).queryByRole('button', { name: 'Accept: History' })).toBeNull()
    expect(within(list).getByText('Accepted · 11/11/2026')).toBeTruthy()
  })

  it('asks before rejecting one course and keeps API failures visible for retry', async () => {
    respond({ error: 'Decision unavailable. Retry.' }, false)
    view(<ApplicantsGrid data={data} ar={false} admin />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Reject: History' }))
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/courses/'), expect.anything())
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('What happens next')).toBeTruthy()
    expect(within(dialog).getByText(/A kind email goes to a@example.test/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/form-submissions/10/courses/2/reject',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    expect(await within(dialog).findByText('Decision unavailable. Retry.')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('returns focus to the button when the dialog is cancelled', async () => {
    view(<ApplicantsGrid data={data} ar={false} admin />)
    open()
    const reject = screen.getByRole('button', { name: 'Reject: Writing' })
    fireEvent.click(reject)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(document.activeElement).toBe(reject))
  })

  it('shows one accepted course while the other waits, and the application stays pending', async () => {
    navigation.search = 'status=new'
    respond(done)
    view(<ApplicantsGrid data={data} ar={false} admin />)
    open()
    await accept('Accept: Writing')
    expect(await screen.findAllByText('Accepted · 11/11/2026', {}, slow)).not.toHaveLength(0)
    expect(fetch).toHaveBeenCalledWith(
      '/api/form-submissions/10/courses/1/accept',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(screen.queryByText('No matching applications')).toBeNull()
  })

  it('updates a pending filter once the last course is decided', async () => {
    navigation.search = 'status=new'
    respond(done)
    view(<ApplicantsGrid data={single} ar={false} admin />)
    open()
    await accept('Accept: Writing')
    expect(await screen.findByText('No matching applications', {}, slow)).toBeTruthy()
  })

  it('keeps email delivery warnings visible after a status filter removes the card', async () => {
    navigation.search = 'status=new'
    respond({ ...done, emailed: false })
    view(<ApplicantsGrid data={single} ar={false} admin />)
    open()
    await accept('Accept: Writing')
    expect(await screen.findByText('No matching applications', {}, slow)).toBeTruthy()
    expect(
      screen.getByText(
        'The decision is saved, but the email did not send. Contact the applicant directly.',
      ),
    ).toBeTruthy()
  })

  it('marks a decision whose email did not go out, and sends it again', async () => {
    const failed = application([
      choice(1, 'Writing', {
        decision: 'accepted',
        decided: '2026-11-11T10:00:00Z',
        emailFailed: true,
      }),
    ])
    respond({ ok: true, emailed: true, decided: null })
    view(<ApplicantsGrid data={{ courses, applications: [failed] }} ar={false} admin />)
    expect(screen.getAllByText('Email not sent').length).toBeGreaterThan(0)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Send email again: Writing' }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/form-submissions/10/courses/1/resend',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    await waitFor(() => expect(screen.queryAllByText('Email not sent')).toHaveLength(0))
  })

  it('reopens a decided course after confirming, and it waits again', async () => {
    const decided = application([
      choice(1, 'Writing', { decision: 'rejected', decided: '2026-11-11T10:00:00Z' }),
    ])
    respond({ ok: true, emailed: null, decided: null })
    view(<ApplicantsGrid data={{ courses, applications: [decided] }} ar={false} admin />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Reopen: Writing' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/No email goes out/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reopen' }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/form-submissions/10/courses/1/reopen',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    expect(await screen.findByRole('button', { name: 'Accept: Writing' }, slow)).toBeTruthy()
  })

  it('decides a programme application as a whole', async () => {
    const programme = {
      ...application([]),
      target: 'programmes' as const,
      programme: {
        id: 5,
        title: 'Bridge programme',
        cover: undefined,
        decision: 'pending' as const,
        decided: null,
        emailFailed: false,
      },
    }
    respond(done)
    view(<ApplicantsGrid data={{ courses, applications: [programme] }} ar={false} admin />)
    expect(screen.getByText('Bridge programme')).toBeTruthy()
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Accept: Bridge programme' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/A membership in Bridge programme/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept' }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/form-submissions/10/accept',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('filters by the chosen course’s decision, not the whole application’s', () => {
    navigation.search = 'status=new&course=1'
    const mixed = application([
      choice(1, 'Writing', { decision: 'accepted', decided: '2026-11-11T10:00:00Z' }),
      choice(2, 'History'),
    ])
    view(<ApplicantsGrid data={{ courses, applications: [mixed] }} ar={false} admin />)
    expect(screen.getByText('No matching applications')).toBeTruthy()
  })

  it('does not show mutation controls to fellows', () => {
    view(<ApplicantsGrid data={data} ar={false} admin={false} />)
    open()
    expect(screen.queryByRole('button', { name: /^(Accept|Reject)/ })).toBeNull()
  })
})
