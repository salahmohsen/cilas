'use client'

import { personAvatarSeed } from '@/lib/avatar'

import { useId, useOptimistic, useState, useTransition } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'

import { Avatar } from '@/components/arc/avatar/avatar'
import { AvatarGroup } from '@/components/arc/avatar-group/avatar-group'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { numberingSystemOf } from '@/lib/digits'
import { voteSetAction } from '@/app/(frontend)/[locale]/spaces/actions'
import type { VoteView, Voter } from '@/lib/spaces-data'

import { saveErrorKey } from './composer'
import { PersonHover, type PersonCard } from './person-hover'
import type { ThreadViewer } from './space-thread'
import styles from './vote-poll.module.css'

/** The tally as it reads once the member's whole choice is replaced (voteSet's rule). */
const chosen = (
  view: VoteView,
  { mine, voter }: { mine: string[]; voter: Voter | null },
): VoteView => {
  const was = new Set(view.mine)
  const now = new Set(mine)
  return {
    ...view,
    options: view.options.map((o) => {
      const selected = now.has(o.id)
      const delta = Number(selected) - Number(was.has(o.id))
      let voters = view.anonymous ? [] : o.voters
      if (!view.anonymous && voter && delta !== 0) {
        voters = voters.filter((v) => v.personId !== voter.personId)
        if (selected) voters = [...voters, voter]
      }
      return { ...o, count: o.count + delta, voters }
    }),
    voters: view.voters + (now.size > 0 ? 1 : 0) - (was.size > 0 ? 1 : 0),
    mine,
  }
}

/** Faces on an option before the "+N" that opens everyone who chose it. */
const FACES = 6

/**
 * A vote post's poll, one tap at a time, as chat polls work: tapping an option
 * votes for it, tapping your own choice takes it back, and with a single
 * choice tapping another moves the vote there. Each row is the option's bar,
 * filled to its share, the member's choice in the accent. An open vote shows
 * who chose each option, all of them one tap away; an anonymous one never
 * receives them. A vote past its closing time shows results only.
 */
