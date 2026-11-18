import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { Dialog, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog'
import { PostEditForm, type PostEditContext } from '@/components/space/post-edit-form'
import type { SpacesWriteState } from '@/lib/space-actions'

import messages from '../../../messages/en.json'
import { IntlProvider } from '../../../testing/intl.test-utils'
import { renderWithNavigation } from '../../../testing/navigation.test-utils'

const context: PostEditContext = {
  mentions: [{ id: 7, name: 'Mona' }],
  sessions: [{ id: 'one', label: 'Session one', mention: '#1' }],
  files: [
    {
      id: 9,
      name: 'old.pdf',
      url: '/old.pdf',
      mime: 'application/pdf',
      size: 9,
      isImage: false,
      width: null,
      height: null,
    },
  ],
}

const saved: FormData[] = []
let answer: SpacesWriteState = { status: 'ok' }
let cancelled = 0
const save = async (form: FormData) => {
  saved.push(form)
  return answer
}
const mount = (props: Partial<ComponentProps<typeof PostEditForm>> = {}) =>
  renderWithNavigation(
    <IntlProvider>
      <PostEditForm
        post={42}
        initialBody="Original"
        context={context}
        label="Edit post"
        onSave={save}
        onCancel={() => {
          cancelled += 1
        }}
        {...props}
      />
    </IntlProvider>,
  )
const editor = () => screen.getByRole('textbox', { name: 'Edit post' })
const pixel = () =>
  new File(
    [
      Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
        ),
        (character) => character.charCodeAt(0),
      ),
    ],
    'new.png',
    { type: 'image/png' },
  )

beforeEach(() => {
  saved.length = 0
  answer = { status: 'ok' }
  cancelled = 0
  localStorage.clear()
})
afterEach(cleanup)

describe('composer capabilities while editing', () => {
  it('closes the composer-only dialog with its existing Cancel button', async () => {
    function Editor() {
      const [open, setOpen] = useState(false)
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>Edit</DialogTrigger>
          <DialogContent title="Edit post" chrome={false}>
            <PostEditForm
              post={42}
              initialBody="Original"
              context={context}
              label="Edit post"
              onSave={save}
              onCancel={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )
    }
    renderWithNavigation(
      <IntlProvider>
        <Editor />
      </IntlProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('dialog', { name: 'Edit post' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: messages.SpacePost.cancel }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus()
    expect(saved).toEqual([])
  })

  it('gives the composer editor the stored text, focus, people and sessions to mention', async () => {
    mount()
    expect(editor()).toHaveTextContent('Original')
    await waitFor(() => expect(editor()).toHaveFocus())
    await userEvent.keyboard('{End} @Mo')
    expect(await screen.findByRole('option', { name: '@Mona' })).toBeInTheDocument()
    await userEvent.keyboard('{Enter} #')
    expect(await screen.findByRole('option', { name: 'Session one' })).toBeInTheDocument()
  })

  it('saves edited mention/session markup, new uploads, and removals together', async () => {
    const { container, memory } = mount()
    await userEvent.click(editor())
    await userEvent.keyboard('{End} hi @Mo{Enter} #{Enter}')
    fireEvent.click(screen.getByRole('button', { name: /remove.*old.pdf/i }))
    fireEvent.change(container.querySelector('input[type=file]')!, {
      target: { files: [pixel()] },
    })
    await screen.findByAltText('new.png')
    fireEvent.click(screen.getByRole('button', { name: messages.SpacePost.saveEdit }))
    await waitFor(() => expect(saved).toHaveLength(1))
    const form = saved[0]!
    expect(form.get('body')).toBe('Original hi [@Mona](/people/7)  [#1](session:one)')
    expect(form.get('post')).toBe('42')
    expect(form.getAll('remove_file')).toEqual(['9'])
    expect((form.get('file') as File).name).toBe('new.png')
    await waitFor(() => expect(memory.refreshes).toBeGreaterThan(0))
    expect(localStorage.getItem('space-edit-draft-42')).toBeNull()
  })

  it('keeps text and existing attachments available after a failed save', async () => {
    answer = { status: 'error', error: 'mention' }
    const { memory } = mount()
    await userEvent.click(editor())
    await userEvent.keyboard('{End} more')
    fireEvent.click(screen.getByRole('button', { name: messages.SpacePost.saveEdit }))
    await screen.findByRole('alert')
    expect(editor()).toHaveTextContent('Original more')
    expect(screen.getByText('old.pdf')).toBeInTheDocument()
    expect(memory.refreshes).toBe(0)
    expect(cancelled).toBe(0)
  })

  it('restores only a draft for the same stored body and keeps it separate from creation', () => {
    localStorage.setItem(
      'space-edit-draft-42',
      JSON.stringify({ original: 'Original', markdown: 'Unfinished edit' }),
    )
    localStorage.setItem('space-draft-1', 'New discussion draft')
    const view = mount()
    expect(editor()).toHaveTextContent('Unfinished edit')
    view.unmount()
    mount({ initialBody: 'Changed on the server' })
    expect(editor()).toHaveTextContent('Changed on the server')
    expect(localStorage.getItem('space-draft-1')).toBe('New discussion draft')
  })

  it('keeps a moderator schedule-only edit separate from author content and attachments', async () => {
    mount({ words: false })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText('old.pdf')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: messages.SpacePost.saveEdit }))
    await waitFor(() => expect(saved).toHaveLength(1))
    expect([...saved[0]!.keys()]).toEqual(['post'])
  })
})
