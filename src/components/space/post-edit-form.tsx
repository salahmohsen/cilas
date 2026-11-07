'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Check, Paperclip, Save, X } from 'lucide-react'

import { ActionSwap } from '@/components/arc/action-swap/action-swap'
import { Button } from '@/components/arc/button/button'
import type { SpacesWriteState } from '@/app/(frontend)/[locale]/spaces/actions'
import type { SpaceFileRef } from '@/lib/spaces-data'
import { FILE_LIMITS, SPACE_FILE_ACCEPT, UPLOAD_TOTAL_MAX } from '@/lib/space-file-limits'
import { readDraft, useDraft } from '@/components/use-draft'
import { AttachmentTray } from './attachment-tray'
import { ComposerField, type ComposerSuggestions } from './composer-field'
import { saveErrorKey } from './composer'
import { useAttachments } from './use-attachments'
import styles from './space.module.css'

export type PostEditContext = ComposerSuggestions & { files: SpaceFileRef[] }

/** The discussion composer's surface, with saved files and a save action. */
export function PostEditForm({
  post,
  initialBody,
  context,
  label,
  placeholder,
  words = true,
  ready = true,
  before,
  children,
  uploadBytes = 0,
  onSave,
  onCancel,
}: {
  post: number
  initialBody: string
  context: PostEditContext
  label: string
  placeholder?: string
  words?: boolean
  ready?: boolean
  before?: ReactNode
  children?: ReactNode
  uploadBytes?: number
  onSave: (form: FormData) => Promise<SpacesWriteState>
  onCancel: () => void
}) {
  const t = useTranslations('SpacePost')
  const tf = useTranslations('SpacePhotos')
  const router = useRouter()
  const picker = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    },
    [],
  )
  const draftKey = `space-edit-draft-${post}`
  const [initial] = useState(() => {
    const draft = readDraft<{ original?: unknown; markdown?: unknown }>(draftKey)
    return draft?.original === initialBody && typeof draft.markdown === 'string'
      ? draft.markdown
      : initialBody
  })
  const [body, setBody] = useState({ markdown: initial, empty: !initial.trim() })
  const [removed, setRemoved] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { clear: clearDraft } = useDraft<{ original: string; markdown: string }>(draftKey, {
    enabled: words,
    draft:
      saved || body.markdown === initialBody
        ? null
        : { original: initialBody, markdown: body.markdown },
  })
  const kept = context.files.filter((f) => !removed.includes(f.id))
  const attachments = useAttachments(Math.max(0, FILE_LIMITS.post - kept.length), setError)

  const save = async () => {
    const total = attachments.files.reduce((n, f) => n + f.size, uploadBytes)
    const problem =
      attachments.problem() ??
      (total > UPLOAD_TOTAL_MAX
        ? tf('tooLarge', {
            size: Math.ceil(total / 1024 / 1024),
            max: UPLOAD_TOTAL_MAX / 1024 / 1024,
          })
        : null)
    if (problem) {
      setError(problem)
      throw new Error('files')
    }
    setSaving(true)
    setError(null)
    const form = new FormData()
    form.set('post', String(post))
    if (words) {
      form.set('body', body.markdown)
      for (const file of attachments.files) form.append('file', file)
      for (const id of removed) form.append('remove_file', String(id))
    }
    try {
      const result = await onSave(form)
      if (result.status === 'error') {
        setError(t(saveErrorKey(result.error)))
        throw new Error(result.error)
      }
    } catch (e) {
      setError((current) => current ?? t(saveErrorKey('failed')))
      setSaving(false)
      throw e
    }
    setSaved(true)
    clearDraft()
    router.refresh()
    closeTimer.current = setTimeout(onCancel, 1200)
  }

  return (
    <section className={styles.group} aria-label={label}>
      <fieldset className={styles.editFields} disabled={saving}>
        <div className={styles.groupBody}>
          {before}
          {words && (
            <ComposerField
              mentions={context.mentions}
              sessions={context.sessions}
              label={label}
              hideLabel
              placeholder={placeholder}
              defaultMarkdown={initial}
              disabled={saving}
              onChange={setBody}
            />
          )}
          {children}
          {words && kept.length > 0 && (
            <ul className={styles.tray} aria-label={tf('attachments')}>
              {kept.map((file) => (
                <li key={file.id} className={file.isImage ? styles.trayThumb : styles.trayChip}>
                  {file.isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.url} alt={file.name} />
                  ) : (
                    <>
                      <Paperclip size={14} aria-hidden="true" />
                      <bdi>{file.name}</bdi>
                    </>
                  )}
                  <button
                    type="button"
                    className={styles.trayRemove}
                    aria-label={tf('remove', { name: file.name })}
                    onClick={() => setRemoved((ids) => [...ids, file.id])}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {words && <AttachmentTray files={attachments.files} onRemove={attachments.remove} />}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </div>
        <div className={styles.groupFoot}>
          <span className={styles.rowMain}>
            {words && (
              <>
                <input
                  ref={picker}
                  type="file"
                  multiple
                  hidden
                  accept={SPACE_FILE_ACCEPT}
                  aria-label={t('filesDrop')}
                  onChange={(e) => {
                    const picked = [...(e.currentTarget.files ?? [])]
                    e.currentTarget.value = ''
                    void attachments.add(picked)
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  title={tf('attachLimit', { count: FILE_LIMITS.post })}
                  disabled={
                    kept.length + attachments.files.length >= FILE_LIMITS.post || attachments.busy
                  }
                  onClick={() => picker.current?.click()}
                >
                  <Paperclip size={16} aria-hidden="true" />
                  {t('filesDrop')}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {t('cancel')}
            </Button>
          </span>
          <ActionSwap
            disabled={!ready || (words && body.empty) || attachments.busy || saving}
            failureLabel={t('failed')}
            states={[
              { id: 'idle', label: t('saveEdit'), icon: <Save size={16} />, tone: 'accent' },
              {
                id: 'saved',
                label: t('saved'),
                pendingLabel: t('saving'),
                icon: <Check size={16} />,
                tone: 'success',
                holdFor: 1200,
              },
            ]}
            onAction={(next) => (next.id === 'saved' ? save() : undefined)}
          />
        </div>
      </fieldset>
    </section>
  )
}
