'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { RichField } from '@/components/rich-field'
import { voteEditAction } from '@/app/(frontend)/[locale]/spaces/actions'

import { saveErrorKey } from './composer'
import { VoteFields, voteFormData, voteReady, type VoteValue } from './vote-fields'
import styles from './space.module.css'

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
  open,
  onOpenChange,
}: {
  post: number
  initial: VoteEditInitial
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('SpacePost')
  const router = useRouter()
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
  const [body, setBody] = useState(initial.body)
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setValue(fresh())
          setBody(initial.body)
          setError(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent title={t('voteEdit')}>
        <div className={styles.column}>
          <RichField
            label={t('voteQuestion')}
            defaultMarkdown={initial.body}
            minHeading={2}
            onChange={(v) => setBody(v.empty ? '' : v.markdown)}
          />
          <VoteFields
            value={value}
            onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
            locks={initial.locks}
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
              disabled={body.trim() === '' || !voteReady(value)}
              onAction={async () => {
                setError(null)
                const form = new FormData()
                form.set('post', String(post))
                form.set('body', body)
                voteFormData(value, form, true)
                const result = await voteEditAction({ status: 'ok' }, form).catch(
                  () => ({ status: 'error', error: 'failed' }) as const,
                )
                if (result.status === 'error') {
                  setError(t(saveErrorKey(result.error)))
                  throw new Error(result.error)
                }
                router.refresh()
                setTimeout(() => onOpenChange(false), 900)
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
