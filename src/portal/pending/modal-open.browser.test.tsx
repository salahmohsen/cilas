import { act, render, screen } from '@testing-library/react'
import { createTranslator, type AbstractIntlMessages } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { Drawer, DrawerContent } from '@/components/arc/drawer/drawer'
import { ToastStackProvider } from '@/components/arc/toast-stack/toast-stack'
import { calendarLabelsFrom } from '@/components/calendar/ui/calendar-labels'
import { newAllDayBlock } from '@/components/calendar/ui/calendar-model'
import { MoveDialog } from '@/components/calendar/ui/move-dialog'
import { messagesOf } from '../../../testing/intl.test-utils'
import { isModalOpen, observeModals } from './modal-open'

const title = 'Pending decision overlay test'
const messages: AbstractIntlMessages = { CalendarUi: messagesOf.en.CalendarUi }
const labels = calendarLabelsFrom(
  createTranslator({ locale: 'en', messages, namespace: 'CalendarUi' }),
  { kind: () => 'Course', newItem: 'New' },
)

describe('pending: modal detection', () => {
  const overlays = [
    [
      'Arc Dialog',
      <Dialog key="dialog" defaultOpen>
        <DialogContent title={title}>Example</DialogContent>
      </Dialog>,
    ],
    [
      'Arc BottomSheet',
      <BottomSheet key="sheet" defaultOpen title={title}>
        Example
      </BottomSheet>,
    ],
    [
      'Arc Drawer',
      <Drawer key="drawer" defaultOpen>
        <DrawerContent title={title}>Example</DrawerContent>
      </Drawer>,
    ],
  ] as const

  it.each(overlays)('detects %s until it closes', async (_name, overlay) => {
    const change = vi.fn()
    const disconnect = observeModals(change)
    try {
      expect(isModalOpen()).toBe(false)
      render(<ToastStackProvider>{overlay}</ToastStackProvider>)
      await expect.poll(isModalOpen).toBe(true)
      expect(change.mock.calls).toEqual([[true]])
      await userEvent.keyboard('{Escape}')
      await expect.poll(isModalOpen).toBe(false)
      expect(change.mock.calls).toEqual([[true], [false]])
    } finally {
      disconnect()
    }
  })

  it('detects the ui-sdk MoveDialog until it closes', async () => {
    const { unmount } = render(
      <MoveDialog
        block={newAllDayBlock('course', '2026-11-24')}
        labels={labels}
        locale="en"
        range={{ min: 0, max: 1440 }}
        onApply={() => {}}
        onCancel={() => unmount()}
        finalFocus={() => null}
      />,
    )
    await expect.poll(isModalOpen).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: labels.move.cancel }))
    await expect.poll(isModalOpen).toBe(false)
  })

  it('distinguishes a native non-modal dialog from a top-layer modal', () => {
    const dialog = document.createElement('dialog')
    document.body.append(dialog)
    try {
      dialog.show()
      expect(isModalOpen()).toBe(false)
      dialog.close()
      dialog.showModal()
      expect(isModalOpen()).toBe(true)
    } finally {
      act(() => dialog.remove())
    }
  })
})
