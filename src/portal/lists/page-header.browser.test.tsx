import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import '../../components/arc/foundation.css'
import '../theme/tokens.css'
import { PortalPageHeader } from './page-header'

const tailwindBorderBox = document.createElement('style')
tailwindBorderBox.textContent = '*, ::before, ::after { box-sizing: border-box; }'
document.head.append(tailwindBorderBox)

afterEach(cleanup)

const h1Top = (primary?: { label: string; href: string }, title = 'My articles') => {
  const view = render(<PortalPageHeader title={title} primary={primary} />)
  const top = view.container.querySelector('h1')!.getBoundingClientRect().top
  const bottom = view.container.querySelector('header')!.getBoundingClientRect().bottom
  view.unmount()
  return { top, bottom }
}

describe('PortalPageHeader layout', () => {
  for (const width of [390, 1440])
    it(`the H1 and the list below stay where they are with no header button (${width})`, async () => {
      await page.viewport(width, 800)
      const withButton = h1Top({ label: 'New article', href: '/admin/collections/articles/create' })
      const without = h1Top()
      expect(without.bottom).toBe(withButton.bottom)
      expect(without.top).toBeGreaterThanOrEqual(withButton.top)
    })
})
