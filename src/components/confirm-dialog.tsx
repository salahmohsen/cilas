'use client'

import { useRef } from 'react'

import { Button } from '@/components/arc/button/button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'

/**
 * A question with a safe answer and a dangerous one. The safe button has
 * focus when it opens, and Escape, the close button and the safe button all
 * answer "no". The dangerous button answers once.
 */
export function ConfirmDialog({
  title,
  safe,
  danger,
  closeLabel,
  onSafe,
  onDanger,
  returnFocus,
}: {
  title: string
  safe: string
  danger: string
  closeLabel: string
  onSafe: () => void
  onDanger: () => void
  returnFocus: () => void
}) {
  const keep = useRef<HTMLButtonElement>(null)
  const answered = useRef(false)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onSafe()
      }}
    >
      <DialogContent
        title={title}
        closeLabel={closeLabel}
        className="arc-scope"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          keep.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
      >
        <div className="flex gap-2">
          <Button ref={keep} type="button" variant="secondary" onClick={onSafe}>
            {safe}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (answered.current) return
              answered.current = true
              onDanger()
            }}
          >
            {danger}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
