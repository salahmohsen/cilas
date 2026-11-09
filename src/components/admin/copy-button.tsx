'use client'

import { useEffect, useRef, useState } from 'react'

import styles from './ai-access-guide.module.css'

/** Puts text on the clipboard, with a visible "Copied" state for a few seconds. */
const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older or embedded browsers: select a hidden field and copy from it.
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.insetBlockStart = '0'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      field.remove()
    }
  }
}

type Props = {
  text: string
  /** What the button says, and what a screen reader hears with it. */
  label: string
  /** Names what is copied, for a screen reader, when there are several buttons. */
  what?: string
}

export function CopyButton({ text, label, what }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const onClick = async () => {
    setState((await copyText(text)) ? 'copied' : 'failed')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 3000)
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.copy} ${state === 'copied' ? styles.copied : ''}`}
        onClick={onClick}
        aria-label={what ? `${label}: ${what}` : undefined}
      >
        {state === 'copied' ? '✓ Copied' : state === 'failed' ? 'Press Ctrl+C to copy' : label}
      </button>
      <span role="status" className={styles.srOnly}>
        {state === 'copied' ? 'Copied to the clipboard' : ''}
      </span>
    </>
  )
}
