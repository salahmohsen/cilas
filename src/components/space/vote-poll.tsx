'use client'

import {
  useEffect,
  useId,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { animate, motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'

import { AvatarGroup } from '@/components/arc/avatar-group/avatar-group'
import { Button } from '@/components/arc/button/button'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { voteSetAction } from '@/app/(frontend)/[locale]/spaces/actions'
import type { VoteView } from '@/lib/spaces-data'

import { saveErrorKey } from './composer'
import { PersonHover, type PersonCard } from './person-hover'
import styles from './vote-poll.module.css'

/** The tally as it reads once the member's whole choice is replaced (voteSet's rule). */
const chosen = (view: VoteView, mine: string[]): VoteView => {
  const was = new Set(view.mine)
  const now = new Set(mine)
  return {
    ...view,
    options: view.options.map((o) => ({
      ...o,
      count: o.count + (now.has(o.id) ? 1 : 0) - (was.has(o.id) ? 1 : 0),
    })),
    voters: view.voters + (now.size > 0 ? 1 : 0) - (was.size > 0 ? 1 : 0),
    mine,
  }
}

/** Sizes the single-choice highlight to the chosen row, as Arc's radio group does. */
function place(
  highlight: HTMLElement | null,
  row: HTMLElement | null | undefined,
  at: { current: string },
  glide: boolean,
) {
  const next = row ? `${row.offsetTop} ${row.offsetHeight}` : ''
  if (!highlight || next === at.current) return
  const visible = at.current !== ''
  at.current = next
  if (!row) {
    animate(highlight, { opacity: 0 }, { duration: 0 })
    return
  }
  const target = { y: row.offsetTop, height: row.offsetHeight, opacity: 1 }
  if (glide && visible) {
    animate(highlight, target, { ...motionTokens.spring.morph, opacity: { duration: 0 } })
    return
  }
  Object.assign(highlight.style, {
    transform: `translateY(${target.y}px)`,
    height: `${target.height}px`,
    opacity: '1',
  })
  animate(highlight, target, { duration: 0 })
}

type Mode = 'choose' | 'results'

/**
 * A vote post's poll. Choosing reads like Arc's radio group (one highlight
 * travels for a single choice; check rows for several); results read like
 * a poll: a bar per option that fills to its share, the member's choice in
 * the accent, the leader's label emphasised. An open vote names who chose
 * each option; an anonymous one never receives them.
 */
export function VotePoll({
  post,
  vote,
  disabled,
  people,
}: {
  post: number
  vote: VoteView
  /** The space's people, so a voter's face opens the same card as everywhere else */
  people?: Map<number, PersonCard>
  /** Archived or locked: results only */
  disabled: boolean
}) {
  const t = useTranslations('SpacePost')
  const id = useId()
  const reduced = useReducedMotion()
  const router = useRouter()
  const [, start] = useTransition()
  const [view, apply] = useOptimistic(vote, chosen)
  const [mode, setMode] = useState<Mode>(disabled || vote.mine.length ? 'results' : 'choose')
  const [draft, setDraft] = useState<string[]>(vote.mine)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const showing: Mode = disabled ? 'results' : mode

  const submit = (options: string[]) => {
    const back = mode
    setError(null)
    setStatus('')
    setMode('results')
    const form = new FormData()
    form.set('post', String(post))
    for (const o of options) form.append('option', o)
    start(async () => {
      apply(options)
      const result = await voteSetAction({ status: 'ok' }, form)
      if (result.status === 'ok') {
        setStatus(t(options.length ? 'voteSaved' : 'voteWithdrawn'))
        router.refresh()
        return
      }
      setError(t(result.error === 'vote' ? 'voteInvalid' : saveErrorKey(result.error)))
      setDraft(options)
      setMode(back)
    })
  }

  const lead = Math.max(0, ...view.options.map((o) => o.count))
  const same = draft.length === view.mine.length && draft.every((o) => view.mine.includes(o))

  return (
    <section className={styles.poll} aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className={styles.hint}>
        {t(view.multiple ? 'voteHintMultiple' : 'voteHintSingle')}
      </p>
      {showing === 'choose' ? (
        <Choices
          name={id}
          label={t('voteLabel')}
          options={view.options}
          multiple={view.multiple}
          value={draft}
          onChange={setDraft}
          reduced={!!reduced}
        />
      ) : (
        <ul className={styles.results}>
          {view.options.map((o) => {
            // The share of voters, so with several choices each row reads on its own.
            const share = view.voters ? o.count / view.voters : 0
            const percent = Math.round(share * 100)
            const mine = view.mine.includes(o.id)
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
                <bdi className={styles.resultLabel}>{o.label}</bdi>
                {mine && (
                  <>
                    <Check size={14} aria-hidden="true" className={styles.resultMine} />
                    <span className="sr-only">{t('voteYours')}</span>
                  </>
                )}
                <span className={styles.resultCount}>{t('voteCount', { count: o.count })}</span>
                <span className={styles.resultPercent}>{percent}%</span>
                {o.voters.length > 0 && (
                  <span className={styles.resultVoters}>
                    <AvatarGroup
                      size="sm"
                      max={6}
                      label={t('voteChosenBy', { option: o.label })}
                      members={o.voters.map((v) => ({
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
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.foot}>
        <p className={styles.voters}>
          {t('voteVoters', { count: view.voters })}
          {view.anonymous && (
            <>
              {' · '}
              <span>{t('voteAnonymousShort')}</span>
            </>
          )}
        </p>
        {!disabled &&
          (showing === 'choose' ? (
            <div className={styles.actions}>
              {view.mine.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(view.mine)
                    setError(null)
                    setMode('results')
                  }}
                >
                  {t('voteCancel')}
                </Button>
              )}
              <Button
                size="sm"
                variant="primary"
                disabled={draft.length === 0 || same}
                onClick={() => submit(draft)}
              >
                {t(view.mine.length ? 'voteSave' : 'voteSubmit')}
              </Button>
            </div>
          ) : (
            <div className={styles.actions}>
              {view.mine.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => submit([])}>
                  {t('voteWithdraw')}
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDraft(view.mine)
                  setError(null)
                  setMode('choose')
                }}
              >
                {t(view.mine.length ? 'voteChange' : 'voteSubmit')}
              </Button>
            </div>
          ))}
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
    </section>
  )
}

/** The choice rows: native radios or checkboxes, so arrow keys and Space behave as the platform does. */
function Choices({
  name,
  label,
  options,
  multiple,
  value,
  onChange,
  reduced,
}: {
  name: string
  label: string
  options: VoteView['options']
  multiple: boolean
  value: string[]
  onChange: (value: string[]) => void
  reduced: boolean
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLSpanElement>(null)
  const rows = useRef<(HTMLLabelElement | null)[]>([])
  const shown = useRef<number | null>(null)
  const at = useRef('')
  const selected = multiple ? -1 : options.findIndex((o) => o.id === value[0])
  useLayoutEffect(() => {
    place(
      highlightRef.current,
      rows.current[selected],
      at,
      shown.current !== null && shown.current !== selected && !reduced,
    )
    shown.current = selected
    listRef.current?.setAttribute('data-ready', '')
  }, [selected, reduced])
  useEffect(() => {
    const list = listRef.current
    if (!list || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() =>
      place(highlightRef.current, rows.current[shown.current ?? -1], at, false),
    )
    observer.observe(list)
    return () => observer.disconnect()
  }, [options.length])
  const spring = (on: boolean) =>
    reduced
      ? { duration: 0 }
      : {
          ...motionTokens.spring.snappy,
          opacity: { duration: on ? motionTokens.duration.fast : motionTokens.duration.instant },
        }
  return (
    <fieldset className={styles.group}>
      <legend className="sr-only">{label}</legend>
      <div ref={listRef} className={styles.options} data-multiple={multiple || undefined}>
        <span ref={highlightRef} className={styles.highlight} aria-hidden="true" />
        {options.map((o, index) => {
          const on = value.includes(o.id)
          return (
            <label
              key={o.id}
              className={styles.option}
              ref={(node) => {
                rows.current[index] = node
              }}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                value={o.id}
                checked={on}
                onChange={() =>
                  onChange(
                    multiple ? (on ? value.filter((v) => v !== o.id) : [...value, o.id]) : [o.id],
                  )
                }
              />
              <span
                className={styles.mark}
                data-shape={multiple ? 'box' : 'dot'}
                aria-hidden="true"
              >
                <motion.span
                  className={styles.glyph}
                  initial={false}
                  animate={on ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
                  transition={spring(on)}
                >
                  {multiple && <Check size={12} strokeWidth={3} />}
                </motion.span>
              </span>
              <bdi className={styles.optionLabel}>{o.label}</bdi>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
