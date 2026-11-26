'use client'

import { Button, Modal, PopupList, toast, useDocumentInfo, useModal } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { ScrollArea } from '@/components/arc/scroll-area/scroll-area'
import { useCallback, useId, useState } from 'react'

import type { DeleteGroup, DeleteSummary } from '@/lib/delete-summary'

import { postAction } from './post-action'

/** Collections whose stock delete is closed in favour of this dialog. */
export const DIALOG_DELETE = ['spaces', 'courses', 'space-posts'] as const
export type DialogDeleteSlug = (typeof DIALOG_DELETE)[number]

type Loaded = (DeleteSummary & { error?: undefined }) | { error: string }

function Groups({ groups }: { groups: DeleteGroup[] }) {
  return (
    <ScrollArea className="cilas-delete-groups-scroll" fade={0} maxHeight="16rem">
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
    </ScrollArea>
  )
}

/**
 * The delete dialog: lists what goes with the document and what loses its
 * link, and, where the summary says so, asks for its name before the delete runs
 * (src/forms/delete-endpoints.ts). `open(collection, id)` starts it; used by
 * the document menu below and by the list's row actions
 * (src/components/admin/list-row-actions.tsx).
 */
export function useDeleteDialog(onDeleted: () => void) {
  const { openModal, closeModal } = useModal()
  // One slug per dialog: the list's dialog (a provider) stays mounted on the
  // document page beside the menu's, and a shared slug opened both.
  const modalSlug = `delete-dialog-${useId()}`
  // The document and its summary in one value, tagged with the request that
  // opened it: a slow answer to an earlier open cannot fill a later one, so
  // Delete always acts on the document whose summary the dialog shows.
  const [shown, setShown] = useState<{
    collection: DialogDeleteSlug
    id: string
    request: object
    summary: Loaded | null
  } | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  const open = useCallback(
    async (collection: DialogDeleteSlug, id: number | string) => {
      const request = {}
      setShown({ collection, id: String(id), request, summary: null })
      setTyped('')
      openModal(modalSlug)
      const res = await fetch(`/api/${collection}/${id}/delete-summary`, {
        credentials: 'include',
      }).catch(() => null)
      const body = (await res?.json().catch(() => null)) as
        | (DeleteSummary & {
            error?: string
          })
        | null
      const summary: Loaded =
        res?.ok && body && !body.error
          ? body
          : { error: body?.error ?? 'Could not list what this delete removes.' }
      setShown((now) => (now?.request === request ? { ...now, summary } : now))
    },
    [openModal, modalSlug],
  )

  const summary = shown?.summary ?? null
  const loaded = summary && !summary.error ? (summary as DeleteSummary) : null
  const name = loaded?.name ?? ''
  const noun = loaded?.noun ?? 'item'
  const close = () => {
    if (!busy) closeModal(modalSlug)
  }

  const confirm = async () => {
    if (!shown || !loaded) return
    setBusy(true)
    const { ok } = await postAction(
      `/api/${shown.collection}/${shown.id}/delete`,
      'The delete failed. Try again.',
    )
    setBusy(false)
    if (!ok) return
    closeModal(modalSlug)
    toast.success(`Deleted “${name}”.`)
    onDeleted()
  }

  const canDelete = Boolean(loaded)
  const typeToConfirm = loaded?.typeToConfirm ?? true
  const ready = canDelete && name !== '' && (!typeToConfirm || typed.trim() === name) && !busy
  const inputId = `${modalSlug}-name`

  const modal = (
    <Modal
      aria-labelledby={`${modalSlug}-title`}
      className="confirmation-modal"
      closeOnBlur={false}
      slug={modalSlug}
    >
      <div className="confirmation-modal__wrapper">
        <div className="confirmation-modal__content">
          <h1 id={`${modalSlug}-title`}>{name ? `Delete “${name}”?` : 'Delete?'}</h1>
          {!summary ? (
            <p>Finding what this delete removes…</p>
          ) : summary.error ? (
            <p>{summary.error}</p>
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
              {typeToConfirm ? (
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
              ) : null}
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
