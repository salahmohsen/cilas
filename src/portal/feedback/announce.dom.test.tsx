import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { announce, LiveRegion } from './announce'

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const watch = (region: Element) => {
  const seen: string[] = []
  const observer = new MutationObserver(() => seen.push(region.textContent ?? ''))
  observer.observe(region, { childList: true, characterData: true, subtree: true })
  return { seen, stop: () => observer.disconnect() }
}

const mountRegion = () => {
  const view = render(<LiveRegion />)
  const region = view.container.querySelector('[data-portal-live]')!
  return { view, region }
}

describe('announce', () => {
  it('a repeated message clears, then sets again', async () => {
    const { region } = mountRegion()
    const { seen, stop } = watch(region)
    announce('Saved')
    await nextFrame()
    announce('Saved')
    await nextFrame()
    stop()
    expect(seen).toEqual(['Saved', '', 'Saved'])
    expect(region).toHaveAttribute('role', 'status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
  })

  it('two calls in one frame read only the last', async () => {
    const { region } = mountRegion()
    const { seen, stop } = watch(region)
    announce('First')
    announce('Second')
    await nextFrame()
    stop()
    expect(seen).not.toContain('First')
    expect(seen.at(-1)).toBe('Second')
  })

  it('announce with no region mounted does nothing', async () => {
    const { view, region } = mountRegion()
    view.unmount()
    announce('Lost')
    await nextFrame()
    expect(region.textContent).toBe('')
    expect(document.body.textContent).not.toContain('Lost')
  })
})
