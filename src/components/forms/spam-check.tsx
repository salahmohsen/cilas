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
    ): Promise<Response | null> => {
      if (honeypot.current?.value) return null
      try {
        const headers: Record<string, string> = {}
        if (siteKey && widget.current) {
          headers[TURNSTILE_HEADER] = await widget.current.getResponsePromise(30_000)
        }
        if (!files.length) {
          return await fetch('/api/form-submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(submission),
          })
        }
        // A token passes once, so answers and attachments travel in one request.
        const body = new FormData()
        body.set('payload', JSON.stringify(submission))
        for (const [name, file] of files) body.append(`file:${name}`, file, file.name)
        return await fetch('/api/form-submissions/with-files', { method: 'POST', headers, body })
      } finally {
        widget.current?.reset()
      }
    },
  }
}
