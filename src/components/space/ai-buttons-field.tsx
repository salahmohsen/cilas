'use client'

import { useId, useState } from 'react'
import { Info } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Tooltip } from '@/components/arc/tooltip/tooltip'
import { Switch } from '@/components/switch'

import styles from './space.module.css'

/** An "i" button that shows its help on hover, on keyboard focus and on a press. */
function InfoTip({ label, help }: { label: string; help: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Tooltip content={help} open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className={styles.infoTip}
        aria-label={label}
        // A tooltip closes on a press, and a touch screen has no hover: here a press opens it.
        // Cancelling both events stops the tooltip's own close.
        onPointerDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault()
          setOpen(true)
        }}
      >
        <Info size={16} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}

/** A space's "Study with AI" switch. While the site's switch is off it is locked, and says why. */
export function AiButtonsField({
  checked,
  onCheckedChange,
  siteOn,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  siteOn: boolean
}) {
  const t = useTranslations('Spaces')
  const id = useId()
  const reasonId = `${id}-reason`
  return (
    <div>
      <div className={styles.switchRow}>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={!siteOn}
          aria-describedby={siteOn ? undefined : reasonId}
        />
        <label htmlFor={id} className={styles.switchLabel} data-disabled={!siteOn || undefined}>
          {t('aiButtons')}
        </label>
        <InfoTip label={t('aiButtonsInfo')} help={t('aiButtonsHint')} />
      </div>
      {!siteOn && (
        <p id={reasonId} className={styles.switchReason}>
          {t('aiButtonsSiteOff')}
        </p>
      )}
    </div>
  )
}
