import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { SpaceSettings } from '@/components/space/space-settings'

import messages from '../../../messages/en.json'
import { IntlProvider } from '../../../testing/intl.test-utils'
import { renderWithNavigation } from '../../../testing/navigation.test-utils'

const mount = () => {
  const changes: boolean[] = []
  renderWithNavigation(
    <IntlProvider>
      <SpaceSettings
        space={1}
        posting="open"
        events="members"
        archived={false}
        about=""
        aboutDefault="Default about"
        rules=""
        rulesDefault="Default rules"
        open
        onOpenChange={(next) => changes.push(next)}
        anchor={<span>anchor</span>}
        save={async () => ({ status: 'ok' })}
      />
    </IntlProvider>,
  )
  return changes
}

afterEach(cleanup)

describe('SpaceSettings', () => {
  it('opens as a dialog on wide screens, with every field, a save button and a close button', () => {
    const changes = mount()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(messages.Spaces.posting)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.eventsSetting)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.aboutField)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.rulesField)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.saveSettings)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.Spaces.closeSettings }))
    expect(changes).toEqual([false])
  })

  it('opens as a bottom sheet on phones with the same fields', async () => {
    await page.viewport(390, 844)
    mount()
    expect(screen.getByText(messages.Spaces.posting)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.saveSettings)).toBeTruthy()
  })
})
