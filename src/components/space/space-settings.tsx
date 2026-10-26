'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { PopoverAnchor } from '@radix-ui/react-popover'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { Button } from '@/components/arc/button/button'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { Popover, PopoverContent } from '@/components/arc/popover/popover'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { Textarea } from '@/components/arc/textarea/textarea'
import { ABOUT_MAX } from '@/lib/space-about'
import { spaceSettingsSetAction } from '@/app/(frontend)/[locale]/spaces/actions'

import { saveErrorKey } from './composer'
import styles from './space.module.css'

/** Moderators only (spec §11): the posting level, who starts events, the About text, and reopening an archived course space. */
export function SpaceSettings({
  space,
  posting,
  events,
  archived,
  about,
  aboutDefault,
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
  const [reopen, setReopen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent align="end">
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
          {archived && (
            <Checkbox
              label={t('reopen')}
              checked={reopen}
              onCheckedChange={(v) => setReopen(v === true)}
            />
          )}
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
      </PopoverContent>
    </Popover>
  )
}
