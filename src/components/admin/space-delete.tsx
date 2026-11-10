'use client'

import {
  Button,
  Modal,
  PopupList,
  toast,
  useDocumentInfo,
  useDocumentTitle,
  useModal,
} from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { SpaceContentCounts } from '@/lib/space-delete'

import { postAction } from './post-action'

type Summary = { counts?: SpaceContentCounts; blocked?: string; error?: string }

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

/**
 * "Delete space" in the document's menu (the stock delete is closed, see
 * src/collections/Spaces.ts). Shows what goes with the space, and asks for
 * its name before the delete runs (src/forms/space-delete.ts).
 */
export function SpaceDeleteMenuItem() {
  const { id } = useDocumentInfo()
  const { title } = useDocumentTitle()
  const { openModal, closeModal } = useModal()
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  if (!id) return null
  const slug = `space-delete-${id}`
  const name = (title || '').trim()

  const open = async () => {
    setSummary(null)
    setTyped('')
    openModal(slug)
    const res = await fetch(`/api/spaces/${id}/delete-summary`, { credentials: 'include' }).catch(
      () => null,
    )
    const body = (await res?.json().catch(() => null)) as Summary | null
    setSummary(res?.ok && body ? body : { error: body?.error ?? 'Could not count the content.' })
  }

  const close = () => {
    if (!busy) closeModal(slug)
  }

  const confirm = async () => {
    setBusy(true)
    const { ok } = await postAction(`/api/spaces/${id}/delete`, 'The delete failed. Try again.')
    setBusy(false)
    if (!ok) return
    closeModal(slug)
    toast.success(`Deleted “${name}”.`)
    router.push('/admin/collections/spaces')
  }

  const ready = Boolean(summary?.counts) && typed.trim() === name && !busy

  return (
    <>
      <PopupList.Button onClick={open}>Delete space</PopupList.Button>
      <Modal className="confirmation-modal" closeOnBlur={false} slug={slug}>
        <div className="confirmation-modal__wrapper">
          <div className="confirmation-modal__content">
            <h1>Delete “{name}”?</h1>
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
                <label className="cilas-admin-stack" htmlFor={`${slug}-name`}>
                  <span>
                    Type <strong>{name}</strong> to confirm.
                  </span>
                  <input
                    autoComplete="off"
                    className="cilas-space-delete-input"
                    disabled={busy}
                    id={`${slug}-name`}
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
    </>
  )
}
