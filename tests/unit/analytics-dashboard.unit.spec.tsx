import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rows = vi.hoisted(() => ({ current: {} as Record<string, unknown[][] | Error> }))

vi.mock('@/components/admin/dashboard/posthog', () => ({
  analyticsConfigured: () => true,
  posthogLink: () => 'https://eu.posthog.com/project/1/web',
  posthogRows: async (name: string) => {
    const found = rows.current[name]
    if (found instanceof Error) throw found
    if (!found) throw new Error(`no rows for ${name}`)
    return found
  },
}))
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

import { Guarded } from '@/components/admin/dashboard/isolated'
import { ApplyFunnel, Goals, TopPages } from '@/components/admin/dashboard/widgets/analytics'

beforeEach(() => {
  rows.current = {}
})
afterEach(cleanup)

describe('analytics widgets', () => {
  it('shows the application funnel with each step and its share of the first', async () => {
    rows.current.funnel = [
      ['viewed', 200],
      ['apply_started', 80],
      ['apply_submitted', 20],
    ]
    render(await ApplyFunnel())
    expect(screen.getByRole('progressbar', { name: 'Viewed an application' })).toHaveAttribute(
      'aria-valuenow',
      '200',
    )
    expect(screen.getByRole('progressbar', { name: 'Started it' })).toHaveAttribute(
      'aria-valuetext',
      '40%',
    )
    expect(screen.getByRole('progressbar', { name: 'Sent it' })).toHaveAttribute(
      'aria-valuetext',
      '10%',
    )
  })

  it('says so when nobody has viewed an application', async () => {
    rows.current.funnel = []
    render(await ApplyFunnel())
    expect(screen.getByText('No applications viewed')).toBeInTheDocument()
  })

  it('lists the top pages across both languages', async () => {
    rows.current.pages = [
      ['/en/about', 30, 0],
      ['/ar/about', 10, 0],
      ['/en', 20, 0],
    ]
    render(await TopPages())
    const bars = screen.getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-label'))
    expect(bars).toEqual(['/about', 'Home'])
    expect(screen.getByText('40')).toBeInTheDocument()
  })

  it('lists every goal, with a zero for one never seen', async () => {
    rows.current.goals = [['newsletter_subscribed', 5, 4]]
    render(await Goals())
    expect(screen.getByText('Newsletter signups').nextSibling).toHaveTextContent('5 (+25%)')
    expect(screen.getByText('Sign-ins').nextSibling).toHaveTextContent('0')
  })
})

describe('a failing PostHog', () => {
  const failing = async () => {
    throw new Error('PostHog query failed with status 500')
  }

  it('hides a quiet widget and leaves nothing behind', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(await Guarded({ title: 'Traffic', render: failing, quiet: true }))
    expect(container).toBeEmptyDOMElement()
    expect(spy.mock.calls[0]?.[1]).toBe('PostHog query failed with status 500')
    spy.mockRestore()
  })

  it('still shows the message for an ordinary widget', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(await Guarded({ title: 'Open applications', render: failing }))
    expect(screen.getByText('Could not load')).toBeInTheDocument()
    spy.mockRestore()
  })
})
