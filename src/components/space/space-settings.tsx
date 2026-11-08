'use client'

import { useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { Button } from '@/components/arc/button/button'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Dialog, DialogClose, DialogContent } from '@/components/arc/dialog/dialog'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { Textarea } from '@/components/arc/textarea/textarea'
import { ABOUT_MAX } from '@/lib/space-rules'
import { RULES_MAX } from '@/lib/space-consent'
import { spaceSettingsSetAction } from '@/lib/space-actions'

import { saveErrorKey } from './composer'
import styles from './space.module.css'

const NARROW = '(max-width: 719px)'
const subscribeNarrow = (notify: () => void) => {
  const query = window.matchMedia(NARROW)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
export const useNarrow = () =>
  useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  )

/** Moderators only (spec §11): the posting level, who starts events, the About and Privacy and rules texts, and reopening an archived course space. */
export function SpaceSettings({
  space,
  posting,
  events,
  archived,
  about,
  aboutDefault,
  rules,
  rulesDefault,
  open,
  onOpenChange,
  anchor,
}: {
  space: number
  posting: string
  events: string
  archived: boolean
  /** The custom About text in this language, empty when the default shows. */
  about: string
  aboutDefault: string
  /** This space's own "Privacy and rules" in this language, empty when the site's text shows. */
  rules: string
  rulesDefault: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The space head's button group: its Settings segment opens this, but a segment is not a Radix trigger. */
  anchor: ReactNode
}) {
  const t = useTranslations('Spaces')
  const tp = useTranslations('SpacePost')
  const router = useRouter()
  const locale = useLocale()
  const [level, setLevel] = useState(posting)
  const [who, setWho] = useState(events)
  const [text, setText] = useState(about)
  const [ruleText, setRuleText] = useState(rules)
  const [reopen, setReopen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const narrow = useNarrow()
  const fields = (
    <div className={styles.settings}>
      <RadioGroup
        label={t('posting')}
        value={level}
        onValueChange={setLevel}
        options={[
          { value: 'open', label: t('posting_open') },
          { value: 'members_comment', label: t('posting_members_comment') },
          { value: 'fellows_only', label: t('posting_fellows_only') },
        ]}
      />
      <RadioGroup
        label={t('eventsSetting')}
        value={who}
        onValueChange={setWho}
        options={[
          { value: 'members', label: t('events_members') },
          { value: 'moderators', label: t('events_moderators') },
        ]}
      />
      <div className={styles.aboutField}>
        <Textarea
          label={t('aboutField')}
          description={t('aboutFieldHint')}
          placeholder={aboutDefault}
          rows={5}
          maxLength={ABOUT_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button variant="ghost" size="sm" disabled={text === ''} onClick={() => setText('')}>
          {t('aboutReset')}
        </Button>
      </div>
      <div className={styles.aboutField}>
        <Textarea
          label={t('rulesField')}
          description={t('rulesFieldHint')}
          placeholder={rulesDefault}
          rows={8}
          maxLength={RULES_MAX}
          value={ruleText}
          onChange={(e) => setRuleText(e.target.value)}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={ruleText === ''}
          onClick={() => setRuleText('')}
        >
          {t('rulesReset')}
        </Button>
      </div>
      {archived && (
        <Checkbox
          label={t('reopen')}
          checked={reopen}
          onCheckedChange={(v) => setReopen(v === true)}
        />
      )}
    </div>
  )
  const footer = (
    <div className={styles.settingsFooter}>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <ActionButton
        label={t('saveSettings')}
        successLabel={t('saved')}
        onAction={async () => {
          setError(null)
          const form = new FormData()
          form.set('space', String(space))
          form.set('posting', level)
          form.set('events', who)
          form.set('about', text)
          form.set('rules', ruleText)
          form.set('locale', locale)
          if (archived && reopen) form.set('reopen', 'true')
          const result = await spaceSettingsSetAction({ status: 'ok' }, form)
          if (result.status === 'error') {
            setError(tp(saveErrorKey(result.error)))
            throw new Error(result.error)
          }
          router.refresh()
        }}
      />
    </div>
  )
  const title = t('settingsForModerator')
  return (
    <>
      {anchor}
      {narrow ? (
        <BottomSheet
          title={title}
          detents={[0.92]}
          open={open}
          onOpenChange={onOpenChange}
          closeLabel={t('closeSettings')}
        >
          <div className={styles.settingsSheet}>
            {fields}
            {footer}
          </div>
        </BottomSheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent chrome={false} title={title} className={styles.settingsDialog}>
            <div className={styles.settingsPanel}>
              <div className={styles.settingsHead}>
                <h2 className={styles.settingsTitle} aria-hidden="true">
                  {title}
                </h2>
                <DialogClose className={styles.settingsClose} aria-label={t('closeSettings')}>
                  <X size={16} strokeWidth={1.75} aria-hidden="true" />
                </DialogClose>
              </div>
              <div className={styles.settingsBody}>{fields}</div>
              {footer}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
