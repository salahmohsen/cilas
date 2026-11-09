'use client'

import { CopyButton } from '@/components/arc/copy-button/copy-button'

import styles from './ai-access-guide.module.css'

/** Selectable text remains available when the browser blocks clipboard access. */
export function AddressCopy({ address }: { address: string }) {
  return (
    <div className={styles.address}>
      <input
        className={styles.addressField}
        readOnly
        value={address}
        aria-label="Address to paste into the assistant"
        onFocus={(event) => event.currentTarget.select()}
      />
      <CopyButton value={address} label="Copy address" failedLabel="Select the address and copy" />
    </div>
  )
}

export function ExampleCopy({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.example}>
      <h3>{title}</h3>
      <p
        className={styles.exampleText}
        tabIndex={0}
        onFocus={(event) => {
          const range = document.createRange()
          range.selectNodeContents(event.currentTarget)
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
        }}
      >
        {text}
      </p>
      <CopyButton
        value={text}
        label={`Copy example: ${title}`}
        failedLabel="Select the example and copy"
      />
    </div>
  )
}
