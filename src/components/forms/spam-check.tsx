'use client'

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useLocale } from 'next-intl'
import { useRef } from 'react'

import { env } from '@/env'
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
    /** A filled honeypot: act as if sent, and send nothing. */
    isBot: () => Boolean(honeypot.current?.value),
    /** The submission's headers. Waits for the token if the check still runs. */
    headers: async (): Promise<Record<string, string>> => {
      if (!siteKey || !widget.current) return {}
      const token = await widget.current.getResponsePromise(30_000)
      return { [TURNSTILE_HEADER]: token }
    },
    /** A token passes once: get a new one for the next send. */
    reset: () => widget.current?.reset(),
  }
}
