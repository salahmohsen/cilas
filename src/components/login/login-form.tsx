'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'

import styles from '@/components/arc/blocks/sign-in/sign-in.module.css'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'
import { PasswordField } from '@/components/arc/password-field/password-field'

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

/** The official four-colour Google "G", as in Arc's sign-in block. */
function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      className={styles.providerMark}
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
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
        {/* Payload's own reset flow emails a link. */}
        <Link className={styles.textButton} href="/admin/forgot-password">
          {m.forgot}
        </Link>
      </footer>
    </section>
  )
}
