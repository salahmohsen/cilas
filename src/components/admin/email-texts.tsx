'use client'

import {
  Button,
  TextareaField,
  TextField,
  useField,
  useFormFields,
  useLocale,
} from '@payloadcms/ui'
import type { TextareaFieldClientProps, TextFieldClientProps } from 'payload'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { defaultTexts, EMAILS, type EmailId } from '@/emails/catalog'

import styles from './email-texts.module.css'

type Lang = 'en' | 'ar'

/** The language the form shows for this email: the document's locale, if the email has one. */
const useLang = (email: EmailId): Lang => {
  const locale = useLocale()
  return EMAILS[email].localized && locale?.code === 'ar' ? 'ar' : 'en'
}

/** The path of a sibling field in the same email group. */
const sibling = (path: string, name: string) => `${path.slice(0, path.lastIndexOf('.'))}.${name}`

/** When the email goes out, who gets it, and its placeholders, which copy on click. */
export function EmailAbout({ email }: { email: EmailId }) {
  const entry = EMAILS[email]
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(token)
    } catch {
      setCopied(null)
    }
  }
  return (
    <div className={styles.about}>
      <p>{entry.when}</p>
      <p>To: {entry.to}</p>
      {entry.localized ? (
        <p>
          English and Arabic. Switch the language at the top of the page to edit the Arabic text.
        </p>
      ) : (
        <p>English only.</p>
      )}
      {entry.placeholders.length ? (
        <div className={styles.chips} aria-label="Placeholders">
          {entry.placeholders.map((name) => {
            const token = `{${name}}`
            return (
              <button key={name} type="button" className={styles.chip} onClick={() => copy(token)}>
                {copied === token ? 'Copied' : token}
              </button>
            )
          })}
        </div>
      ) : null}
      <p className={styles.hint}>An empty field sends the text shown in grey.</p>
    </div>
  )
}

/**
 * One text of an email: Payload's own text or textarea field, with the
 * default in the reader's language as its placeholder, and a button that
 * returns to that default.
 */
export function EmailTextField(
  props: (TextFieldClientProps | TextareaFieldClientProps) & { email: EmailId },
) {
  const { email, ...fieldProps } = props
  const lang = useLang(email)
  const { value, setValue } = useField<string>({ path: props.path })
  const fallback = defaultTexts(email, lang)[props.field.name] ?? ''
  const admin = { ...props.field.admin, placeholder: fallback }
  return (
    <div className={styles.text}>
      {props.field.type === 'textarea' ? (
        <TextareaField
          {...(fieldProps as TextareaFieldClientProps)}
          field={{ ...(props.field as TextareaFieldClientProps['field']), admin }}
        />
      ) : (
        <TextField
          {...(fieldProps as TextFieldClientProps)}
          field={{ ...(props.field as TextFieldClientProps['field']), admin }}
        />
      )}
      {value ? (
        <Button
          buttonStyle="subtle"
          size="small"
          margin={false}
          className={styles.reset}
          onClick={() => setValue('')}
        >
          Use default
        </Button>
      ) : null}
    </div>
  )
}

const SEPARATOR = '\u0000'

type Shown = { subject: string; html: string } | { error: string } | null

/**
 * The email with sample data and the texts as typed, before they are saved,
 * one version at a time. Also sends it to the signed-in admin.
 */
export function EmailPreview({ email, path }: { email: EmailId; path: string }) {
  const entry = EMAILS[email]
  const versions = Object.entries(entry.versions) as [string, string][]
  const lang = useLang(email)
  const [version, setVersion] = useState(versions[0]![0])
  const [shown, setShown] = useState<Shown>(null)
  const [sending, setSending] = useState<'idle' | 'sending' | string>('idle')

  // One string, so the form's other fields do not render the preview again.
  const joined = useFormFields(([fields]) =>
    Object.keys(entry.texts.en)
      .map((name) => (fields[sibling(path, name)]?.value as string | null | undefined) ?? '')
      .join(SEPARATOR),
  )
  const texts = useMemo(() => {
    const values = joined.split(SEPARATOR)
    return Object.fromEntries(
      Object.keys(entry.texts.en).map((name, i) => [name, values[i] || null]),
    )
  }, [entry, joined])

  const request = useCallback(
    (send: boolean) =>
      fetch('/api/email-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, version, locale: lang, texts, send }),
      }).then(async (r) => {
        const body = await r.json().catch(() => ({}))
        return r.ok ? body : { error: body.error ?? 'The preview did not load.' }
      }),
    [email, version, lang, texts],
  )

  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      request(false)
        .then((body) => current && setShown(body))
        .catch(() => current && setShown({ error: 'The preview did not load.' }))
    }, 400)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [request])

  const sendTest = async () => {
    setSending('sending')
    const body = await request(true).catch(() => ({ error: 'The test did not send.' }))
    setSending('sent' in body ? `Sent to ${body.sent}` : body.error)
  }

  return (
    <section
      className={`${styles.preview} email-texts-preview`}
      aria-label={`Preview: ${entry.label}`}
    >
      <div className={styles.toolbar}>
        {versions.length > 1 ? (
          <div className={styles.versions} role="group" aria-label="Version">
            {versions.map(([key, label]) => (
              <Button
                key={key}
                buttonStyle={key === version ? 'primary' : 'secondary'}
                size="small"
                margin={false}
                aria-pressed={key === version}
                onClick={() => setVersion(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        ) : null}
        <Button
          buttonStyle="secondary"
          size="small"
          margin={false}
          disabled={sending === 'sending'}
          onClick={sendTest}
        >
          {sending === 'sending' ? 'Sending…' : 'Send a test to me'}
        </Button>
        {sending !== 'idle' && sending !== 'sending' ? (
          <span role="status" className={styles.status}>
            {sending}
          </span>
        ) : null}
      </div>
      {shown && 'error' in shown ? (
        <p className={styles.status}>{shown.error}</p>
      ) : shown ? (
        <>
          <p className={styles.subject} dir="auto">
            Subject: {shown.subject}
          </p>
          <iframe
            className={styles.frame}
            title={`Preview: ${entry.label}`}
            srcDoc={shown.html}
            sandbox=""
          />
        </>
      ) : (
        <p className={styles.status}>Loading the preview…</p>
      )}
    </section>
  )
}
