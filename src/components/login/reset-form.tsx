'use client'

import { useState, type FormEvent } from 'react'

import styles from '@/components/arc/blocks/sign-in/sign-in.module.css'
import { Button } from '@/components/arc/button/button'
import { PasswordField } from '@/components/arc/password-field/password-field'
import { Link } from '@/i18n/navigation'
import { passwordProblem, saveNewPassword } from '@/lib/password-reset'

export type ResetMessages = {
  title: string
  intro: string
  password: string
  confirm: string
  submit: string
  tooShort: string
  mismatch: string
  invalid: string
  failed: string
  requestNew: string
  showPassword: string
  hidePassword: string
  back: string
}

/**
 * Step two: the page the reset email links to. Payload signs the account in
 * when the password is saved, so the page then goes to My spaces, as the sign-in
 * page does when it has no `next`.
 */
export function ResetForm({
  token,
  locale,
  messages: m,
}: {
  token: string
  locale: string
  messages: ResetMessages
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const problem = passwordProblem(password, confirm)
    if (problem) {
      setError(m[problem])
      return
    }
    setBusy(true)
    setError('')
    const result = await saveNewPassword(token, password)
    if (result === 'saved') {
      window.location.assign(`/${locale}/spaces`)
      return
    }
    if (result === 'invalid') setExpired(true)
    else setError(m.failed)
    setBusy(false)
  }

  const messages = { showPassword: m.showPassword, hidePassword: m.hidePassword }

  return (
    <section aria-labelledby="reset-title" className={styles.signIn}>
      <div className={styles.step}>
        <div className={styles.heading}>
          <h2 id="reset-title">{m.title}</h2>
          <p>{expired ? m.invalid : m.intro}</p>
        </div>
        {expired ? (
          <Link className={styles.textButton} href="/forgot">
            {m.requestNew}
          </Link>
        ) : (
          <form className={styles.form} noValidate onSubmit={submit}>
            <PasswordField
              autoComplete="new-password"
              label={m.password}
              messages={messages}
              onChange={(e) => setPassword(e.target.value)}
              value={password}
            />
            <PasswordField
              autoComplete="new-password"
              label={m.confirm}
              messages={messages}
              onChange={(e) => setConfirm(e.target.value)}
              value={confirm}
            />
            {error && (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            )}
            <Button className={styles.wide} loading={busy} type="submit">
              {m.submit}
            </Button>
          </form>
        )}
      </div>
      <footer className={styles.footer}>
        <Link className={styles.textButton} href="/login">
          {m.back}
        </Link>
      </footer>
    </section>
  )
}
