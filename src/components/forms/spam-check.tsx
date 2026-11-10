'use client'

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useLocale } from 'next-intl'
import { useRef } from 'react'

import { clientEnv as env } from '@/env.client'
import { TURNSTILE_HEADER } from '@/lib/turnstile'

const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

/**
 * The site's forms' guard against bots: a Cloudflare Turnstile check, shown
 * only when Cloudflare needs the visitor to click, and a honeypot field that
 * people never see. Without NEXT_PUBLIC_TURNSTILE_SITE_KEY only the honeypot
 * is on. Put `fields` inside the form.
 */
export function useSpamCheck() {
  const locale = useLocale()
  const widget = useRef<TurnstileInstance | null>(null)
  const honeypot = useRef<HTMLInputElement>(null)

  const fields = (
    <>
      {/* Bots fill every field; people never reach this one. */}
      <div aria-hidden="true" className="spam-check-honeypot">
        <input
          ref={honeypot}
          autoComplete="off"
          name="website"
          tabIndex={-1}
          type="text"
          defaultValue=""
        />
      </div>
      {siteKey ? (
        <Turnstile
          ref={widget}
          siteKey={siteKey}
          className="spam-check-widget"
          options={{
            // Groups these checks in Cloudflare's Turnstile analytics.
            action: 'turnstile-spin-v1',
            appearance: 'interaction-only',
            language: locale,
            size: 'flexible',
            theme: 'auto',
          }}
        />
      ) : null}
    </>
  )

  return {
    fields,
    submit: async (
      submission: {
        form: number
        submissionData: { field: string; value: string }[]
        target?: unknown
      },
      files: readonly (readonly [string, File])[] = [],
    ): Promise<SubmitResult> => {
      if (honeypot.current?.value) return { kind: 'bot' }
      try {
        const headers: Record<string, string> = {}
        if (siteKey) {
          const token = await widget.current?.getResponsePromise(30_000).catch(() => null)
          if (!token) return { kind: 'spam-check-failed' }
          headers[TURNSTILE_HEADER] = token
        }
        let res: Response
        try {
          if (files.length) {
            // A token passes once, so answers and attachments travel in one request.
            const body = new FormData()
            body.set('payload', JSON.stringify(submission))
            for (const [name, file] of files) body.append(`file:${name}`, file, file.name)
            res = await fetch('/api/form-submissions/with-files', { method: 'POST', headers, body })
          } else {
            res = await fetch('/api/form-submissions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify(submission),
            })
          }
        } catch {
          return { kind: 'network' }
        }
        if (res.ok) return { kind: 'sent' }
        const body = await res.json().catch(() => null)
        return { kind: 'refused', error: body?.error ?? body?.errors?.[0]?.message ?? null }
      } finally {
        widget.current?.reset()
      }
    },
  }
}

/**
 * What became of a submission. `bot` means the honeypot was filled: nothing
 * was sent, and the form shows success so the bot learns nothing.
 */
export type SubmitResult =
  | { kind: 'sent' }
  | { kind: 'bot' }
  | { kind: 'spam-check-failed' }
  | { kind: 'network' }
  | { kind: 'refused'; error: string | null }

type Failure = Exclude<SubmitResult, { kind: 'sent' } | { kind: 'bot' }>

/** True when the visitor should see the form as sent. */
export const looksSent = (result: SubmitResult): result is { kind: 'sent' } | { kind: 'bot' } =>
  result.kind === 'sent' || result.kind === 'bot'

/** The sentence a form shows for a failure, from its own messages. */
export const failureMessage = (
  result: Failure,
  t: (key: 'failed' | 'spamCheckFailed' | 'serverFailed') => string,
): string => {
  if (result.kind === 'refused') return result.error ?? t('serverFailed')
  return result.kind === 'spam-check-failed' ? t('spamCheckFailed') : t('failed')
}
