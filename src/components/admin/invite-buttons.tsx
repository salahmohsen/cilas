'use client'

import { Button, useAuth, useDocumentInfo, useSelection, useTranslation } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { isAdminUser } from '@/access'

import { inviteCopy } from './invite-copy'

/** Users list: a way to Admin → Invite someone, for admins. */
export function InviteLink() {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  if (!isAdminUser(user)) return null
  return (
    <div className="cilas-admin-stack cilas-admin-stack--flush">
      <Button buttonStyle="primary" el="link" margin={false} to="/admin/invite">
        {inviteCopy(i18n.language === 'ar').title}
      </Button>
    </div>
  )
}

/** A user's sidebar: sends them a new set-password link (src/lib/invitation.ts). */
export function SendInvitation({ days }: { days: number }) {
  const { id } = useDocumentInfo()
  const { i18n } = useTranslation()
  const t = inviteCopy(i18n.language === 'ar').send
  const [language, setLanguage] = useState<'en' | 'ar'>(i18n.language === 'ar' ? 'ar' : 'en')
  const [status, setStatus] = useState<'idle' | 'sending' | string>('idle')
  if (!id) return null

  const send = async () => {
    setStatus('sending')
    try {
      const res = await fetch(`/api/users/${id}/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: language }),
      })
      const body = (await res.json().catch(() => ({}))) as { sent?: string; error?: string }
      setStatus(
        res.ok && body.sent ? t.sent(body.sent) : body.error === 'limit' ? t.limit : t.failed,
      )
    } catch {
      setStatus(t.failed)
    }
  }

  return (
    <div className="cilas-admin-stack">
      <strong>{t.label}</strong>
      <p className="field-description">{t.help(days)}</p>
      <label className="field-description">
        {t.language}{' '}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value === 'ar' ? 'ar' : 'en')}
        >
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </label>
      <Button
        buttonStyle="secondary"
        margin={false}
        size="small"
        disabled={status === 'sending'}
        onClick={send}
      >
        {status === 'sending' ? t.sending : t.button}
      </Button>
      {status !== 'idle' && status !== 'sending' ? (
        <p role="status" className="field-description">
          {status}
        </p>
      ) : null}
    </div>
  )
}

type Totals = { sent: number; skipped: number; failed: number; limited: number }

/**
 * Users list: invites the selected accounts. Sends them in parts of `batch`
 * (POST /api/users/invite-many), shows the progress, and stops when the
 * email service's daily limit is reached.
 */
export function InviteSelected({ batch, days }: { batch: number; days: number }) {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const router = useRouter()
  const { count, selectAll, getSelectedIds, getQueryParams } = useSelection()
  const t = inviteCopy(i18n.language === 'ar').many
  const [language, setLanguage] = useState<'en' | 'ar'>(i18n.language === 'ar' ? 'ar' : 'en')
  const [again, setAgain] = useState(false)
  const [step, setStep] = useState<'idle' | 'confirm' | 'sending'>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [totals, setTotals] = useState<Totals | null>(null)
  const [error, setError] = useState(false)
  if (!isAdminUser(user) || (!count && !totals)) return null

  /** Every selected id: on all pages when "select all" covers the whole query. */
  const selectedIds = async (): Promise<number[]> => {
    // Payload's SelectAllStatus.AllAvailable; the enum is not exported to clients.
    if (selectAll !== 'allAvailable') return getSelectedIds().map(Number)
    const res = await fetch(`/api/users${getQueryParams()}&limit=0&depth=0&select[id]=true`, {
      credentials: 'include',
    })
    const body = (await res.json()) as { docs: { id: number }[] }
    return body.docs.map((d) => d.id)
  }

  const run = async () => {
    setStep('sending')
    setError(false)
    const sum: Totals = { sent: 0, skipped: 0, failed: 0, limited: 0 }
    try {
      const ids = await selectedIds()
      setProgress({ done: 0, total: ids.length })
      for (let i = 0; i < ids.length; i += batch) {
        const part = ids.slice(i, i + batch)
        const res = await fetch('/api/users/invite-many', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: part, locale: language, again }),
        })
        if (!res.ok) throw new Error(String(res.status))
        const r = (await res.json()) as Record<keyof Totals, number[]>
        sum.sent += r.sent.length
        sum.skipped += r.skipped.length
        sum.failed += r.failed.length
        sum.limited += r.limited.length
        setProgress({ done: Math.min(i + batch, ids.length), total: ids.length })
        if (r.limited.length) {
          sum.limited += ids.length - (i + part.length)
          break
        }
      }
    } catch {
      setError(true)
    }
    setTotals(sum)
    setStep('idle')
    router.refresh()
  }

  const lang = language === 'ar' ? t.arabic : t.english
  return (
    <div
      className="cilas-admin-stack cilas-admin-stack--flush"
      role="region"
      aria-label={t.invite(count)}
    >
      {count ? (
        <div className="cilas-invite-bar">
          <strong>{t.selected(count)}</strong>
          <label>
            {t.language}{' '}
            <select
              value={language}
              disabled={step !== 'idle'}
              onChange={(e) => setLanguage(e.target.value === 'ar' ? 'ar' : 'en')}
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={again}
              disabled={step !== 'idle'}
              onChange={(e) => setAgain(e.target.checked)}
            />{' '}
            {t.again(days)}
          </label>
          {step === 'idle' ? (
            <Button
              buttonStyle="secondary"
              margin={false}
              size="small"
              onClick={() => setStep('confirm')}
            >
              {t.invite(count)}
            </Button>
          ) : null}
        </div>
      ) : null}
      {step === 'confirm' ? (
        <div className="cilas-invite-bar">
          <span>{t.confirm(count, lang)}</span>
          <Button buttonStyle="primary" margin={false} size="small" onClick={run}>
            {t.send}
          </Button>
          <Button
            buttonStyle="secondary"
            margin={false}
            size="small"
            onClick={() => setStep('idle')}
          >
            {t.cancel}
          </Button>
        </div>
      ) : null}
      <div role="status">
        {step === 'sending' ? <p>{t.progress(progress.done, progress.total)}</p> : null}
        {totals && step === 'idle' ? (
          <p>
            {[
              t.sent(totals.sent),
              totals.skipped ? t.skipped(totals.skipped) : '',
              totals.failed ? t.failed(totals.failed) : '',
              totals.limited ? t.limited(totals.limited) : '',
              error ? t.error : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
