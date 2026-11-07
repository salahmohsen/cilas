'use client'

import { personAvatarSeed } from '@/lib/avatar'

import { useOptimistic, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'

import { AvatarGroup } from '@/components/arc/avatar-group/avatar-group'
import { Avatar } from '@/components/arc/avatar/avatar'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { rsvpSetAction } from '@/lib/space-actions'
import { RSVP_STATUSES, type RsvpStatus } from '@/lib/space-event'
import type { RsvpView, Voter } from '@/lib/spaces-data'

import { saveErrorKey } from './composer'
import { PersonHover } from './person-hover'
import type { PersonCard } from '@/lib/space-members'
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
 * An event's answers: three boxes, one per choice, with its count and the
 * member's own filled (choosing it again clears it); then the faces of who is
 * going, +N opening the full list. Once the event is over, or the
 * post is closed, the boxes keep their counts without being buttons.
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

  const [listOpen, setListOpen] = useState(false)
  // Choosing the selected answer again clears it.
  const toggle = (s: RsvpStatus) => choose(view.mine === s ? null : s)

  return (
    <div className={styles.eventReply}>
      {/* The three answers, each its own box with its count; the reader's own is filled. */}
      <div
        className={styles.rsvpCells}
        role={readOnly ? 'list' : 'group'}
        aria-label={readOnly ? t('rsvpCounts') : t('rsvpLabel')}
      >
        {RSVP_STATUSES.map((s) => {
          const inner = (
            <>
              {view.mine === s && <Check size={14} aria-hidden="true" />}
              <span>{t(`rsvp_${s}`)}</span>
              <span className={styles.rsvpCount}>{view.counts[s]}</span>
              {view.mine === s && <span className="sr-only">{t('rsvpYours')}</span>}
            </>
          )
          return readOnly ? (
            <span
              className={styles.rsvpCell}
              data-mine={view.mine === s || undefined}
              key={s}
              role="listitem"
            >
              {inner}
            </span>
          ) : (
            <button
              aria-pressed={view.mine === s}
              className={styles.rsvpCell}
              data-mine={view.mine === s || undefined}
              key={s}
              onClick={() => toggle(s)}
              type="button"
            >
              {inner}
            </button>
          )
        })}
      </div>
      {view.going.length > 0 && (
        <div className={styles.rsvpGoing}>
          <AvatarGroup
            size="sm"
            max={6}
            label={t('rsvpGoingList')}
            onOverflowClick={() => setListOpen(true)}
            members={view.going.map((v) => ({
              id: v.personId,
              fallbackSeed: personAvatarSeed(v.personId),
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
        </div>
      )}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent title={t('rsvpGoingList')}>
          <ul className={styles.rsvpList}>
            {view.going.map((v) => (
              <li key={v.personId}>
                <Avatar
                  fallbackSeed={personAvatarSeed(v.personId)}
                  name={v.name}
                  size="sm"
                  src={v.photo ?? undefined}
                />
                <span dir="auto">{v.name}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
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
