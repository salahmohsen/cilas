import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LiveRegion } from '../feedback/announce'
import { LatestFocus } from './latest-focus'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const rows = (count: number) => (
  <section data-latest>
    <ol>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <a href={`/n/${i + 1}`}>Row {i + 1}</a>
        </li>
      ))}
    </ol>
  </section>
)

describe('LatestFocus', () => {
  it('Show more moves focus to the 31st row and announces the new rows', async () => {
    window.history.replaceState(null, '', '/en/spaces/inbox?latest=2&focus=latest')
    render(
      <>
        <LiveRegion />
        {rows(35)}
        <LatestFocus focus firstNewIndex={30} message="5 more rows." />
      </>,
    )
    expect(document.activeElement).toHaveTextContent('Row 31')
    await nextFrame()
    await nextFrame()
    expect(document.querySelector('[data-portal-live]')).toHaveTextContent('5 more rows.')
    expect(window.location.search).toBe('?latest=2')
  })

  it('does nothing without the focus flag or past the last row', () => {
    render(
      <>
        {rows(3)}
        <LatestFocus focus={false} firstNewIndex={0} message="x" />
        <LatestFocus focus firstNewIndex={30} message="x" />
      </>,
    )
    expect(document.activeElement).toBe(document.body)
  })
})
