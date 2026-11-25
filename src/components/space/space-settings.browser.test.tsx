import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { SpaceSettings } from '@/components/space/space-settings'

import messages from '../../../messages/en.json'
import { IntlProvider } from '../../../testing/intl.test-utils'
import { renderWithNavigation } from '../../../testing/navigation.test-utils'

const mount = (aiButtons?: boolean) => {
  const changes: boolean[] = []
  const saved: FormData[] = []
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
        aiButtons={aiButtons}
        open
        onOpenChange={(next) => changes.push(next)}
        anchor={<span>anchor</span>}
        save={async (form) => {
          saved.push(form)
          return { status: 'ok' }
        }}
      />
    </IntlProvider>,
  )
  return { changes, saved }
}

const aiCheckbox = () => screen.queryByRole('checkbox', { name: messages.Spaces.aiButtons })
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: messages.Spaces.saveSettings }))

afterEach(cleanup)

describe('SpaceSettings', () => {
  it('opens as a dialog on wide screens, with every field, a save button and a close button', () => {
    const { changes } = mount()
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

  it('shows no AI buttons switch, and sends none, in a space without them', async () => {
    const { saved } = mount()
    expect(aiCheckbox()).toBeNull()
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.has('ai_buttons')).toBe(false)
  })

  it('sends the AI buttons switch as it stands, off and on', async () => {
    const { saved } = mount(true)
    const box = aiCheckbox()!
    expect(box.getAttribute('aria-checked')).toBe('true')
    const hint = document.getElementById(box.getAttribute('aria-describedby')!)
    expect(hint?.textContent).toBe(messages.Spaces.aiButtonsHint)
    fireEvent.click(box)
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.get('ai_buttons')).toBe('false')
    cleanup()

    const again = mount(false)
    expect(aiCheckbox()!.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(aiCheckbox()!)
    save()
    await waitFor(() => expect(again.saved).toHaveLength(1))
    expect(again.saved[0]!.get('ai_buttons')).toBe('true')
  })
})
