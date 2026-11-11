'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Mail } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/arc/badge/badge'
import type { ChoiceDecision } from '@/forms/application-status'
import type { Applicant } from '@/forms/applicants'
import { focalPointStyle } from '@/lib/media-image'
import { applicantsCopy } from './applicants-copy'
import styles from './applicants.module.css'

type Choice = Applicant['choices'][number]

const tones: Record<ChoiceDecision, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
}

/** The decision day in Cairo, the way the admin reads dates. */
const day = (iso: string, ar: boolean) =>
  new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo' })

/** One course's decision, with its date once it is decided. */
export function DecisionBadge({ choice, ar }: { choice: Choice; ar: boolean }) {
  const label = applicantsCopy(ar).decisions[choice.decision]
  return (
    <Badge tone={tones[choice.decision]}>
      {choice.decided ? `${label} · ${day(choice.decided, ar)}` : label}
    </Badge>
  )
}

export function EmailLine({ email }: { email: string }) {
  return (
    <span className={styles.email}>
      <Mail size={16} strokeWidth={1.75} aria-hidden />
      <span dir="ltr">{email}</span>
    </span>
  )
}

/**
 * A course over its cover under a dark layer: the title on the left, `children`
 * (a badge or the decision buttons) on the right.
 */
export function CourseTile({
  choice: c,
  ar,
  className,
  children,
}: {
  choice: Choice
  ar: boolean
  className?: string
  children?: ReactNode
}) {
  const t = applicantsCopy(ar)
  return (
    <div
      className={[styles.tile, className].filter(Boolean).join(' ')}
      data-image={c.cover ? '' : undefined}
    >
      {c.cover ? (
        <Image
          src={c.cover.src}
          alt=""
          fill
          sizes="(max-width: 700px) 100vw, 640px"
          style={focalPointStyle(c.cover)}
        />
      ) : null}
      <div className={styles.tileRow}>
        <span className={styles.tileTitle}>{c.title}</span>
        {children}
      </div>
      {c.cover ? null : <span className={styles.srOnly}>{t.noCover}</span>}
    </div>
  )
}

/** One tile per course, each with its decision. Three tiles fill the media height; more make it taller. */
export function CourseTiles({ choices, ar }: { choices: Choice[]; ar: boolean }) {
  return (
    <div className={styles.media} data-count={choices.length}>
      {choices.map((c) => (
        <CourseTile key={c.course} choice={c} ar={ar}>
          <DecisionBadge choice={c} ar={ar} />
        </CourseTile>
      ))}
    </div>
  )
}
