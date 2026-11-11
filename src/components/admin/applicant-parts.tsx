'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Mail } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/arc/badge/badge'
import type { ChoiceDecision } from '@/forms/application-status'
import type { Applicant } from '@/forms/applicants'
import { entriesOf, type Entry } from './applicant-decide'
import { focalPointStyle } from '@/lib/media-image'
import { applicantsCopy } from './applicants-copy'
import styles from './applicants.module.css'

const tones: Record<ChoiceDecision, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
}

/** The decision day in Cairo, the way the admin reads dates. */
const day = (iso: string, ar: boolean) =>
  new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo' })

/** A decision, with its date once it is decided, and a mark when its email did not go out. */
export function DecisionBadge({ entry, ar }: { entry: Entry; ar: boolean }) {
  const t = applicantsCopy(ar)
  const label = t.decisions[entry.decision]
  return (
    <span className={styles.badges}>
      <Badge tone={tones[entry.decision]}>
        {entry.decided ? `${label} · ${day(entry.decided, ar)}` : label}
      </Badge>
      {entry.emailFailed ? <Badge tone="danger">{t.emailNotSent}</Badge> : null}
    </span>
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
  entry: c,
  ar,
  className,
  children,
}: {
  entry: Entry
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

/** One tile per course (or the programme), each with its decision. Three tiles fill the media height; more make it taller. */
export function CourseTiles({ application, ar }: { application: Applicant; ar: boolean }) {
  const entries = entriesOf(application)
  return (
    <div className={styles.media} data-count={entries.length}>
      {entries.map((e) => (
        <CourseTile key={e.key} entry={e} ar={ar}>
          <DecisionBadge entry={e} ar={ar} />
        </CourseTile>
      ))}
    </div>
  )
}
