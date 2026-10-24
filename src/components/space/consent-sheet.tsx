'use client'

import { useTranslations } from 'next-intl'

import { ActionButton } from '@/components/arc/action-button/action-button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { consentAcceptAction } from '@/app/(frontend)/[locale]/spaces/actions'

import styles from './space.module.css'

/**
 * Spec §9: the notice stands between a member and their first post, at the
 * moment they start writing. Reading is never blocked.
 */
export function ConsentSheet({
  open,
  onOpenChange,
  notice,
  onAccepted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  notice: string
  onAccepted: () => void
}) {
  const t = useTranslations('SpaceConsent')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('title')}>
        <div className={styles.column}>
          <p dir="auto" className={styles.prose}>
            {notice}
          </p>
          <div>
            <ActionButton
              label={t('accept')}
              pendingLabel={t('accepting')}
              successLabel={t('accepted')}
              onAction={async () => {
                const result = await consentAcceptAction({ status: 'ok' }, new FormData())
                if (result.status === 'error') throw new Error(result.error)
                setTimeout(onAccepted, 700)
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
