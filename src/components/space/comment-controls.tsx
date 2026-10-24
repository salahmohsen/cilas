'use client'

import type { NoticePart } from '@/lib/space-consent'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Paperclip, Pencil, Reply, Trash2 } from 'lucide-react'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { Button } from '@/components/arc/button/button'
import { ConfirmMorph, type ConfirmMorphState } from '@/components/arc/confirm-morph/confirm-morph'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu'
import { FileDropzone } from '@/components/arc/file-dropzone/file-dropzone'
import {
  MentionInput,
  type MentionInputHandle,
  type MentionPerson,
  type MentionValue,
} from '@/components/arc/mention-input/mention-input'
import {
  commentCreateAction,
  commentEditAction,
  commentRemoveAction,
} from '@/app/(frontend)/[locale]/spaces/actions'
import { fromMentionValue, toMentionValue } from '@/lib/comment-mentions'

import { saveErrorKey } from './composer'
import { ConsentSheet } from './consent-sheet'
import styles from './space.module.css'

const EMPTY: MentionValue = { text: '', mentions: [] }

/**
 * Writes a comment, or a reply under one (spec §4). A reply starts as a
 * "Reply" button so the thread stays readable. The privacy notice comes
 * first for a member who has not accepted it (spec §9).
 */
export function CommentComposer({
  post,
  parent,
  people,
  consented,
  notice,
}: {
  post: number
  /** The comment this replies to; none for a comment on the post */
  parent?: number
  people: MentionPerson[]
  consented: boolean
  notice: NoticePart[]
}) {
  const t = useTranslations('SpaceComment')
  const tp = useTranslations('SpacePost')
  const router = useRouter()
  const [open, setOpen] = useState(parent == null)
  const [value, setValue] = useState<MentionValue>(EMPTY)
  const [showFile, setShowFile] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [asking, setAsking] = useState(false)
  const [accepted, setAccepted] = useState(consented)
  const input = useRef<MentionInputHandle>(null)

  useEffect(() => {
    if (open && parent != null) input.current?.focus()
  }, [open, parent])

  const send = async () => {
    if (!accepted) return setAsking(true)
    setError(null)
    setPending(true)
    const form = new FormData()
    form.set('post', String(post))
    if (parent != null) form.set('parent', String(parent))
    form.set('body', fromMentionValue(value))
    if (file) form.set('file', file)
    const result = await commentCreateAction({ status: 'ok' }, form)
    setPending(false)
    if (result.status === 'error') return setError(tp(saveErrorKey(result.error)))
    setValue(EMPTY)
    setFile(null)
    setShowFile(false)
    if (parent != null) setOpen(false)
    router.refresh()
  }

  if (!open)
    return (
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Reply size={16} aria-hidden="true" />
          {t('reply')}
        </Button>
      </div>
    )

  const label = parent == null ? t('placeholder') : t('replyPlaceholder')
  return (
    <form
      className={styles.column}
      aria-label={label}
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      <MentionInput
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={setValue}
        people={people}
        ref={input}
        minRows={parent == null ? 2 : 1}
        maxRows={8}
      />
      {showFile && (
        <FileDropzone
          maxFiles={1}
          label={t('filesDrop')}
          description={t('maxFiles')}
          onFilesChange={(files) => setFile(files[0] ?? null)}
        />
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.composerActions}>
        <span className={styles.rowMain}>
          {!showFile && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowFile(true)}>
              <Paperclip size={16} aria-hidden="true" />
              {t('filesDrop')}
            </Button>
          )}
          {parent != null && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {tp('cancel')}
            </Button>
          )}
        </span>
        <Button type="submit" size="sm" disabled={pending || value.text.trim() === ''}>
          {pending ? t('sending') : parent == null ? t('write') : t('reply')}
        </Button>
      </div>
      <ConsentSheet
        open={asking}
        onOpenChange={setAsking}
        notice={notice}
        onAccepted={() => {
          setAsking(false)
          setAccepted(true)
          router.refresh()
        }}
      />
    </form>
  )
}

const run = async (
  action: typeof commentEditAction,
  fields: Record<string, string>,
): Promise<void> => {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  const result = await action({ status: 'ok' }, form)
  if (result.status === 'error') throw new Error(result.error)
}

/** A comment's own actions: its author edits, the author or a moderator deletes (spec §3). */
export function CommentActions({
  comment,
  people,
  canEdit,
  canDelete,
}: {
  comment: { id: number; body: string }
  people: MentionPerson[]
  canEdit: boolean
  canDelete: boolean
}) {
  const t = useTranslations('SpaceComment')
  const tp = useTranslations('SpacePost')
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => toMentionValue(comment.body))
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ConfirmMorphState>('idle')

  const items = [
    ...(canEdit
      ? [{ label: t('edit'), icon: <Pencil size={15} />, onSelect: () => setEditing(true) }]
      : []),
    ...(canDelete
      ? [
          {
            label: t('delete'),
            icon: <Trash2 size={15} />,
            destructive: true,
            separatorBefore: canEdit,
            onSelect: () => setDeleting('confirming'),
          },
        ]
      : []),
  ]
  if (items.length === 0) return null

  return (
    <>
      {deleting === 'idle' ? (
        <DropdownMenu label={t('more')} items={items} />
      ) : (
        <ConfirmMorph
          label={t('delete')}
          icon={<Trash2 size={16} strokeWidth={1.75} />}
          prompt={t('deletePrompt')}
          confirmLabel={t('delete')}
          cancelLabel={tp('cancel')}
          pendingLabel={tp('deleting')}
          doneLabel={tp('deleted')}
          confirmMode="countdown"
          state={deleting}
          onStateChange={(next) => {
            setDeleting(next)
            if (next === 'idle') router.refresh()
          }}
          onConfirm={() => run(commentRemoveAction, { comment: String(comment.id) })}
        />
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent title={t('edit')}>
          <div className={styles.column}>
            <MentionInput
              aria-label={t('edit')}
              value={draft}
              onChange={setDraft}
              people={people}
              minRows={3}
              maxRows={10}
            />
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <div>
              <ActionButton
                label={tp('saveEdit')}
                pendingLabel={tp('saving')}
                successLabel={tp('saved')}
                disabled={draft.text.trim() === ''}
                onAction={async () => {
                  setError(null)
                  try {
                    await run(commentEditAction, {
                      comment: String(comment.id),
                      body: fromMentionValue(draft),
                    })
                  } catch (e) {
                    setError(tp(saveErrorKey((e as Error).message)))
                    throw e
                  }
                  router.refresh()
                  setTimeout(() => setEditing(false), 900)
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
