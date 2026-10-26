'use client'

import type { NoticePart } from '@/lib/space-consent'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Check, Paperclip, Plus, Send, X } from 'lucide-react'

import { ActionSwap } from '@/components/arc/action-swap/action-swap'
import { Alert } from '@/components/arc/alert/alert'
import { Avatar } from '@/components/arc/avatar/avatar'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Button } from '@/components/arc/button/button'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { Input } from '@/components/arc/input/input'
import { RichField } from '@/components/rich-field'
import { Select } from '@/components/arc/select/select'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { postCreateAction, type SpacesWriteState } from '@/app/(frontend)/[locale]/spaces/actions'
import { FILE_LIMITS, SPACE_FILE_ACCEPT, UPLOAD_TOTAL_MAX } from '@/lib/space-file-limits'
import { EVENT_TITLE_MAX, SESSION_KINDS, VOTE_OPTIONS } from '@/lib/space-post-kinds'

import { AttachmentTray } from './attachment-tray'
import { EventFields, NO_COVER, endsEarly, eventFormData, type EventValue } from './event-fields'
import { useAttachments } from './use-attachments'
import { ConsentSheet } from './consent-sheet'
import styles from './space.module.css'

/** `not-member` → `saveError_not_member`: a renamed code fails as a missing key, never as silence. */
export const saveErrorKey = (code: string) => `saveError_${code.replace(/-/g, '_')}`

/** The checklist's "Introduce yourself" opens the composer through this event. */
export const COMPOSE_EVENT = 'space:compose'

const PHONE = '(max-width: 1023px)'

const MB = 1024 * 1024

type Me = { name: string; photo: string | null }

export type SessionChoice = { value: string; label: string }

/** The select's "no session" choice: Radix gives an empty value no item. */
const NO_SESSION = 'none'

/** The kinds this member may start here, in the order the type switch shows them. */
export type PostKind = 'discussion' | 'event' | 'vote' | 'announcement'

/**
 * The only way to write a post (spec §5). Collapsed to one line so readers
 * meet posts first; inline on desktop, a bottom sheet on phones. The draft
 * survives a closed composer or a reload.
 */
