import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Dialog, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog'
import styles from '@/components/arc/dialog/dialog.module.css'

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

afterEach(cleanup)

function Example({ chrome = true, bare = false }: { chrome?: boolean; bare?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>Edit</DialogTrigger>
      <DialogContent title="Edit post" description="Change your post" chrome={chrome} bare={bare}>
        <section aria-label="Composer">
          <input aria-label="Post body" />
          <button onClick={() => setOpen(false)}>Cancel</button>
        </section>
      </DialogContent>
    </Dialog>
  )
}

const open = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  return screen.findByRole('dialog', { name: 'Edit post' })
}

const expectClosed = async () => {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus())
}

describe('DialogContent chrome opt-in', () => {
  it('leaves the default title bar, close action, and padded body intact', async () => {
    render(<Example />)
    const dialog = await open()
    expect(dialog).not.toHaveClass(styles.chromeless)
    expect(screen.getByRole('heading', { name: 'Edit post' })).toHaveClass(styles.title)
    expect(screen.getByRole('region', { name: 'Composer' }).parentElement).toHaveClass(styles.body)
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    await expectClosed()
  })

  it('keeps the existing bare dialog floating close control and padded body', async () => {
    render(<Example bare />)
    const dialog = await open()
    expect(dialog).not.toHaveClass(styles.chromeless)
    expect(screen.getByRole('heading', { name: 'Edit post' })).toHaveClass(styles.hidden)
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveClass(styles.floatingClose)
    expect(screen.getByRole('region', { name: 'Composer' }).parentElement).toHaveClass(styles.body)
  })

  it('shows only the child surface while retaining the accessible name and description', async () => {
    render(<Example chrome={false} />)
    const dialog = await open()
    expect(dialog).toHaveClass(styles.chromeless)
    expect(dialog).toHaveAccessibleDescription('Change your post')
    expect(screen.getByRole('heading', { name: 'Edit post' })).toHaveClass(styles.hidden)
    expect(screen.getByText('Change your post')).toHaveClass(styles.hidden)
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Composer' }).parentElement).toBe(dialog)
    expect(document.querySelector('[data-state="open"].' + styles.overlay)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Post body' })).toHaveFocus()
    // Radix wraps keyboard focus at the edges of the modal.
    screen.getByRole('button', { name: 'Cancel' }).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(screen.getByRole('textbox', { name: 'Post body' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await expectClosed()
  })

  it('retains Escape dismissal and returns focus', async () => {
    render(<Example chrome={false} />)
    await open()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await expectClosed()
  })

  it('retains outside pointer dismissal and returns focus', async () => {
    render(<Example chrome={false} />)
    await open()
    // Radix installs its document pointer listener on the next task.
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent(document.body, new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    fireEvent.click(document.body)
    await expectClosed()
  })

  it('supports a plain Radix root without changing the chrome option', () => {
    render(
      <DialogPrimitive.Root defaultOpen>
        <DialogContent title="Edit post" description="Change your post" chrome={false}>
          <button>Cancel</button>
        </DialogContent>
      </DialogPrimitive.Root>,
    )
    expect(screen.getByRole('dialog')).toHaveClass(styles.chromeless, styles.keyframes)
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument()
  })
})
