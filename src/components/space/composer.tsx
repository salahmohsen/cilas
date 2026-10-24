'use client'

import type { NoticePart } from '@/lib/space-consent'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Check, Paperclip, Send } from 'lucide-react'

import { ActionSwap } from '@/components/arc/action-swap/action-swap'
import { Alert } from '@/components/arc/alert/alert'
import { Avatar } from '@/components/arc/avatar/avatar'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Button } from '@/components/arc/button/button'
import { FileDropzone } from '@/components/arc/file-dropzone/file-dropzone'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { RichTextEditor } from '@/components/arc/rich-text-editor/rich-text-editor'
import { postCreateAction } from '@/app/(frontend)/[locale]/spaces/actions'

import { ConsentSheet } from './consent-sheet'
import styles from './space.module.css'

/** `not-member` → `saveError_not_member`: a renamed code fails as a missing key, never as silence. */
export const saveErrorKey = (code: string) => `saveError_${code.replace(/-/g, '_')}`

/** The checklist's "Introduce yourself" opens the composer through this event. */
export const COMPOSE_EVENT = 'space:compose'

const PHONE = '(max-width: 1023px)'

type Me = { name: string; photo: string | null }

/**
 * The only way to write a post (spec §5). Collapsed to one line so readers
 * meet posts first; inline on desktop, a bottom sheet on phones. The draft
 * survives a closed composer or a reload.
 */
export function Composer({
  space,
  moderator,
  archived,
  me,
  mentions,
  consented,
  notice,
}: {
  space: number
  moderator: boolean
  archived: boolean
  me: Me
  mentions: { id: number; name: string }[]
  consented: boolean
  notice: NoticePart[]
}) {
  const t = useTranslations('SpacePost')
  const ts = useTranslations('Spaces')
  const [open, setOpen] = useState<'inline' | 'sheet' | null>(null)
  const [announce, setAnnounce] = useState('')
  const [asking, setAsking] = useState(false)
  const router = useRouter()
  const where = () => (window.matchMedia(PHONE).matches ? 'sheet' : 'inline')
  const start = () => (consented ? setOpen(where()) : setAsking(true))

  useEffect(() => {
    const onCompose = () => (consented ? setOpen(where()) : setAsking(true))
    window.addEventListener(COMPOSE_EVENT, onCompose)
    return () => window.removeEventListener(COMPOSE_EVENT, onCompose)
  }, [consented])

  if (archived)
    return (
      <Alert tone="info" title={t('readOnlyNotice')}>
        {ts('archivedWhy')}
      </Alert>
    )

  const form = (
    <ComposerForm
      space={space}
      moderator={moderator}
      mentions={mentions}
      onCancel={() => setOpen(null)}
      onPublished={() => {
        setOpen(null)
        setAnnounce(t('published'))
      }}
    />
  )

  return (
    <div id="composer">
      <p role="status" className="sr-only">
        {announce}
      </p>
      {open === 'inline' ? (
        form
      ) : (
        <button type="button" className={styles.prompt} aria-haspopup="dialog" onClick={start}>
          <Avatar name={me.name} src={me.photo ?? undefined} size="sm" />
          <span>{t('writePrompt')}</span>
        </button>
      )}
      <ConsentSheet
        open={asking}
        onOpenChange={setAsking}
        notice={notice}
        onAccepted={() => {
          setAsking(false)
          router.refresh()
          setOpen(where())
        }}
      />
      <BottomSheet
        open={open === 'sheet'}
        onOpenChange={(next) => setOpen(next ? 'sheet' : null)}
        title={t('newPost')}
        detents={[0.92]}
        closeLabel={t('cancel')}
      >
        {open === 'sheet' && form}
      </BottomSheet>
    </div>
  )
}

function ComposerForm({
  space,
  moderator,
  mentions,
  onCancel,
  onPublished,
}: {
  space: number
  moderator: boolean
  mentions: { id: number; name: string }[]
  onCancel: () => void
  onPublished: () => void
}) {
  const t = useTranslations('SpacePost')
  const router = useRouter()
  const draftKey = `space-draft-${space}`
  const [initial] = useState(() => localStorage.getItem(draftKey) ?? '')
  const [body, setBody] = useState({ markdown: initial, empty: initial.trim() === '' })
  const [kind, setKind] = useState('discussion')
  const [showFiles, setShowFiles] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  const publish = async () => {
    setError(null)
    const data = new FormData()
    data.set('space', String(space))
    data.set('kind', kind)
    data.set('body', body.markdown)
    for (const f of files) data.append('file', f)
    const result = await postCreateAction({ status: 'ok' }, data)
    if (result.status === 'error') {
      setError(t(saveErrorKey(result.error)))
      throw new Error(result.error)
    }
    localStorage.removeItem(draftKey)
    router.refresh()
    setTimeout(onPublished, 1200)
  }

  return (
    <section aria-label={t('newPost')} className={styles.group}>
      <div className={styles.groupBody}>
        <RichTextEditor
          autoFocus
          aria-label={t('newPost')}
          placeholder={t('placeholder')}
          defaultMarkdown={initial}
          mentionSuggestions={mentions}
          onChange={(v) => {
            setBody({ markdown: v.markdown, empty: v.empty })
            if (v.empty) localStorage.removeItem(draftKey)
            else localStorage.setItem(draftKey, v.markdown)
          }}
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
        {showFiles && (
          <FileDropzone multiple maxFiles={5} label={t('filesDrop')} onFilesChange={setFiles} />
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
      <div className={styles.groupFoot}>
        <span className={styles.rowMain}>
          {!showFiles && (
            <Button variant="ghost" size="sm" onClick={() => setShowFiles(true)}>
              <Paperclip size={16} aria-hidden="true" />
              {t('filesDrop')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t('cancel')}
          </Button>
        </span>
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
              holdFor: 1200,
            },
          ]}
          onAction={(next) => (next.id === 'sent' ? publish() : undefined)}
        />
      </div>
    </section>
  )
}
