'use client'

import { useState, type FormEvent } from 'react'

import styles from '@/components/arc/blocks/sign-in/sign-in.module.css'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'
import { Link } from '@/i18n/navigation'
import { isEmail, requestResetLink } from '@/lib/password-reset'

export type ForgotMessages = {
  title: string
  intro: string
  email: string
  submit: string
  invalidEmail: string
  failed: string
  sentTitle: string
  /** Has an `{email}` slot. */
  sentBody: string
  back: string
}

/**
 * Step one of a password reset, in the look of the sign-in card (login-form.tsx):
 * the email, then a plain "check your email" state that says the same thing
 * whether or not the address has an account.
 */
export function ForgotForm({ messages: m }: { messages: ForgotMessages }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (!isEmail(email)) {
      setError(m.invalidEmail)
      return
    }
    setBusy(true)
    setError('')
    const result = await requestResetLink(email)
    if (result === 'sent') setSentTo(email.trim())
    else setError(m.failed)
    setBusy(false)
  }

  return (
    <section aria-labelledby="forgot-title" className={styles.signIn}>
      <div className={styles.step}>
        {sentTo ? (
          <div className={styles.heading} role="status">
            <h2 id="forgot-title">{m.sentTitle}</h2>
            <p>{m.sentBody.replace('{email}', sentTo)}</p>
          </div>
        ) : (
          <>
            <div className={styles.heading}>
              <h2 id="forgot-title">{m.title}</h2>
              <p>{m.intro}</p>
            </div>
            <form className={styles.form} noValidate onSubmit={submit}>
              <Input
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                label={m.email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                spellCheck={false}
                type="email"
                value={email}
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
          </>
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
