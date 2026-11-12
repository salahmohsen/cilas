'use client'

import { Button, useAuth, useDocumentInfo, useTranslation } from '@payloadcms/ui'
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

const SEND = {
  en: {
    label: 'Set-password link',
    help: (days: number) =>
      `Sends a new link to set the password. It works for ${days} days and replaces older links.`,
    button: 'Send a new link',
    sending: 'Sending…',
    language: 'Email language',
    failed: 'The email did not go out. Try again.',
    sent: (email: string) => `Sent to ${email}.`,
  },
  ar: {
    label: 'رابط كلمة المرور',
    help: (days: number) =>
      `يرسل رابطًا جديدًا لاختيار كلمة المرور. يعمل ${days} أيام ويلغي الروابط السابقة.`,
    button: 'إرسال رابط جديد',
    sending: 'جارٍ الإرسال…',
    language: 'لغة الرسالة',
    failed: 'لم تُرسل الرسالة. حاول مرة أخرى.',
    sent: (email: string) => `أُرسلت إلى ${email}.`,
  },
}

/** A user's sidebar: sends them a new set-password link (src/lib/invitation.ts). */
export function SendInvitation({ days }: { days: number }) {
  const { id } = useDocumentInfo()
  const { i18n } = useTranslation()
  const t = SEND[i18n.language === 'ar' ? 'ar' : 'en']
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
      const body = (await res.json().catch(() => ({}))) as { sent?: string }
      setStatus(res.ok && body.sent ? t.sent(body.sent) : t.failed)
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
