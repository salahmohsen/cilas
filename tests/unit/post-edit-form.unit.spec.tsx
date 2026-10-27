import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import messages from '../../messages/en.json'
import { PostEditForm, type PostEditContext } from '@/components/space/post-edit-form'
import type { RichFieldProps } from '@/components/rich-field'
import { Dialog, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog'

const { refresh, field } = vi.hoisted(() => ({ refresh: vi.fn(), field: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/components/space/composer', () => ({
  saveErrorKey: (code: string) => `saveError_${code.replace(/-/g, '_')}`,
}))
vi.mock('@/lib/image-downscale', () => ({ prepareFiles: async (files: File[]) => files }))
vi.mock('@/components/rich-field', () => ({
  RichField: (props: RichFieldProps) => {
    field(props)
    return (
      <textarea
        aria-label={props.label}
        defaultValue={props.defaultMarkdown}
        disabled={props.disabled}
        onChange={(e) =>
          props.onChange?.({
            markdown: e.target.value,
            text: e.target.value,
            html: '',
            empty: !e.target.value.trim(),
          })
        }
      />
    )
  },
}))

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
const save = vi.fn()
const cancel = vi.fn()
const mount = (props: Partial<React.ComponentProps<typeof PostEditForm>> = {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PostEditForm
        post={42}
        initialBody="Original"
        context={context}
        label="Edit post"
        onSave={save}
        onCancel={cancel}
        {...props}
      />
    </NextIntlClientProvider>,
  )
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  save.mockResolvedValue({ status: 'ok' })
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
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Editor />
      </NextIntlClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('dialog', { name: 'Edit post' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: messages.SpacePost.cancel }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus()
    expect(save).not.toHaveBeenCalled()
  })

  it('provides the composer editor with people, sessions, hints, and formatting configuration', () => {
    mount()
    expect(field.mock.calls.at(-1)?.[0]).toMatchObject({
      mentionSuggestions: context.mentions,
      sessionSuggestions: context.sessions,
      minHeading: 2,
      autoFocus: true,
      defaultMarkdown: 'Original',
      sessionLabels: {
        list: messages.SpacePost.sessionList,
        blocks: messages.SpacePost.sessionBlocks,
      },
    })
  })

  it('saves edited mention/session markup, new uploads, and removals together', async () => {
    const { container } = mount()
    const body = 'Hello [@Mona](/people/7)\n\n::session[one]'
    fireEvent.change(screen.getByRole('textbox'), { target: { value: body } })
    fireEvent.click(screen.getByRole('button', { name: /remove.*old.pdf/i }))
    const file = new File(['%PDF-1.4'], 'new.pdf', { type: 'application/pdf' })
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [file] } })
    await screen.findByText('new.pdf')
    fireEvent.click(screen.getByRole('button', { name: messages.SpacePost.saveEdit }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const form = save.mock.calls[0][0] as FormData
    expect(form.get('body')).toBe(body)
    expect(form.get('post')).toBe('42')
    expect(form.getAll('remove_file')).toEqual(['9'])
    expect((form.get('file') as File).name).toBe('new.pdf')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(localStorage.getItem('space-edit-draft-42')).toBeNull()
  })

  it('keeps text and existing attachments available after a failed save', async () => {
    save.mockResolvedValue({ status: 'error', error: 'mention' })
    mount()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My draft' } })
    fireEvent.click(screen.getByRole('button', { name: messages.SpacePost.saveEdit }))
    await screen.findByRole('alert')
    expect(screen.getByRole('textbox')).toHaveValue('My draft')
    expect(screen.getByText('old.pdf')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
  })

  it('restores only a draft for the same stored body and keeps it separate from creation', () => {
    localStorage.setItem(
      'space-edit-draft-42',
      JSON.stringify({ original: 'Original', markdown: 'Unfinished edit' }),
    )
    localStorage.setItem('space-draft-1', 'New discussion draft')
    const view = mount()
    expect(screen.getByRole('textbox')).toHaveValue('Unfinished edit')
    view.unmount()
    mount({ initialBody: 'Changed on the server' })
    expect(screen.getByRole('textbox')).toHaveValue('Changed on the server')
    expect(localStorage.getItem('space-draft-1')).toBe('New discussion draft')
  })

  it('keeps a moderator schedule-only edit separate from author content and attachments', async () => {
    mount({ words: false })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText('old.pdf')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: messages.SpacePost.saveEdit }))
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect([...(save.mock.calls[0][0] as FormData).keys()]).toEqual(['post'])
  })
})
