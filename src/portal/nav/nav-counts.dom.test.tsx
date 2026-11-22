import { act, cleanup, render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import type { NeedsCounts } from '@/portal/needs/needs'

import { NavCountsProvider, useNavCount } from './nav-counts'
import type { PortalNavItem } from './portal-nav'

afterEach(cleanup)

const counts = (total: number | null, by: NeedsCounts['by'] = {}) =>
  ({ total, by }) satisfies NeedsCounts

function Count({ itemKey }: { itemKey: PortalNavItem['key'] }) {
  return <span data-testid={itemKey}>{String(useNavCount(itemKey))}</span>
}

const view = async (value: NeedsCounts | null, keys: PortalNavItem['key'][]) => {
  const promise = Promise.resolve(value)
  await act(async () => {
    render(
      <NavCountsProvider counts={promise}>
        <Suspense fallback={null}>
          {keys.map((key) => (
            <Count key={key} itemKey={key} />
          ))}
        </Suspense>
      </NavCountsProvider>,
    )
  })
  return Object.fromEntries(keys.map((key) => [key, screen.getByTestId(key).textContent]))
}

describe('useNavCount', () => {
  it("useNavCount('inbox') is the total", async () => {
    expect(await view(counts(5), ['inbox'])).toEqual({ inbox: '5' })
  })

  it('a null counts value gives null on every item', async () => {
    expect(await view(null, ['inbox', 'articles', 'courses', 'home'])).toEqual({
      inbox: 'null',
      articles: 'null',
      courses: 'null',
      home: 'null',
    })
  })

  it('a failed total gives null, and the items with no row give null', async () => {
    expect(await view(counts(null), ['inbox', 'home', 'openDashboard'])).toEqual({
      inbox: 'null',
      home: 'null',
      openDashboard: 'null',
    })
  })

  it("an owner's Articles and Courses give their own counts", async () => {
    expect(
      await view(counts(3, { ownArticles: 2, ownCourses: 1 }), ['articles', 'courses']),
    ).toEqual({ articles: '2', courses: '1' })
  })

  it("an admin's Articles and Courses give null", async () => {
    expect(
      await view(counts(4, { reviewQueue: 3, applicants: 1 }), ['articles', 'courses']),
    ).toEqual({ articles: 'null', courses: 'null' })
  })

  it('no provider gives null', () => {
    render(<Count itemKey="inbox" />)
    expect(screen.getByTestId('inbox').textContent).toBe('null')
  })

  it('shows nothing until the counts settle', async () => {
    let settle!: (value: NeedsCounts) => void
    const promise = new Promise<NeedsCounts | null>((resolve) => (settle = resolve))
    await act(async () => {
      render(
        <NavCountsProvider counts={promise}>
          <Suspense fallback={<span data-testid="waiting" />}>
            <Count itemKey="inbox" />
          </Suspense>
        </NavCountsProvider>,
      )
    })
    expect(screen.getByTestId('waiting')).toBeTruthy()
    await act(async () => settle(counts(2)))
    expect(screen.getByTestId('inbox').textContent).toBe('2')
  })
})
