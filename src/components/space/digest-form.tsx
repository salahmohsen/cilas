'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'
import { preferenceSetAction } from '@/app/(frontend)/[locale]/spaces/actions'

import styles from './space.module.css'

/** The account's email digest, one choice for every space. */
export function DigestForm({ digest }: { digest: 'daily' | 'weekly' | 'off' | null }) {
  const t = useTranslations('SpaceChecklist')
  const router = useRouter()
  const [choice, setChoice] = useState<string>(digest ?? 'weekly')
  return (
    <div className={styles.column}>
      <RadioGroup
        label={t('digestLabel')}
        labelHidden
        value={choice}
        onValueChange={setChoice}
        options={[
          { value: 'daily', label: t('daily') },
          { value: 'weekly', label: t('weekly') },
          { value: 'off', label: t('off') },
        ]}
      />
      <div>
        <ActionButton
          label={t('saveDigest')}
          pendingLabel={t('savingDigest')}
          successLabel={t('savedDigest')}
          onAction={async () => {
            const form = new FormData()
            form.set('digest', choice)
            const result = await preferenceSetAction({ status: 'ok' }, form)
            if (result.status === 'error') throw new Error(result.error)
            router.refresh()
          }}
        />
      </div>
    </div>
  )
}
