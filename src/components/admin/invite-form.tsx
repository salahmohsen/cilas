'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'

import { ROLE_OPTIONS } from '@/access'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { Input } from '@/components/arc/input/input'
import { RadioGroup } from '@/components/arc/radio-group/radio-group'

import { inviteCopy } from './invite-copy'
import styles from './invite.module.css'

type ErrorKey = keyof ReturnType<typeof inviteCopy>['errors']
type Result = { id: number; emailed: boolean; email: string }

/** Admin → Invite someone: makes the account and sends its invitation (src/lib/invitation.ts). */
export function InviteForm({ ar }: { ar: boolean }) {
  const t = inviteCopy(ar)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [roles, setRoles] = useState<string[]>(['member'])
  const [language, setLanguage] = useState<'en' | 'ar'>(ar ? 'ar' : 'en')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ErrorKey | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const toggle = (role: string, on: boolean) =>
    setRoles((current) => (on ? [...current, role] : current.filter((r) => r !== role)))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, roles, locale: language }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        id?: number
        emailed?: boolean
        error?: string
      }
      if (res.ok && body.id) setResult({ id: body.id, emailed: Boolean(body.emailed), email })
      else setError(body.error && body.error in t.errors ? (body.error as ErrorKey) : 'failed')
    } catch {
      setError('failed')
    }
    setBusy(false)
  }

  if (result) {
    return (
      <div className={styles.done}>
        <Alert
          tone={result.emailed ? 'success' : 'warning'}
          title={result.emailed ? t.sentTitle : t.notSentTitle}
        >
          {result.emailed ? t.sentBody(result.email) : t.notSentBody}
        </Alert>
        <div className={styles.actions}>
          <Link href={`/admin/collections/users/${result.id}`}>{t.openAccount}</Link>
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null)
              setEmail('')
              setName('')
            }}
          >
            {t.another}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Input
        label={t.email}
        type="email"
        dir="ltr"
        autoComplete="off"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error === 'email' || error === 'exists' ? t.errors[error] : undefined}
      />
      <Input
        label={t.name}
        description={t.nameHint}
        dir="auto"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error === 'name' ? t.errors.name : undefined}
      />
      <fieldset className={styles.roles}>
        <legend>{t.roles}</legend>
        {ROLE_OPTIONS.map((option) => (
          <Checkbox
            key={option.value}
            label={t.roleNames[option.value] ?? option.label}
            checked={roles.includes(option.value)}
            onCheckedChange={(on) => toggle(option.value, on === true)}
          />
        ))}
        {error === 'roles' ? <p className={styles.error}>{t.errors.roles}</p> : null}
      </fieldset>
      <RadioGroup
        label={t.language}
        options={[
          { value: 'en', label: t.english },
          { value: 'ar', label: t.arabic },
        ]}
        value={language}
        onValueChange={(value) => setLanguage(value === 'ar' ? 'ar' : 'en')}
      />
      {error === 'failed' ? <Alert tone="danger" title={t.errors.failed} /> : null}
      <div className={styles.actions}>
        <Button type="submit" loading={busy}>
          {busy ? t.sending : t.submit}
        </Button>
      </div>
    </form>
  )
}
