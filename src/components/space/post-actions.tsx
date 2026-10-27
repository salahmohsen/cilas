'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import {
  Ellipsis,
  GalleryHorizontal,
  Lock,
  LockOpen,
  Pencil,
  Pin,
  PinOff,
  RectangleHorizontal,
  Trash2,
} from 'lucide-react'

import { ConfirmMorph, type ConfirmMorphState } from '@/components/arc/confirm-morph/confirm-morph'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu'
import {
  postEditAction,
  postModifyAction,
  postRemoveAction,
  type SpacesWriteState,
} from '@/app/(frontend)/[locale]/spaces/actions'

import { PostEditForm, type PostEditContext } from './post-edit-form'
import styles from './space.module.css'
import { EventEditDialog, type EventEditInitial } from './event-edit'
import { VoteEditDialog, type VoteEditInitial } from './vote-edit'

/**
 * `pinnedFull`: pinned whole at the top, not as a card in the carousel.
 * `intro`: the space's intro post, which a moderator edits but never locks or deletes, and which never shows as a card.
 */
type Post = {
  id: number
  body: string
  pinned: boolean
  pinnedFull: boolean
  locked: boolean
  intro?: boolean
}

const run = async (
  action: (prev: SpacesWriteState, form: FormData) => Promise<SpacesWriteState>,
  fields: Record<string, string>,
) => {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  const result = await action({ status: 'ok' }, form)
  if (result.status === 'error') throw new Error(result.error)
}

/** An event post's one edit: the author's words, and its schedule while it may still change. */
export type EventEditMenu = { initial: EventEditInitial; schedule: boolean }

/**
 * A post's own actions (spec §3): authors edit, moderators pin and lock,
 * both delete. An event has one Edit for its words and its schedule, which a
 * moderator may also change. Deleting counts down three seconds, so a slip
 * can be cancelled.
 */
export function PostActions({
  post,
  canEdit,
  canModerate,
  canDelete,
  event,
  vote,
  editor,
}: {
  post: Post
  editor: PostEditContext
  canEdit: boolean
  canModerate: boolean
  canDelete: boolean
  event?: EventEditMenu
  /** A vote post's edit, for its author: the whole vote, not only its words */
  vote?: VoteEditInitial
}) {
  const t = useTranslations('SpacePost')
  const router = useRouter()
  const pathname = usePathname()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState<ConfirmMorphState>('idle')

  const modify = (fields: Record<string, string>) => async () => {
    await run(postModifyAction, { post: String(post.id), ...fields })
    router.refresh()
  }

  const editable = event ? canEdit || event.schedule : canEdit
  const items = [
    ...(editable
      ? [
          {
            label: event ? t('eventEdit') : vote ? t('voteEdit') : t('edit'),
            icon: <Pencil size={15} />,
            onSelect: () => setEditing(true),
          },
        ]
      : []),
    ...(canModerate
      ? [
          ...(post.intro
            ? []
            : post.pinned
              ? [
                  post.pinnedFull
                    ? {
                        label: t('pinAsCard'),
                        icon: <GalleryHorizontal size={15} />,
                        onSelect: modify({ pinnedFull: 'false' }),
                      }
                    : {
                        label: t('pinAsFull'),
                        icon: <RectangleHorizontal size={15} />,
                        onSelect: modify({ pinnedFull: 'true' }),
                      },
                ]
              : [
                  {
                    label: t('pinAsFull'),
                    icon: <RectangleHorizontal size={15} />,
                    onSelect: modify({ pinned: 'true', pinnedFull: 'true' }),
                  },
                ]),
          {
            label: post.pinned ? t('unpin') : t('pinAsCard'),
            icon: post.pinned ? <PinOff size={15} /> : <Pin size={15} />,
            onSelect: post.pinned
              ? modify({ pinned: 'false' })
              : modify({ pinned: 'true', pinnedFull: 'false' }),
          },
          ...(post.intro
            ? []
            : [
                {
                  label: post.locked ? t('unlock') : t('lock'),
                  icon: post.locked ? <LockOpen size={15} /> : <Lock size={15} />,
                  onSelect: modify({ locked: String(!post.locked) }),
                },
              ]),
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: t('delete'),
            icon: <Trash2 size={15} />,
            destructive: true,
            separatorBefore: editable || canModerate,
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
          onConfirm={() => run(postRemoveAction, { post: String(post.id), pathname })}
        />
      )}
      {editing &&
        (event ? (
          <EventEditDialog
            post={post.id}
            initial={event.initial}
            editor={editor}
            words={canEdit}
            schedule={event.schedule}
            open={editing}
            onOpenChange={setEditing}
          />
        ) : vote ? (
          <VoteEditDialog
            post={post.id}
            initial={vote}
            editor={editor}
            open={editing}
            onOpenChange={setEditing}
          />
        ) : (
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogContent title={t('edit')} chrome={false} className={styles.editDialog}>
              {editing && (
                <PostEditForm
                  post={post.id}
                  initialBody={post.body}
                  context={editor}
                  label={t('edit')}
                  placeholder={t('placeholder_discussion')}
                  onSave={(form) => postEditAction({ status: 'ok' }, form)}
                  onCancel={() => setEditing(false)}
                />
              )}
            </DialogContent>
          </Dialog>
        ))}
    </>
  )
}
