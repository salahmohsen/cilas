// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import messages from '../../messages/en.json'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/space-actions', () => ({
  spaceSettingsSetAction: vi.fn(async () => ({ status: 'ok' })),
}))

import { SpaceSettings } from '@/components/space/space-settings'

const mount = (narrow: boolean, onOpenChange = vi.fn()) => {
  window.matchMedia = ((query: string) => ({
    matches: narrow,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
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
        onOpenChange={onOpenChange}
        anchor={<span>anchor</span>}
      />
    </NextIntlClientProvider>,
  )
  return onOpenChange
}

afterEach(cleanup)

describe('SpaceSettings', () => {
  it('opens as a dialog on wide screens, with every field, a save button and a close button', () => {
    const onOpenChange = mount(false)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(messages.Spaces.posting)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.eventsSetting)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.aboutField)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.rulesField)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.saveSettings)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.Spaces.closeSettings }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('opens as a bottom sheet on phones with the same fields', () => {
    mount(true)
    expect(screen.getByText(messages.Spaces.posting)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.saveSettings)).toBeTruthy()
  })
})
