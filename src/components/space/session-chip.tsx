import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { CalendarDays } from 'lucide-react'

import { numberingSystemOf } from '@/lib/digits'
import type { SessionFact } from '@/lib/session-refs'

import styles from './space.module.css'

/** What a session mention needs to read: the course's sessions, and where its posts are listed. */
export type SessionLinks = {
  /** The space page; a chip opens its feed filtered to the session */
  spaceHref: string
  facts: Record<string, SessionFact>
  /** False when the reader may not read the course: a mention keeps only its own words */
  known: boolean
}

/** "Session 3", and "Session 3: Title", numbered as the syllabus numbers it. */
export function useSessionName() {
  const t = useTranslations('Course')
  const unitOf = (fact: SessionFact) => t(fact.week ? 'week' : 'session', { number: fact.n })
  return {
    unitOf,
    nameOf: (fact: SessionFact) => (fact.title ? `${unitOf(fact)}: ${fact.title}` : unitOf(fact)),
  }
}

/**
 * A session named with `#`, inline where it was written: a small chip that
 * opens the posts about the session, with its date in the name. A cancelled
 * session says so; one the course dropped reads "Session removed".
 */
export function SessionChip({
  id,
  links,
  label,
}: {
  id: string
  links: SessionLinks | null | undefined
  /** The words stored with the mention, for a reader who may not read the course */
  label?: string
}) {
  const t = useTranslations('SpacePost')
  const tc = useTranslations('Course')
  const format = useFormatter()
  const locale = useLocale()
  const { unitOf, nameOf } = useSessionName()
  const fact = links?.facts[id]
  if (!links?.known) return <bdi>{label || t('sessionMention')}</bdi>
  if (!fact) return <span className={styles.sessionGoneText}>{t('sessionRemoved')}</span>
  const name = nameOf(fact)
  const when = fact.date
    ? format.dateTime(new Date(`${fact.date}T00:00:00Z`), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
        numberingSystem: numberingSystemOf(locale),
      })
    : null
  const state = fact.cancelled ? `${name} (${tc('cancelled')})` : name
  const full = when ? `${state}, ${when}` : state
  return (
    <a
      className={styles.sessionMention}
      href={`${links.spaceHref}?${new URLSearchParams({ session: id })}`}
      title={full}
      aria-label={t('sessionChipLabel', { name: full })}
      data-cancelled={fact.cancelled || undefined}
    >
      <CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />
      <span className={styles.sessionMentionName}>
        {fact.title ? (
          <>
            {unitOf(fact)}: <bdi>{fact.title}</bdi>
          </>
        ) : (
          name
        )}
      </span>
      {fact.cancelled && <span className={styles.sessionMentionTag}>{tc('cancelled')}</span>}
    </a>
  )
}
