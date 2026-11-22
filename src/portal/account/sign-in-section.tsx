'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { requestResetLink, type SendResult } from '@/lib/password-reset'
import { announce } from '@/portal/feedback/announce'

import styles from './account-page.module.css'

type Phase = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; result: SendResult }

/** How the account signs in: the email, and a reset link to set a new password. */
export function SignInSection({ email }: { email: string }) {
  const t = useTranslations('Portal.account')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const sending = phase.kind === 'sending'

  const send = async () => {
    if (sending) return
    setPhase({ kind: 'sending' })
    const result = await requestResetLink(email)
    setPhase({ kind: 'done', result })
    announce(result === 'sent' ? t('resetSent', { email }) : t('resetFailed'))
  }

  return (
    <div className={styles.signIn}>
      <dl className={styles.details}>
        <dt>{t('email')}</dt>
        <dd dir="ltr">
          <bdi>{email}</bdi>
        </dd>
      </dl>
      <div>
        {/* Never disabled (spec, Forms): a second press while sending is ignored in `send`. */}
        <Button type="button" variant="secondary" aria-busy={sending || undefined} onClick={send}>
          {/* Both labels share one grid cell, so the button is as wide as the longer one. */}
          <span className={styles.labels}>
            <span aria-hidden={sending || undefined} data-hidden={sending || undefined}>
              {t('changePassword')}
            </span>
            <span aria-hidden={!sending || undefined} data-hidden={!sending || undefined}>
              {t('sending')}
            </span>
          </span>
        </Button>
      </div>
      {/* The live region says it once (announce); the visible copy stays out of the accessibility tree. */}
      {phase.kind === 'done' ? (
        <div aria-hidden="true">
          <Alert
            tone={phase.result === 'sent' ? 'success' : 'danger'}
            title={phase.result === 'sent' ? t('resetSent', { email }) : t('resetFailed')}
          />
        </div>
      ) : null}
    </div>
  )
}
