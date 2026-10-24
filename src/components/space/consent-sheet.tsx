'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { Alert } from '@/components/arc/alert/alert'
import { consentAcceptAction } from '@/app/(frontend)/[locale]/spaces/actions'

import styles from './space.module.css'

/**
 * Spec §9: until the member accepts the current notice, it stands in for the
 * composer. Reading is never blocked.
 */
export function ConsentSheet({ notice }: { notice: string }) {
  const t = useTranslations('SpaceConsent')
  const router = useRouter()
  return (
    <div id="consent">
      <Alert tone="info" title={t('title')}>
        <div className={styles.column}>
          <p dir="auto">{notice}</p>
          <div>
            <ActionButton
              label={t('accept')}
              pendingLabel={t('accepting')}
              successLabel={t('accepted')}
              onAction={async () => {
                const result = await consentAcceptAction({ status: 'ok' }, new FormData())
                if (result.status === 'error') throw new Error(result.error)
                router.refresh()
              }}
            />
          </div>
        </div>
      </Alert>
    </div>
  )
}
