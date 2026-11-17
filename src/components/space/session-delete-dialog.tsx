'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'

export function SessionDeleteDialog({
  onCancel,
  onDelete,
  returnFocus,
}: {
  onCancel: () => void
  onDelete: () => void
  returnFocus: () => void
}) {
  const t = useTranslations('SessionEdit')
  const cancel = useRef<HTMLButtonElement>(null)
  const deleting = useRef(false)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent
        title={t('deleteTitle')}
        closeLabel={t('leaveClose')}
        className="arc-scope"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          cancel.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
      >
        <div className="flex gap-2">
          <Button ref={cancel} type="button" variant="secondary" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (deleting.current) return
              deleting.current = true
              onDelete()
            }}
          >
            {t('delete')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