export function VotePoll({
  post,
  vote,
  disabled,
  people,
  viewer,
}: {
  post: number
  vote: VoteView
  /** The space's people, so a voter's face opens the same card as everywhere else */
  people?: Map<number, PersonCard>
  viewer: ThreadViewer
  /** Archived or locked: results only */
  disabled: boolean
}) {
  const t = useTranslations('SpacePost')
  const format = useFormatter()
  const locale = useLocale()
  const id = useId()
  const reduced = useReducedMotion()
  const router = useRouter()
  const [, start] = useTransition()
  const [view, apply] = useOptimistic(vote, chosen)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [listed, setListed] = useState<string | null>(null)
  const open = !disabled && !view.closed

  const submit = (options: string[]) => {
    setError(null)
    setStatus('')
    const form = new FormData()
    form.set('post', String(post))
    for (const o of options) form.append('option', o)
    start(async () => {
      apply({
        mine: options,
        voter:
          !vote.anonymous && viewer.personId != null
            ? { personId: viewer.personId, ...viewer.me }
            : null,
      })
      const result = await voteSetAction({ status: 'ok' }, form)
      if (result.status === 'ok') {
        setStatus(t(options.length ? 'voteSaved' : 'voteWithdrawn'))
        router.refresh()
        return
      }
      setError(
        t(
          result.error === 'vote'
            ? 'voteInvalid'
            : result.error === 'vote-closed'
              ? 'voteClosedError'
              : saveErrorKey(result.error),
        ),
      )
    })
  }

  const toggle = (option: string) => {
    const on = view.mine.includes(option)
    if (view.multiple) submit(on ? view.mine.filter((o) => o !== option) : [...view.mine, option])
    else submit(on ? [] : [option])
  }

  const lead = Math.max(0, ...view.options.map((o) => o.count))
  const closing = view.closesAt
    ? format.dateTime(new Date(view.closesAt), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Africa/Cairo',
        numberingSystem: numberingSystemOf(locale),
      })
    : null
  const shownList = view.options.find((o) => o.id === listed)

  return (
    <section
      className={styles.poll}
      aria-labelledby={open ? `${id}-label` : undefined}
      aria-label={open ? undefined : t('voteResults')}
    >
      {open && (
        <p id={`${id}-label`} className={styles.hint}>
          {t(view.multiple ? 'voteTapMultiple' : 'voteTapSingle')}
        </p>
      )}
      <ul className={styles.results}>
        {view.options.map((o) => {
          // The share of voters, so with several choices each row reads on its own.
          const share = view.voters ? o.count / view.voters : 0
          const percent = Math.round(share * 100)
          const mine = view.mine.includes(o.id)
          const row = (
            <>
              {open && (
                <span
                  className={styles.mark}
                  data-shape={view.multiple ? 'box' : 'dot'}
                  data-on={mine || undefined}
                  aria-hidden="true"
                >
                  {mine &&
                    (view.multiple ? (
                      <Check size={12} strokeWidth={3} />
                    ) : (
                      <span className={styles.dot} />
                    ))}
                </span>
              )}
              <bdi className={styles.resultLabel}>{o.label}</bdi>
              {mine && !open && (
                <Check size={14} aria-hidden="true" className={styles.resultMine} />
              )}
              <span className={styles.resultPercent}>{percent}%</span>
            </>
          )
          return (
            <li
              key={o.id}
              className={styles.result}
              data-mine={mine || undefined}
              data-lead={(lead > 0 && o.count === lead) || undefined}
            >
              <span className={styles.track} aria-hidden="true">
                <motion.span
                  className={styles.bar}
                  initial={reduced ? false : { width: '0%' }}
                  animate={{ width: `${share * 100}%` }}
                  transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
                />
              </span>
              {open ? (
                <button
                  type="button"
                  className={styles.choice}
                  aria-pressed={mine}
                  aria-label={t('voteOptionLabel', { option: o.label, percent })}
                  onClick={() => toggle(o.id)}
                >
                  {row}
                </button>
              ) : (
                <span className={styles.choice}>
                  {row}
                  {mine && <span className="sr-only">{t('voteYours')}</span>}
                </span>
              )}
              {o.voters.length > 0 && (
                <span className={styles.resultVoters}>
                  <AvatarGroup
                    size="sm"
                    max={FACES}
                    label={t('voteChosenBy', { option: o.label })}
                    members={o.voters.map((v) => ({
                      id: v.personId,
                      fallbackSeed: personAvatarSeed(v.personId),
                      name: v.name,
                      src: v.photo ?? undefined,
                    }))}
                    wrap={(member, face) => (
                      <PersonHover person={cardOf(people, member)}>{face}</PersonHover>
                    )}
                    onOverflowClick={() => setListed(o.id)}
                  />
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <p className={styles.voters}>
        {[
          t('voteVoters', { count: view.voters }),
          view.anonymous && t('voteAnonymousShort'),
          view.closed
            ? t('voteClosed', { when: closing ?? '' })
            : closing && t('voteCloses', { when: closing }),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p role="status" className="sr-only">
        {status}
      </p>
      <Dialog open={shownList != null} onOpenChange={(next) => !next && setListed(null)}>
        <DialogContent
          title={shownList ? t('voteChosenBy', { option: shownList.label }) : ''}
          description={shownList ? t('voteVoters', { count: shownList.count }) : undefined}
        >
          <ul className={styles.voterList}>
            {shownList?.voters.map((v) => (
              <li key={v.personId} className={styles.voterRow}>
                <Avatar
                  fallbackSeed={personAvatarSeed(v.personId)}
                  name={v.name}
                  src={v.photo ?? undefined}
                  size="sm"
                />
                <PersonHover
                  person={cardOf(people, {
                    id: v.personId,
                    name: v.name,
                    src: v.photo ?? undefined,
                  })}
                >
                  <button type="button" className={styles.voterName}>
                    <bdi>{v.name}</bdi>
                  </button>
                </PersonHover>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/** A voter's card: the space's own, or a plain one from the vote's names. */
const cardOf = (
  people: Map<number, PersonCard> | undefined,
  member: { id?: number | string; name: string; src?: string },
): PersonCard =>
  people?.get(Number(member.id)) ?? {
    id: Number(member.id),
    name: member.name,
    photo: member.src ?? null,
    role: '',
    bio: null,
    links: [],
    href: null,
  }
