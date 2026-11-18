import { within } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import { http, HttpResponse } from 'msw'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { QUERIES, type QueryName } from '@/lib/analytics/queries'

import { importWithEnv } from '../../../../testing/env.test-utils'
import { mockNetwork } from '../../../../testing/msw-node.test-utils'
import { runInRequest } from '../../../../testing/next-request.test-utils'

const network = mockNetwork()

const dashboard = async () => {
  const widgets = await importWithEnv(
    {
      POSTHOG_API_HOST: 'https://eu.posthog.com',
      POSTHOG_PROJECT_ID: '1',
      POSTHOG_PERSONAL_API_KEY: 'phx_test',
    },
    () => import('@/components/admin/dashboard/widgets/analytics'),
  )
  const isolated = await import('@/components/admin/dashboard/isolated')
  return { ...widgets, ...isolated }
}

const answer = (rows: Partial<Record<QueryName, unknown[][]>>) =>
  network.use(
    http.post('https://eu.posthog.com/api/projects/1/query/', async ({ request }) => {
      const { query } = (await request.json()) as { query: { query: string } }
      const name = (Object.keys(QUERIES) as QueryName[]).find(
        (key) => QUERIES[key].replace(/\s+/g, ' ').trim() === query.query,
      )
      const found = name && rows[name]
      return found ? HttpResponse.json({ results: found }) : HttpResponse.error()
    }),
  )

const page = async (build: () => Promise<React.ReactElement>) => {
  const { result } = await runInRequest(build)
  const { window } = new JSDOM(renderToStaticMarkup(result))
  return within(window.document.body)
}

describe('analytics widgets', () => {
  it('shows the application funnel with each step and its share of the first', async () => {
    answer({
      funnel: [
        ['viewed', 200],
        ['apply_started', 80],
        ['apply_submitted', 20],
      ],
    })
    const { ApplyFunnel } = await dashboard()
    const view = await page(ApplyFunnel)
    expect(
      view
        .getByRole('progressbar', { name: 'Viewed an application' })
        .getAttribute('aria-valuenow'),
    ).toBe('200')
    expect(
      view.getByRole('progressbar', { name: 'Started it' }).getAttribute('aria-valuetext'),
    ).toBe('40%')
    expect(view.getByRole('progressbar', { name: 'Sent it' }).getAttribute('aria-valuetext')).toBe(
      '10%',
    )
  })

  it('says so when nobody has viewed an application', async () => {
    answer({ funnel: [] })
    const { ApplyFunnel } = await dashboard()
    const view = await page(ApplyFunnel)
    expect(view.getByText('No applications viewed')).toBeTruthy()
  })

  it('lists the top pages across both languages', async () => {
    answer({
      pages: [
        ['/en/about', 30, 0],
        ['/ar/about', 10, 0],
        ['/en', 20, 0],
      ],
    })
    const { TopPages } = await dashboard()
    const view = await page(TopPages)
    const bars = view.getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-label'))
    expect(bars).toEqual(['/about', 'Home'])
    expect(view.getByText('40')).toBeTruthy()
  })

  it('lists every goal, with a zero for one never seen', async () => {
    answer({ goals: [['newsletter_subscribed', 5, 4]] })
    const { Goals } = await dashboard()
    const view = await page(Goals)
    expect(view.getByText('Newsletter signups').nextSibling?.textContent).toBe('5 (+25%)')
    expect(view.getByText('Sign-ins').nextSibling?.textContent).toBe('0')
  })
})

describe('widget notes', () => {
  it('keeps what a visitor means behind an info button, not in the card text', async () => {
    answer({ funnel: [['viewed', 10]] })
    const { ApplyFunnel } = await dashboard()
    const view = await page(ApplyFunnel)
    expect(view.getByRole('button', { name: 'About Application funnel' })).toBeTruthy()
    expect(view.queryByText(/one person on one day/)).toBeNull()
  })
})

describe('a failing PostHog', () => {
  const failing = async () => {
    throw new Error('PostHog query failed with status 500')
  }

  it('says PostHog failed, and logs only the message, never the key', async () => {
    const { Guarded } = await dashboard()
    const log = vi.spyOn(console, 'error')
    const view = await page(() => Guarded({ title: 'Traffic', render: failing, source: 'PostHog' }))
    expect(view.getByRole('heading', { name: 'Traffic' })).toBeTruthy()
    expect(view.getByText('Could not load from PostHog')).toBeTruthy()
    expect(log.mock.calls[0]?.[1]).toBe('PostHog query failed with status 500')
    log.mockRestore()
  })

  it('still shows the message for an ordinary widget', async () => {
    const { Guarded } = await dashboard()
    const log = vi.spyOn(console, 'error')
    const view = await page(() => Guarded({ title: 'Open applications', render: failing }))
    expect(view.getByText('Could not load')).toBeTruthy()
    log.mockRestore()
  })
})
