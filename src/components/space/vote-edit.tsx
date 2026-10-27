'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { voteEditAction } from '@/app/(frontend)/[locale]/spaces/actions'

import { PostEditForm, type PostEditContext } from './post-edit-form'
import styles from './space.module.css'
import { VoteFields, voteFormData, voteReady, type VoteValue } from './vote-fields'

/** A vote as its edit dialog opens: the closing day as YYYY-MM-DD and time as HH:MM, in Cairo. */
export type VoteEditInitial = {
  body: string
  options: { id: string; label: string; votes: number }[]
  multiple: boolean
  anonymous: boolean
  closes: { day: string; time: string } | null
  /** Rules members' choices hold in place */
  locks: { anonymous: boolean; multiple: boolean }
}

/**
 * The author's edit of a whole vote, as the composer wrote it: the question,
 * the options, the choice rules and the closing time. Renaming an option keeps
 * its choices; removing one takes them back, which its row says before saving.
 */
export function VoteEditDialog({
  post,
  initial,
  editor,
  open,
  onOpenChange,
}: {
  post: number
  editor: PostEditContext
  initial: VoteEditInitial
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('SpacePost')
  const fresh = (): VoteValue => {
    const closes = initial.closes
    const [y = 0, m = 1, d = 1] = (closes?.day ?? '').split('-').map(Number)
    return {
      options: initial.options,
      multiple: initial.multiple,
      anonymous: initial.anonymous,
      closes: closes ? { day: new Date(y, m - 1, d), time: closes.time } : null,
    }
  }
  const [value, setValue] = useState<VoteValue>(fresh)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('voteEdit')} chrome={false} className={styles.editDialog}>
        <PostEditForm
          post={post}
          initialBody={initial.body}
          context={editor}
          label={t('voteQuestion')}
          placeholder={t('placeholder_vote')}
          ready={voteReady(value)}
          onCancel={() => onOpenChange(false)}
          onSave={async (form) => {
            voteFormData(value, form, true)
            return voteEditAction({ status: 'ok' }, form)
          }}
        >
          <VoteFields
            value={value}
            onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
            locks={initial.locks}
          />
        </PostEditForm>
      </DialogContent>
    </Dialog>
  )
}
