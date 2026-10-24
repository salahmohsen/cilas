'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Check, Send } from 'lucide-react'

import { ActionSwap } from '@/components/arc/action-swap/action-swap'
import { Alert } from '@/components/arc/alert/alert'
import { FileDropzone } from '@/components/arc/file-dropzone/file-dropzone'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { RichTextEditor } from '@/components/arc/rich-text-editor/rich-text-editor'
import { postCreateAction } from '@/app/(frontend)/[locale]/spaces/actions'

import styles from './space.module.css'

/** `not-member` → `saveError_not_member`: a renamed code fails as a missing key, never as silence. */
export const saveErrorKey = (code: string) => `saveError_${code.replace(/-/g, '_')}`

/**
 * The only way to write a post (spec §5). Moderators choose the announcement
 * kind; an archived space shows the read-only notice instead.
 */
export function Composer({
  space,
  moderator,
  archived,
}: {
  space: number
  moderator: boolean
  archived: boolean
}) {
  const t = useTranslations('SpacePost')
  const router = useRouter()
  const [body, setBody] = useState({ markdown: '', empty: true })
  const [kind, setKind] = useState('discussion')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [round, setRound] = useState(0)

  if (archived) return <Alert tone="info" title={t('readOnlyNotice')} />

  const publish = async () => {
    setError(null)
    const form = new FormData()
    form.set('space', String(space))
    form.set('kind', kind)
    form.set('body', body.markdown)
    for (const f of files) form.append('file', f)
    const result = await postCreateAction({ status: 'ok' }, form)
    if (result.status === 'error') {
      setError(t(saveErrorKey(result.error)))
      throw new Error(result.error)
    }
    setBody({ markdown: '', empty: true })
    setKind('discussion')
    setFiles([])
    setRound((r) => r + 1)
    router.refresh()
  }

  return (
    <section id="composer" aria-label={t('newPost')} className={styles.group}>
      <div className={styles.groupBody}>
        <RichTextEditor
          key={`editor-${round}`}
          aria-label={t('newPost')}
          placeholder={t('placeholder')}
          onChange={(v) => setBody({ markdown: v.markdown, empty: v.empty })}
        />
        {moderator && (
          <RadioGroup
            label={t('kindLabel')}
            value={kind}
            onValueChange={setKind}
            options={[
              { value: 'discussion', label: t('discussion'), description: t('discussionHint') },
              {
                value: 'announcement',
                label: t('placeAnnouncementLabel'),
                description: t('announcementHint'),
              },
            ]}
          />
        )}
        <FileDropzone
          key={`files-${round}`}
          multiple
          maxFiles={5}
          label={t('filesDrop')}
          onFilesChange={setFiles}
        />
      </div>
      <div className={styles.groupFoot}>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : (
          <span />
        )}
        <ActionSwap
          disabled={body.empty}
          failureLabel={t('failed')}
          states={[
            { id: 'idle', label: t('publish'), icon: <Send size={16} />, tone: 'accent' },
            {
              id: 'sent',
              label: t('published'),
              icon: <Check size={16} />,
              tone: 'success',
              pendingLabel: t('publishing'),
              holdFor: 2000,
            },
          ]}
          onAction={(next) => (next.id === 'sent' ? publish() : undefined)}
        />
      </div>
    </section>
  )
}
