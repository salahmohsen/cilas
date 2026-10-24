'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { Button } from '@/components/arc/button/button'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/arc/popover/popover'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { spaceSettingsSetAction } from '@/app/(frontend)/[locale]/spaces/actions'

import { saveErrorKey } from './composer'
import styles from './space.module.css'

/** Moderators only (spec §11): the posting level, and reopening an archived course space. */
export function SpaceSettings({
  space,
  posting,
  archived,
}: {
  space: number
  posting: string
  archived: boolean
}) {
  const t = useTranslations('Spaces')
  const tp = useTranslations('SpacePost')
  const router = useRouter()
  const [level, setLevel] = useState(posting)
  const [reopen, setReopen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          {t('settingsForModerator')}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
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
