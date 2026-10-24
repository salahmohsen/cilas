'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Ellipsis, Lock, LockOpen, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { ConfirmMorph, type ConfirmMorphState } from '@/components/arc/confirm-morph/confirm-morph'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu'
import { RichTextEditor } from '@/components/arc/rich-text-editor/rich-text-editor'
import {
  postEditAction,
  postModifyAction,
  postRemoveAction,
  type SpacesWriteState,
} from '@/app/(frontend)/[locale]/spaces/actions'

import { saveErrorKey } from './composer'
import styles from './space.module.css'

type Post = { id: number; body: string; pinned: boolean; locked: boolean }

const run = async (
  action: (prev: SpacesWriteState, form: FormData) => Promise<SpacesWriteState>,
  fields: Record<string, string>,
) => {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  const result = await action({ status: 'ok' }, form)
  if (result.status === 'error') throw new Error(result.error)
}

/**
 * A post's own actions (spec §3): authors edit, moderators pin and lock,
 * both delete. Deleting counts down three seconds, so a slip can be cancelled.
 */
export function PostActions({
  post,
  canEdit,
  canModerate,
  canDelete,
}: {
  post: Post
  canEdit: boolean
  canModerate: boolean
  canDelete: boolean
}) {
  const t = useTranslations('SpacePost')
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.body)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ConfirmMorphState>('idle')

  const modify = (fields: Record<string, string>) => async () => {
    await run(postModifyAction, { post: String(post.id), ...fields })
    router.refresh()
  }

  const items = [
    ...(canEdit
      ? [{ label: t('edit'), icon: <Pencil size={15} />, onSelect: () => setEditing(true) }]
      : []),
    ...(canModerate
      ? [
          {
            label: post.pinned ? t('unpin') : t('pin'),
            icon: post.pinned ? <PinOff size={15} /> : <Pin size={15} />,
            onSelect: modify({ pinned: String(!post.pinned) }),
          },
          {
            label: post.locked ? t('unlock') : t('lock'),
            icon: post.locked ? <LockOpen size={15} /> : <Lock size={15} />,
            onSelect: modify({ locked: String(!post.locked) }),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: t('delete'),
            icon: <Trash2 size={15} />,
            destructive: true,
            separatorBefore: canEdit || canModerate,
            onSelect: () => setDeleting('confirming'),
          },
        ]
      : []),
  ]
  if (items.length === 0) return null

  return (
    <>
      {deleting === 'idle' ? (
        <DropdownMenu label={t('more')} items={items} icon={<Ellipsis size={18} />} iconOnly />
      ) : (
        <ConfirmMorph
          label={t('delete')}
          icon={<Trash2 size={16} strokeWidth={1.75} />}
          prompt={t('deletePrompt')}
          confirmLabel={t('delete')}
          cancelLabel={t('cancel')}
          pendingLabel={t('deleting')}
          doneLabel={t('deleted')}
          confirmMode="countdown"
          state={deleting}
          onStateChange={(next) => {
            setDeleting(next)
            if (next === 'idle') router.refresh()
          }}
          onConfirm={() => run(postRemoveAction, { post: String(post.id) })}
        />
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent title={t('edit')}>
          <div className={styles.column}>
            <RichTextEditor
              aria-label={t('edit')}
              defaultMarkdown={post.body}
              onChange={(v) => setDraft(v.markdown)}
            />
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <div>
              <ActionButton
                label={t('saveEdit')}
                pendingLabel={t('saving')}
                successLabel={t('saved')}
                disabled={draft.trim() === ''}
                onAction={async () => {
                  setError(null)
                  try {
                    await run(postEditAction, { post: String(post.id), body: draft })
                  } catch (e) {
                    setError(t(saveErrorKey((e as Error).message)))
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