export function Composer({
  space,
  kinds,
  archived,
  me,
  mentions,
  consented,
  notice,
  sessions = [],
}: {
  space: number
  /** Empty when the posting level keeps this member to reading and commenting */
  kinds: PostKind[]
  archived: boolean
  me: Me
  mentions: { id: number; name: string }[]
  consented: boolean
  notice: NoticePart[]
  /** The course's sessions a post may point at; empty outside a course space */
  sessions?: SessionChoice[]
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

  if (kinds.length === 0) return null
  if (archived)
    return (
      <Alert tone="info" title={t('readOnlyNotice')}>
        {ts('archivedWhy')}
      </Alert>
    )

  const form = (
    <ComposerForm
      space={space}
      kinds={kinds}
      mentions={mentions}
      sessions={sessions}
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

/** An event's place and Cairo times; a vote's options and whether more than one may be chosen. */
type Extra = EventValue & {
  title: string
  options: string[]
  multiple: boolean
  anonymous: boolean
}

const EMPTY_EXTRA: Extra = {
  title: '',
  location: '',
  day: undefined,
  time: '18:00',
  endTime: null,
  cover: NO_COVER,
  options: ['', ''],
  multiple: false,
  anonymous: false,
}

function ComposerForm({
  space,
  kinds,
  mentions,
  sessions,
  onCancel,
  onPublished,
}: {
  space: number
  kinds: PostKind[]
  mentions: { id: number; name: string }[]
  sessions: SessionChoice[]
  onCancel: () => void
  onPublished: () => void
}) {
  const t = useTranslations('SpacePost')
  const router = useRouter()
  const draftKey = `space-draft-${space}`
  const [initial] = useState(() => localStorage.getItem(draftKey) ?? '')
  const [body, setBody] = useState({ markdown: initial, empty: initial.trim() === '' })
  const [kind, setKind] = useState<PostKind>(kinds[0] ?? 'discussion')
  const [extra, setExtra] = useState<Extra>(EMPTY_EXTRA)
  const [session, setSession] = useState(NO_SESSION)
  const sessionShown = sessions.length > 0 && SESSION_KINDS.includes(kind)
  const picker = useRef<HTMLInputElement>(null)
  const tf = useTranslations('SpacePhotos')
  const [error, setError] = useState<string | null>(null)
  const attachments = useAttachments(FILE_LIMITS.post, setError)
  const { files } = attachments
  const set = (patch: Partial<Extra>) => setExtra((current) => ({ ...current, ...patch }))
  const options = extra.options.map((o) => o.trim()).filter(Boolean)
  const ready =
    !body.empty &&
    (kind !== 'event' ||
      (extra.title.trim() !== '' &&
        extra.location.trim() !== '' &&
        extra.day !== undefined &&
        !endsEarly(extra))) &&
    (kind !== 'vote' || options.length >= VOTE_OPTIONS.min)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const publish = async () => {
    const cover = kind === 'event' ? (extra.cover.file?.size ?? 0) : 0
    const total = files.reduce((sum, f) => sum + f.size, cover)
    const tooLarge =
      attachments.problem() ??
      (total > UPLOAD_TOTAL_MAX
        ? tf('tooLarge', { size: Math.ceil(total / MB), max: UPLOAD_TOTAL_MAX / MB })
        : null)
    if (tooLarge) {
      setError(tooLarge)
      throw new Error('files')
    }
    setError(null)
    const data = new FormData()
    data.set('space', String(space))
    data.set('kind', kind)
    data.set('body', body.markdown)
    if (kind === 'event') {
      eventFormData(extra, data)
      data.set('title', extra.title)
    }
    if (kind === 'vote') {
      for (const option of options) data.append('option', option)
      data.set('multiple', String(extra.multiple))
      data.set('anonymous', String(extra.anonymous === true))
    }
    if (sessionShown && session !== NO_SESSION) data.set('session', session)
    for (const f of files) data.append('file', f)
    const result = await postCreateAction({ status: 'ok' }, data).catch((): SpacesWriteState => ({
      status: 'error',
      error: 'failed',
    }))
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
        {kinds.length > 1 && (
          <SegmentedControl
            label={t('kindLabel')}
            value={kind}
            onValueChange={(next) => setKind(next as PostKind)}
            options={kinds.map((k) => ({ value: k, label: t(`kind_${k}`) }))}
          />
        )}
        {kind === 'event' && (
          <Input
            label={t('eventTitle')}
            value={extra.title}
            maxLength={EVENT_TITLE_MAX}
            onChange={(e) => set({ title: e.currentTarget.value })}
          />
        )}
        <RichField
          autoFocus
          label={kind === 'event' ? t('eventDescription') : t('newPost')}
          hideLabel={kind !== 'event'}
          placeholder={t(`placeholder_${kind}`)}
          defaultMarkdown={initial}
          mentionSuggestions={mentions}
          onChange={(v) => {
            setBody({ markdown: v.markdown, empty: v.empty })
            if (v.empty) localStorage.removeItem(draftKey)
            else localStorage.setItem(draftKey, v.markdown)
          }}
        />
        {kind === 'announcement' && <p className={styles.meta}>{t('announcementHint')}</p>}
        {sessionShown && (
          <Select
            label={t('sessionPick')}
            description={t(kind === 'announcement' ? 'sessionPickHint' : 'sessionPickHintOpen')}
            value={session}
            onValueChange={setSession}
            options={[{ value: NO_SESSION, label: t('sessionNone') }, ...sessions]}
          />
        )}
        {kind === 'event' && <EventFields value={extra} onChange={set} minDate={today} />}
        {kind === 'vote' && (
          <fieldset className={styles.voteFields}>
            <legend className={styles.fieldLegend}>{t('voteOptions')}</legend>
            {extra.options.map((option, index) => (
              <div key={index} className={styles.optionRow}>
                <Input
                  label={t('voteOption', { n: index + 1 })}
                  value={option}
                  maxLength={VOTE_OPTIONS.length}
                  onChange={(e) => {
                    const next = [...extra.options]
                    next[index] = e.currentTarget.value
                    set({ options: next })
                  }}
                />
                {extra.options.length > VOTE_OPTIONS.min && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('voteRemoveOption', { n: index + 1 })}
                    onClick={() => set({ options: extra.options.filter((_, i) => i !== index) })}
                  >
                    <X size={16} aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
            {extra.options.length < VOTE_OPTIONS.max && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ options: [...extra.options, ''] })}
                >
                  <Plus size={16} aria-hidden="true" />
                  {t('voteAddOption')}
                </Button>
              </div>
            )}
            <Checkbox
              label={t('voteMultiple')}
              description={t('voteMultipleHint')}
              checked={extra.multiple}
              onCheckedChange={(v) => set({ multiple: v === true })}
            />
            <Checkbox
              label={t('voteAnonymous')}
              description={t('voteAnonymousHint')}
              checked={extra.anonymous}
              onCheckedChange={(v) => set({ anonymous: v === true })}
            />
          </fieldset>
        )}
        <AttachmentTray files={files} onRemove={attachments.remove} />
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
      <div className={styles.groupFoot}>
        <span className={styles.rowMain}>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            accept={SPACE_FILE_ACCEPT}
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
            disabled={files.length >= FILE_LIMITS.post || attachments.busy}
            onClick={() => picker.current?.click()}
          >
            <Paperclip size={16} aria-hidden="true" />
            {t('filesDrop')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t('cancel')}
          </Button>
        </span>
        <ActionSwap
          disabled={!ready || attachments.busy}
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
