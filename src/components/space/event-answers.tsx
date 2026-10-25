'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'

import { AvatarGroup } from '@/components/arc/avatar-group/avatar-group'
import { Button } from '@/components/arc/button/button'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { rsvpSetAction } from '@/app/(frontend)/[locale]/spaces/actions'
import { RSVP_STATUSES, type RsvpStatus } from '@/lib/space-event'
import type { RsvpView, Voter } from '@/lib/spaces-data'

import { saveErrorKey } from './composer'
import { PersonHover, type PersonCard } from './person-hover'
import styles from './space.module.css'

/** The answers as they read once the member's own answer is replaced (rsvpSet's rule). */
const answered = (
  view: RsvpView,
  next: { status: RsvpStatus | null; me: Voter | null },
): RsvpView => {
  const { status, me } = next
  const counts = { ...view.counts }
  if (view.mine) counts[view.mine] -= 1
  if (status) counts[status] += 1
  const others = me ? view.going.filter((v) => v.personId !== me.personId) : view.going
  return {
    counts,
    mine: status,
    going: status === 'going' && me ? [...others, me] : others,
  }
}

/**
 * An event's answers: three choices with the member's own selected, the count
 * of each, and the faces of who is going. Once the event is over, or the post
 * is closed, the choices turn into the same counts without buttons.
 */
export function EventAnswers({
  post,
  rsvp,
  readOnly,
  me,
  people,
}: {
  post: number
  rsvp: RsvpView
  /** Over, locked or archived: the answers can no longer change */
  readOnly: boolean
  /** The reader's own face, so choosing "going" shows it at once */
  me: Voter | null
  people?: Map<number, PersonCard>
}) {
  const t = useTranslations('SpacePost')
  const router = useRouter()
  const [, start] = useTransition()
  const [view, apply] = useOptimistic(rsvp, answered)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const choose = (next: RsvpStatus | null) => {
    setError(null)
    setStatus('')
    const form = new FormData()
    form.set('post', String(post))
    form.set('status', next ?? '')
    start(async () => {
      apply({ status: next, me })
      const result = await rsvpSetAction({ status: 'ok' }, form)
      if (result.status === 'ok') {
        setStatus(t(next ? `rsvpSaved_${next}` : 'rsvpCleared'))
        router.refresh()
        return
      }
      setError(t(result.error === 'rsvp' ? 'rsvpInvalid' : saveErrorKey(result.error)))
    })
  }

  return (
    <div className={styles.eventReply}>
      {readOnly ? (
        <ul className={styles.rsvpCounts} aria-label={t('rsvpCounts')}>
          {RSVP_STATUSES.map((s) => (
            <li key={s} data-mine={view.mine === s || undefined}>
              {view.mine === s && <Check size={14} aria-hidden="true" />}
              <span>{t(`rsvp_${s}`)}</span>
              <span className={styles.rsvpCount}>{view.counts[s]}</span>
              {view.mine === s && <span className="sr-only">{t('rsvpYours')}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.rsvpChoose}>
          <SegmentedControl
            label={t('rsvpLabel')}
            value={view.mine ?? ''}
            onValueChange={(next) => {
              if (next !== view.mine) choose(next as RsvpStatus)
            }}
            options={RSVP_STATUSES.map((s) => ({
              value: s,
              label: t(`rsvp_${s}`),
              accessory: <span className={styles.rsvpCount}>{view.counts[s]}</span>,
            }))}
          />
          {view.mine && (
            <Button size="sm" variant="ghost" onClick={() => choose(null)}>
              {t('rsvpClear')}
            </Button>
          )}
        </div>
      )}
      {view.going.length > 0 && (
        <div className={styles.rsvpGoing}>
          <AvatarGroup
            size="sm"
            max={6}
            label={t('rsvpGoingList')}
            members={view.going.map((v) => ({
              id: v.personId,
              name: v.name,
              src: v.photo ?? undefined,
            }))}
            wrap={(member, face) => (
              <PersonHover
                person={
                  people?.get(Number(member.id)) ?? {
                    id: Number(member.id),
                    name: member.name,
                    photo: member.src ?? null,
                    role: '',
                    bio: null,
                    links: [],
                    href: null,
                  }
                }
              >
                {face}
              </PersonHover>
            )}
          />
          <span className={styles.meta}>{t('rsvpGoingCount', { count: view.counts.going })}</span>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  )
}
