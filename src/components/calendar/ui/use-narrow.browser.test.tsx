import { render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'

import styles from './calendar.module.css'
import { useDocked, useNarrow } from './use-narrow'

function Frame({ width }: { width: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const narrow = useNarrow(frame)
  const docked = useDocked(frame)
  return (
    <div className={styles.root} style={{ inlineSize: width }}>
      <div ref={frame} className={styles.frame}>
        {`narrow: ${narrow}, docked: ${docked}`}
      </div>
    </div>
  )
}

describe('the calendar width flags from its container queries', () => {
  it.each([
    ['30rem', 'narrow: true, docked: false'],
    ['48rem', 'narrow: false, docked: false'],
    ['60rem', 'narrow: false, docked: true'],
  ])('reads a %s calendar as %s', async (width, flags) => {
    render(<Frame width={width} />)
    expect(await screen.findByText(flags)).toBeInTheDocument()
  })

  it('follows the calendar when its width changes', async () => {
    const { rerender } = render(<Frame width="60rem" />)
    expect(await screen.findByText('narrow: false, docked: true')).toBeInTheDocument()
    rerender(<Frame width="30rem" />)
    expect(await screen.findByText('narrow: true, docked: false')).toBeInTheDocument()
  })
})
