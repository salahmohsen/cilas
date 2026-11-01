import { afterEach, describe, expect, it, vi } from 'vitest'

import { scrollToSection } from '@/lib/scroll-to-section'

afterEach(() => {
  document.body.innerHTML = ''
  window.history.replaceState(null, '', '/')
})

describe('scrollToSection', () => {
  it('scrolls on every call, also when the address already has the hash', () => {
    document.body.innerHTML = '<section id="open"></section>'
    const section = document.getElementById('open')!
    const scroll = vi.fn()
    section.scrollIntoView = scroll
    expect(scrollToSection('open')).toBe(true)
    expect(window.location.hash).toBe('#open')
    expect(scrollToSection('open')).toBe(true)
    expect(scroll).toHaveBeenCalledTimes(2)
    expect(scroll).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' })
    expect(document.activeElement).toBe(section)
  })

  it('jumps without motion when motion is reduced, and leaves a missing section to the link', () => {
    document.body.innerHTML = '<section id="open"></section>'
    const scroll = vi.fn()
    document.getElementById('open')!.scrollIntoView = scroll
    scrollToSection('open', { reduced: true })
    expect(scroll).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
    expect(scrollToSection('missing')).toBe(false)
  })
})
