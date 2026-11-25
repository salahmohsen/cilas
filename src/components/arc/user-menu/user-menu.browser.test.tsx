import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import '../foundation.css'
import { UserMenu } from './user-menu'

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('dir')
})

describe('UserMenu trigger name', () => {
  it('keeps the start of a long email that names an account, on a right-to-left page', async () => {
    await page.viewport(1440, 800)
    document.documentElement.setAttribute('dir', 'rtl')
    const email = 'portal-student-account-with-a-long-name@cilas.test'
    render(<UserMenu user={{ name: email, email }} showName />)
    const name = screen.getByText(email, { selector: 'button span' })
    expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
    const first = document.createRange()
    first.setStart(name.firstChild!, 0)
    first.setEnd(name.firstChild!, 1)
    const bounds = name.getBoundingClientRect()
    expect(first.getBoundingClientRect().left).toBeGreaterThanOrEqual(bounds.left - 1)
    expect(first.getBoundingClientRect().right).toBeLessThanOrEqual(bounds.right + 1)
  })
})
