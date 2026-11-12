'use client'

import { Button, Modal, PopupList, toast, useDocumentInfo, useModal } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import type { DeleteGroup, DeleteSummary } from '@/lib/delete-summary'

import { postAction } from './post-action'

/** Collections whose stock delete is closed in favour of this dialog. */
export const DIALOG_DELETE = ['spaces', 'courses'] as const
export type DialogDeleteSlug = (typeof DIALOG_DELETE)[number]

type Loaded = (DeleteSummary & { error?: undefined }) | { error: string }

const MODAL_SLUG = 'delete-dialog'

function Groups({ groups }: { groups: DeleteGroup[] }) {
  return (
    <ul className="cilas-delete-groups">
      {groups.map((g) => (
        <li key={g.label}>
          <strong>
            {g.count} {g.label}
          </strong>
          {g.items.length ? (
            <span>
              : {g.items.join(', ')}
              {g.count > g.items.length ? `, and ${g.count - g.items.length} more` : ''}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * The delete dialog: lists what goes with the document and what loses its
 * link, and asks for its name before the delete runs
 * (src/forms/delete-endpoints.ts). `open(collection, id)` starts it; used by
 * the document menu below and by the list's row actions
 * (src/components/admin/list-row-actions.tsx).
 */
export function useDeleteDialog(onDeleted: () => void) {
  const { openModal, closeModal } = useModal()
  const [target, setTarget] = useState<{ collection: DialogDeleteSlug; id: string } | null>(null)
  const [summary, setSummary] = useState<Loaded | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  const open = useCallback(
    async (collection: DialogDeleteSlug, id: number | string) => {
      setTarget({ collection, id: String(id) })
      setSummary(null)
      setTyped('')
      openModal(MODAL_SLUG)
      const res = await fetch(`/api/${collection}/${id}/delete-summary`, {
        credentials: 'include',
      }).catch(() => null)
      const body = (await res?.json().catch(() => null)) as
        | (DeleteSummary & {
            error?: string
          })
        | null
      setSummary(
        res?.ok && body && !body.error
          ? body
          : { error: body?.error ?? 'Could not list what this delete removes.' },
      )
    },
    [openModal],
  )

  const loaded = summary && !summary.error ? (summary as DeleteSummary) : null
  const name = loaded?.name ?? ''
  const noun = loaded?.noun ?? 'item'
  const close = () => {
    if (!busy) closeModal(MODAL_SLUG)
  }

  const confirm = async () => {
    if (!target) return
    setBusy(true)
    const { ok } = await postAction(
      `/api/${target.collection}/${target.id}/delete`,
      'The delete failed. Try again.',
    )
    setBusy(false)
    if (!ok) return
    closeModal(MODAL_SLUG)
    toast.success(`Deleted “${name}”.`)
    onDeleted()
  }

  const canDelete = Boolean(loaded && !loaded.blocked)
  const ready = canDelete && name !== '' && typed.trim() === name && !busy
  const inputId = `${MODAL_SLUG}-name`

  const modal = (
    <Modal className="confirmation-modal" closeOnBlur={false} slug={MODAL_SLUG}>
      <div className="confirmation-modal__wrapper">
        <div className="confirmation-modal__content">
          <h1>{name ? `Delete “${name}”?` : 'Delete?'}</h1>
          {!summary ? (
            <p>Finding what this delete removes…</p>
          ) : summary.error ? (
            <p>{summary.error}</p>
          ) : loaded?.blocked ? (
            <p>{loaded.blocked}</p>
          ) : loaded ? (
            <>
              {loaded.deletes.length ? (
                <>
                  <p>This permanently deletes the {noun} and:</p>
                  <Groups groups={loaded.deletes} />
                </>
              ) : (
                <p>This permanently deletes the {noun}. Nothing else is deleted with it.</p>
              )}
              {loaded.unlinks.length ? (
                <>
                  <p>These stay, but lose their link to the {noun}:</p>
                  <Groups groups={loaded.unlinks} />
                </>
              ) : null}
              <p>You cannot undo this.</p>
              <label className="cilas-admin-stack" htmlFor={inputId}>
                <span>
                  Type <strong>{name}</strong> to confirm.
                </span>
                <input
                  autoComplete="off"
                  className="cilas-delete-input"
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
          {canDelete ? (
            <Button
              buttonStyle="error"
              disabled={!ready}
              onClick={confirm}
              size="large"
              type="button"
            >
              {busy ? 'Deleting…' : `Delete ${noun}`}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  )

  return { open, modal }
}

/** "Delete" in the document's menu, for a collection whose stock delete is closed. */
export function DeleteMenuItem({ collection }: { collection: DialogDeleteSlug }) {
  const { id } = useDocumentInfo()
  const router = useRouter()
  const { open, modal } = useDeleteDialog(() => router.push(`/admin/collections/${collection}`))
  if (!id) return null
  return (
    <>
      <PopupList.Button onClick={() => void open(collection, id)}>Delete</PopupList.Button>
      {modal}
    </>
  )
}
