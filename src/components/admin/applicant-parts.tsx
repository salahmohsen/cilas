'use client'

import Image from 'next/image'
import { Mail } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/arc/badge/badge'
import type { Applicant } from '@/forms/applicants'
import { focalPointStyle } from '@/lib/media-image'
import { applicantsCopy } from './applicants-copy'
import styles from './applicants.module.css'

const tones: Record<Applicant['status'], BadgeTone> = {
  new: 'warning',
  accepted: 'success',
  rejected: 'danger',
}

/** The decision day in Cairo, the way the admin reads dates. */
const day = (iso: string, ar: boolean) =>
  new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo' })

/** The status, with the decision date once the application is decided. */
export function StatusBadge({
  application: a,
  ar,
  withDate = false,
}: {
  application: Pick<Applicant, 'status' | 'decided'>
  ar: boolean
  withDate?: boolean
}) {
  const label = applicantsCopy(ar).statuses[a.status]
  return (
    <Badge tone={tones[a.status]}>
      {withDate && a.decided ? `${label} · ${day(a.decided, ar)}` : label}
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

/** One tile per course: its cover under a dark layer, its title on top. Three tiles fill the media height; more make it taller. */
export function CourseTiles({ choices, ar }: { choices: Applicant['choices']; ar: boolean }) {
  const t = applicantsCopy(ar)
  return (
    <div className={styles.media} data-count={choices.length}>
      {choices.map((c) => (
        <div className={styles.tile} data-image={c.cover ? '' : undefined} key={c.course}>
          {c.cover ? (
            <Image
              src={c.cover.src}
              alt=""
              fill
              sizes="(max-width: 700px) 100vw, 640px"
              style={focalPointStyle(c.cover)}
            />
          ) : null}
          <span className={styles.tileTitle}>{c.title}</span>
          {c.cover ? null : <span className={styles.srOnly}>{t.noCover}</span>}
        </div>
      ))}
    </div>
  )
}
