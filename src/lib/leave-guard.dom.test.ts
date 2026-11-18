import { afterEach, describe, expect, it, vi } from 'vitest'

import { guardLeaving, leave } from '@/lib/leave-guard'

const releases: (() => void)[] = []
const hold = () => {
  const ask = vi.fn<(go: () => void) => void>()
  releases.push(guardLeaving({ ask, navigate: vi.fn() }))
  return ask
}

afterEach(() => {
  releases.splice(0).forEach((release) => release())
})

describe('the leave guard', () => {
  it('goes at once with no guard held', () => {
    const go = vi.fn()
    leave(go)
    expect(go).toHaveBeenCalledOnce()
  })

  it('asks the newest guard, and gives the question back to the older one on release', () => {
    const editor = hold()
    const form = hold()
    const go = vi.fn()

    leave(go)
    expect(form).toHaveBeenCalledOnce()
    expect(editor).not.toHaveBeenCalled()
    expect(go).not.toHaveBeenCalled()

    releases.pop()!()
    leave(go)
    expect(editor).toHaveBeenCalledOnce()

    releases.pop()!()
    leave(go)
    expect(go).toHaveBeenCalledOnce()
  })

  it('asks once for a link inside the site, with one listener for every guard', () => {
    const editor = hold()
    const form = hold()
    const link = document.createElement('a')
    link.href = '/en/elsewhere'
    document.body.append(link)
    link.click()
    expect(form).toHaveBeenCalledOnce()
    expect(editor).not.toHaveBeenCalled()
    link.remove()
  })
})
