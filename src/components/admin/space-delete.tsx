'use client'

import { Button, Modal, PopupList, toast, useDocumentInfo, useModal } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import type { SpaceContentCounts } from '@/lib/space-delete'

import { postAction } from './post-action'

type Summary = { name?: string; counts?: SpaceContentCounts; blocked?: string; error?: string }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const contentLine = (c: SpaceContentCounts): string => {
  const parts = [
    plural(c.posts, 'post'),
    plural(c.comments, 'comment'),
    plural(c.files, 'file'),
    plural(c.reactions, 'reaction'),
    plural(c.votes, 'vote'),
    plural(c.rsvps, 'RSVP'),
  ]
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

const MODAL_SLUG = 'space-delete'

/**
 * The space delete dialog: shows what goes with the space, and asks for its
 * name before the delete runs (src/forms/space-delete.ts). `open(id)` starts
 * it; used by the document menu below and by the list's row actions
 * (src/components/admin/list-row-actions.tsx).
 */
export function useSpaceDeleteDialog(onDeleted: () => void) {
  const { openModal, closeModal } = useModal()
  const [id, setId] = useState<number | string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  const open = useCallback(
    async (spaceId: number | string) => {
      setId(spaceId)
      setSummary(null)
      setTyped('')
      openModal(MODAL_SLUG)
      const res = await fetch(`/api/spaces/${spaceId}/delete-summary`, {
        credentials: 'include',
      }).catch(() => null)
      const body = (await res?.json().catch(() => null)) as Summary | null
      setSummary(res?.ok && body ? body : { error: body?.error ?? 'Could not count the content.' })
    },
    [openModal],
  )

  const name = summary?.name ?? ''
  const close = () => {
    if (!busy) closeModal(MODAL_SLUG)
  }

  const confirm = async () => {
    setBusy(true)
    const { ok } = await postAction(`/api/spaces/${id}/delete`, 'The delete failed. Try again.')
    setBusy(false)
    if (!ok) return
    closeModal(MODAL_SLUG)
    toast.success(`Deleted “${name}”.`)
    onDeleted()
  }

  const ready = Boolean(summary?.counts) && name !== '' && typed.trim() === name && !busy
  const inputId = `${MODAL_SLUG}-name`

  const modal = (
    <Modal className="confirmation-modal" closeOnBlur={false} slug={MODAL_SLUG}>
      <div className="confirmation-modal__wrapper">
        <div className="confirmation-modal__content">
          <h1>{name ? `Delete “${name}”?` : 'Delete this space?'}</h1>
          {!summary ? (
            <p>Counting what is in this space…</p>
          ) : summary.blocked ? (
            <p>{summary.blocked}</p>
          ) : summary.error ? (
            <p>{summary.error}</p>
          ) : summary.counts ? (
            <>
              <p>
                This permanently deletes the space and everything in it:{' '}
                {contentLine(summary.counts)}. Members lose access, and their notifications about
                this space go too. You cannot undo this.
              </p>
              <label className="cilas-admin-stack" htmlFor={inputId}>
                <span>
                  Type <strong>{name}</strong> to confirm.
                </span>
                <input
                  autoComplete="off"
                  className="cilas-space-delete-input"
                  disabled={busy}
                  id={inputId}
                  onChange={(e) => setTyped(e.target.value)}
                  value={typed}
                />
              </label>
            </>
          ) : null}
        </div>
        <div className="confirmation-modal__controls">
          <Button
            buttonStyle="secondary"
            disabled={busy}
            onClick={close}
            size="large"
            type="button"
          >
            Cancel
          </Button>
          {summary?.counts ? (
            <Button
              buttonStyle="error"
              disabled={!ready}
              onClick={confirm}
              size="large"
              type="button"
            >
              {busy ? 'Deleting…' : 'Delete space'}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  )

  return { open, modal }
}

/** "Delete space" in the document's menu (the stock delete is closed, see src/collections/Spaces.ts). */
export function SpaceDeleteMenuItem() {
  const { id } = useDocumentInfo()
  const router = useRouter()
  const { open, modal } = useSpaceDeleteDialog(() => router.push('/admin/collections/spaces'))
  if (!id) return null
  return (
    <>
      <PopupList.Button onClick={() => void open(id)}>Delete space</PopupList.Button>
      {modal}
    </>
  )
}
