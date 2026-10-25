'use client'

import type { ReactNode } from 'react'

import { Badge, type BadgeTone } from '@/components/arc/badge/badge'
import { Tooltip } from '@/components/arc/tooltip/tooltip'

import styles from './space.module.css'

/**
 * A post's label as an icon with its name in a tooltip. The name stays the
 * accessible name, and the icon takes focus so a keyboard reader gets the tooltip too.
 */
export function PostLabel({
  label,
  icon,
  tone,
}: {
  label: string
  icon: ReactNode
  tone?: BadgeTone
}) {
  return (
    <Tooltip content={label}>
      <span role="img" aria-label={label} tabIndex={0} className={styles.postLabel}>
        <Badge size="md" tone={tone} icon={icon} className={styles.labelBadge} />
      </span>
    </Tooltip>
  )
}
