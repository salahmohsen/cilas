import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'

import { preloadable } from '@/lib/preloadable'

describe('preloadable', () => {
  it('resumes a suspended import with the same use call and no React warning', async () => {
    const errors = vi.spyOn(console, 'error')
    let resolve!: (component: ComponentType<object>) => void
    const Panel = preloadable(
      () =>
        new Promise<ComponentType<object>>((done) => {
          resolve = done
        }),
      { fallback: 'Loading' },
    )
    await act(async () => {
      render(<Panel />)
    })
    expect(screen.getByText('Loading')).toBeInTheDocument()
    await act(async () => {
      resolve(() => <p>Ready</p>)
    })
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('loads once when the trigger preloads before the panel opens', async () => {
    let loads = 0
    const Preloaded = () => <p>Preloaded</p>
    const load = async () => {
      loads++
      return Preloaded
    }
    const Panel = preloadable(load)
    await act(async () => {
      Panel.preload()
      Panel.preload()
    })
    render(<Panel />)
    expect(screen.getByText('Preloaded')).toBeInTheDocument()
    expect(loads).toBe(1)
  })
})
