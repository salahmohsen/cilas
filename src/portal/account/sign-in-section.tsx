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

  const send = async () => {
    if (phase.kind === 'sending') return
    setPhase({ kind: 'sending' })
    const result = await requestResetLink(email)
    setPhase({ kind: 'done', result })
    announce(result === 'sent' ? t('resetSent', { email }) : t('resetFailed'))
  }

  return (
    <div className={styles.signIn}>
      <p className={styles.intro}>{t('signInIntro')}</p>
      <dl className={styles.details}>
        <dt>{t('email')}</dt>
        <dd dir="ltr">
          <bdi>{email}</bdi>
        </dd>
      </dl>
      <div>
        {/* Never disabled (spec, Forms): a second press while sending is ignored in `send`. */}
        <Button
          type="button"
          variant="secondary"
          aria-busy={phase.kind === 'sending' || undefined}
          onClick={send}
        >
          {phase.kind === 'sending' ? t('sending') : t('changePassword')}
        </Button>
      </div>
      {phase.kind === 'done' ? (
        <Alert
          tone={phase.result === 'sent' ? 'success' : 'danger'}
          title={phase.result === 'sent' ? t('resetSent', { email }) : t('resetFailed')}
        />
      ) : null}
    </div>
  )
}
