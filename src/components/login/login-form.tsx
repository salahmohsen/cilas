'use client'

import { useState, type FormEvent } from 'react'

import styles from '@/components/arc/blocks/sign-in/sign-in.module.css'
import { Button } from '@/components/arc/button/button'
import { GoogleLogo } from '@/components/arc/lib/google-logo'
import { Input } from '@/components/arc/input/input'
import { PasswordField } from '@/components/arc/password-field/password-field'
import { Link } from '@/i18n/navigation'
import { track } from '@/lib/analytics/track'

export type LoginMessages = {
  title: string
  intro: string
  google: string
  or: string
  email: string
  password: string
  submit: string
  forgot: string
  wrong: string
  googleRefused: string
  failed: string
  showPassword: string
  hidePassword: string
}

/**
 * The login card, in the look of Arc's sign-in block (blocks/sign-in): Google
 * first, then email and password. Both end in Payload's own cookie. The page
 * reloads on success, so src/proxy.ts sees the cookie and serves the
 * signed-in pages.
 */
export function LoginForm({
  next,
  googleEnabled,
  googleError,
  messages: m,
}: {
  /** A path on this site, already checked by the page. */
  next: string
  googleEnabled: boolean
  googleError: boolean
  messages: LoginMessages
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<null | 'google' | 'password'>(null)
  const [error, setError] = useState(googleError ? m.googleRefused : '')

  function continueWithGoogle() {
    setBusy('google')
    // Google hands `state` back to the callback, which returns there. An API
    // route that redirects off-site, so a full navigation, not the router.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/users/oauth/google?state=${encodeURIComponent(next)}`)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy('password')
    setError('')
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        track('login', { method: 'password' })
        window.location.assign(next)
        return
      }
      setError(res.status === 401 ? m.wrong : m.failed)
    } catch {
      setError(m.failed)
    }
    setBusy(null)
  }

  return (
    <section aria-labelledby="login-title" className={styles.signIn}>
      <div className={styles.step}>
        <div className={styles.heading}>
          <h2 id="login-title">{m.title}</h2>
          <p>{m.intro}</p>
        </div>

        {googleEnabled && (
          <>
            <Button
              className={styles.wide}
              loading={busy === 'google'}
              onClick={continueWithGoogle}
              type="button"
              variant="secondary"
            >
              <GoogleLogo />
              {m.google}
            </Button>
            <div className={styles.divider}>{m.or}</div>
          </>
        )}

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
          <PasswordField
            autoComplete="current-password"
            label={m.password}
            messages={{ showPassword: m.showPassword, hidePassword: m.hidePassword }}
            onChange={(e) => setPassword(e.target.value)}
            value={password}
          />
          {error && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          <Button className={styles.wide} loading={busy === 'password'} type="submit">
            {m.submit}
          </Button>
        </form>
      </div>

      <footer className={styles.footer}>
        <Link className={styles.textButton} href="/forgot">
          {m.forgot}
        </Link>
      </footer>
    </section>
  )
}
