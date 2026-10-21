'use client'

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { latinDigits, localDigits } from '@/lib/digits'
import { motionTokens } from '../../lib/motion-tokens'
import { defaultSyllabusProps } from './syllabus-feed-data'
import styles from './syllabus-feed.module.css'

/**
 * A course's syllabus as a feed: dated sessions grouped by month, opened in
 * place, filtered by what happens in them and what to prepare for them.
 *
 * A motion-port of the changelog-feed block, with the syllabus's own
 * semantics: the sessions run first to last, and every panel stays mounted,
 * so each session's text always ships in the page's HTML, open or closed.
 * The month rail and the scroll sync work against the block's own scroller.
 *
 * Sessions' text is rendered ahead, server-side, and passed as `body`.
 * Labels and digits are rendered here through next-intl.
 */

type Attrs = Record<string, string>

export type SyllabusMeeting = { date: string; time: string }

export type SyllabusEntry = {
  id: string
  /** The session's month, one of `groups`' keys. */
  month: string
  /** The session number as written, e.g. "٣" or "3". */
  no: string
  /** The session's first meeting, for the row's date. */
  date?: { label: string; iso?: string }
  title: string
  /** One line under the title: its unit, its meetings, its counts. */
  meta?: { unit?: string; meetings?: SyllabusMeeting[]; extra?: string[] }
  cancelled?: boolean
  /** Activity kinds carried by the session, for the chips. */
  activities: string[]
  /** Material types carried by the session, for the chips. */
  materials: string[]
  /** The session's text, materials and activities, rendered by the caller. */
  body?: ReactNode
  /** The visual editor's marks for the row's own fields. */
  attrs?: {
    row?: Attrs
    title?: Attrs
    meta?: Attrs
    no?: Attrs
    date?: Attrs
  }
}

export type SyllabusGroup = { key: string; label: string; short: string }

export interface SyllabusFeedProps {
  /** Sessions in reading order, first to last. Each belongs to one of `groups` by key. */
  entries?: SyllabusEntry[]
  /** Months shown in the rail, oldest first. */
  groups?: SyllabusGroup[]
  title?: string
  /** One line under the title, such as the latest release. */
  subtitle?: string
  /** The visual editor's marks for the heading lines. */
  headerAttrs?: { title?: Attrs; subtitle?: Attrs }
  /** Closing line at the end of the list. */
  endNote?: string
  /** Entry ids open on first render. Defaults to the first entry. */
  defaultOpen?: string[]
  /** In the live preview: every session stays open, since the editor cannot open a closed one. */
  openAll?: boolean
  /** The visual editor's container marks for the list itself, spread onto it. */
  containerAttrs?: Attrs
  className?: string
}

const blurSoft = `blur(${motionTokens.blur.soft}px)`
const blurSubtle = `blur(${motionTokens.blur.subtle}px)`
const none = 'blur(0px)'
const instant: Transition = { duration: 0 }
const exitSpring: Transition = { type: 'spring', visualDuration: 0.28, bounce: 0 }
type FilterState = Record<'activity' | 'material', string[]>

/** Values rise when they grow and fall when they shrink; the outgoing value leaves the opposite way. */
const roll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${direction * 55}%`, filter: blurSubtle }),
  center: { opacity: 1, y: '0%', filter: none },
  exit: (direction: number) => ({ opacity: 0, y: `${direction * -55}%`, filter: blurSubtle }),
}
const rise: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: direction * 14, filter: blurSubtle }),
  center: { opacity: 1, y: 0, filter: none },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction * -14,
    filter: blurSubtle,
    transition: { duration: motionTokens.duration.exit },
  }),
}

const asNumber = (value: string): number => Number(latinDigits(value))

/** A count whose digits roll over in place, so numbers glide rather than jump. */
function RollingNumber({ value, reduce }: { value: string; reduce: boolean }) {
  const [state, setState] = useState({ value, direction: 1 })
  if (state.value !== value)
    setState({
      value,
      direction: asNumber(value) > asNumber(state.value) ? 1 : -1,
    })
  return (
    <span className={styles.roll}>
      <AnimatePresence mode="popLayout" initial={false} custom={state.direction}>
        <motion.span
          key={value}
          custom={state.direction}
          variants={roll}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reduce ? instant : motionTokens.spring.snappy}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

type FacetGroup = 'activity' | 'material'
type Facet = { group: FacetGroup; id: string; label: string; count: number }

/** One pill that breathes from a dot to a ticked disc as its filter turns on. */
function Chip({
  facet,
  on,
  onToggle,
  count: countLabel,
  reduce,
}: {
  facet: Facet
  on: boolean
  onToggle: () => void
  count: string
  reduce: boolean
}) {
  return (
    <button
      type="button"
      className={styles.chip}
      data-group={facet.group}
      aria-pressed={on}
      onClick={onToggle}
    >
      <motion.span
        className={styles.chipMark}
        aria-hidden="true"
        initial={false}
        animate={{ width: on ? 16 : 7, height: on ? 16 : 7 }}
        transition={reduce ? instant : motionTokens.spring.morph}
      >
        <motion.span
          className={styles.chipTick}
          initial={false}
          animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.4 }}
          transition={reduce ? instant : { ...motionTokens.spring.snappy, delay: on ? 0.05 : 0 }}
        >
          <Check size={11} strokeWidth={2.6} />
        </motion.span>
      </motion.span>
      <span>{facet.label}</span>
      <span className={styles.chipCount}>{countLabel}</span>
    </button>
  )
}

/** One session row: its date and number, then its text, materials and activities opening under it. */
function EntryRow({
  entry,
  open,
  onToggle,
  reduce,
}: {
  entry: SyllabusEntry
  open: boolean
  onToggle: () => void
  reduce: boolean
}) {
  const t = useTranslations('Course')
  const panelId = useId()
  const layout: Transition = reduce ? instant : motionTokens.spring.smooth

  return (
    <motion.li
      layout="position"
      className={styles.entry}
      data-open={open || undefined}
      {...entry.attrs?.row}
      initial={reduce ? { opacity: 0 } : { opacity: 0, filter: blurSubtle }}
      animate={{ opacity: 1, filter: none }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: motionTokens.duration.instant } }
          : {
              opacity: 0,
              scale: 0.98,
              filter: blurSubtle,
              transition: { duration: motionTokens.duration.exit },
            }
      }
      transition={
        reduce
          ? { duration: 0, opacity: { duration: motionTokens.duration.instant } }
          : {
              opacity: { duration: motionTokens.duration.standard },
              filter: { duration: motionTokens.duration.standard },
              layout,
            }
      }
    >
      <button
        type="button"
        className={styles.row}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className={styles.meta}>
          <span className={styles.number} {...entry.attrs?.no}>
            {entry.no}
          </span>
          {entry.date ? (
            <time dateTime={entry.date.iso} {...entry.attrs?.date}>
              {entry.date.label}
            </time>
          ) : (
            <span {...entry.attrs?.date} />
          )}
        </span>
        <span className={styles.body}>
          {(entry.cancelled || entry.activities.length > 0) && (
            <span className={styles.kindLine}>
              {entry.cancelled ? (
                <span className={styles.kind} data-state="cancelled">
                  <i aria-hidden="true" />
                  {t('cancelled')}
                </span>
              ) : (
                entry.activities.slice(0, 3).map((id) => (
                  <span className={styles.kind} key={id} data-kind={id}>
                    <i aria-hidden="true" />
                    {t(`activityKinds.${id}`)}
                  </span>
                ))
              )}
            </span>
          )}
          <span className={styles.title} {...entry.attrs?.title} dir="auto">
            {entry.title}
          </span>
          {entry.meta ? (
            <span className={styles.summary} {...entry.attrs?.meta} dir="auto">
              {(() => {
                const segments: ReactNode[] = []
                if (entry.meta!.unit)
                  segments.push(
                    <span className={styles.unit} key="unit">
                      {entry.meta!.unit}
                    </span>,
                  )
                for (const [i, meeting] of (entry.meta!.meetings ?? []).entries())
                  segments.push(
                    <span key={`date${i}`} className={[styles.part, styles.date].join(' ')}>
                      {meeting.date}
                    </span>,
                    <span key={`time${i}`} className={[styles.part, styles.clock].join(' ')}>
                      {meeting.time}
                    </span>,
                  )
                for (const [i, line] of (entry.meta!.extra ?? []).entries())
                  segments.push(
                    <span className={styles.unit} key={`extra${i}`}>
                      {line}
                    </span>,
                  )
                return segments.map((segment, i) => (
                  <Fragment key={i * 2}>
                    {i > 0 && <span aria-hidden="true" className={styles.seam} />}
                    {segment}
                  </Fragment>
                ))
              })()}
            </span>
          ) : null}
        </span>
        <motion.span
          className={styles.chevron}
          aria-hidden="true"
          initial={false}
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduce ? instant : motionTokens.spring.snappy}
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>
      {/* Opened with a height spring; the panel's text rises in a beat later. */}
      <motion.div
        id={panelId}
        className={styles.panel}
        initial={false}
        animate={{ height: open ? 'auto' : 0 }}
        transition={reduce ? instant : open ? motionTokens.spring.smooth : exitSpring}
      >
        <motion.div
          className={styles.panelInner}
          initial={false}
          animate={open ? { opacity: 1, y: 0, filter: none } : { opacity: 0, y: 8, filter: blurSoft }}
          transition={
            reduce
              ? instant
              : open
                ? {
                    y: { ...motionTokens.spring.smooth, delay: 0.06 },
                    opacity: { duration: motionTokens.duration.standard, delay: 0.06 },
                    filter: { duration: motionTokens.duration.standard, delay: 0.06 },
                  }
                : { duration: motionTokens.duration.instant }
          }
        >
          {entry.body}
        </motion.div>
      </motion.div>
    </motion.li>
  )
}

export function SyllabusFeed({
  entries,
  groups,
  title,
  subtitle,
  headerAttrs,
  endNote,
  defaultOpen,
  openAll = false,
  containerAttrs,
  className,
}: SyllabusFeedProps) {
  const t = useTranslations('Course')
  const locale = useLocale()
  const uid = useId()
  const reduce = useReducedMotion() ?? false
  const [filters, setFilters] = useState<FilterState>({ activity: [], material: [] })
  const [openState, setOpen] = useState<string[]>(() => defaultOpen ?? [])
  const [active, setActive] = useState<{ key: string; direction: number }>({
    key: '',
    direction: 1,
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef(new Map<string, HTMLElement>())
  const frame = useRef(0)

  const entries_ = useMemo(() => entries ?? [], [entries])
  const groups_ = useMemo(() => groups ?? [], [groups])
  const groupOrder = useMemo(
    () => new Map(groups_.map((group, index) => [group.key, index])),
    [groups_],
  )

  // In the visual editor every panel stays open: the editor cannot reach into a closed one.
  const open = useMemo(
    () => (openAll ? entries_.map((entry) => entry.id) : openState),
    [openAll, entries_, openState],
  )

  const anySelected = filters.activity.length + filters.material.length > 0
  const visible = useMemo(
    () =>
      entries_.filter(
        (entry) =>
          (filters.activity.length === 0 ||
            filters.activity.some((id) => entry.activities.includes(id))) &&
          (filters.material.length === 0 ||
            filters.material.some((id) => entry.materials.includes(id))),
      ),
    [entries_, filters],
  )
  const shown = useMemo(
    () =>
      groups_
        .map((group) => ({ ...group, items: visible.filter((entry) => entry.month === group.key) }))
        .filter((group) => group.items.length > 0),
    [groups_, visible],
  )
  const current = shown.find((group) => group.key === active.key) ?? shown[0]

  // The chip row counts each kind's sessions, in the order the syllabus introduces them.
  const chips = useMemo<Facet[]>(() => {
    const join = (field: 'activities' | 'materials', path: string): Facet[] => {
      const seen: string[] = []
      for (const entry of entries_)
        for (const id of entry[field]) if (!seen.includes(id)) seen.push(id)
      return seen.map((id) => ({
        group: path === 'activityKinds' ? 'activity' : 'material',
        id,
        label: t(`${path}.${id}`),
        count: entries_.filter((entry) => entry[field].includes(id)).length,
      }))
    }
    return [...join('activities', 'activityKinds'), ...join('materials', 'materialTypes')]
  }, [entries_, t])

  // The month rail follows the group under its line, synced against the
  // scroller's own coordinates; the list resizes itself (a panel opens),
  // so it syncs on the list's size too, not only the scroller's scroll.
  const sync = useCallback(() => {
    const scroller = scrollRef.current
    if (!scroller || shown.length === 0) return
    const line = scroller.getBoundingClientRect().top + 28
    let key = shown[0]!.key
    for (const group of shown) {
      const element = groupRefs.current.get(group.key)
      if (element && element.getBoundingClientRect().top <= line) key = group.key
    }
    if (
      scroller.scrollTop > 0 &&
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
    )
      key = shown[shown.length - 1]!.key
    setActive((previous) => {
      const place = (groupKey: string) => groupOrder.get(groupKey) ?? 0
      if (previous.key === key || !key) return previous
      return { key, direction: place(key) > place(previous.key) ? 1 : -1 }
    })
  }, [shown, groupOrder])

  const onScroll = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      sync()
    })
  }, [sync])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(onScroll)
    observer.observe(list)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame.current)
    }
  }, [onScroll])

  function toggle(facet: Facet) {
    setFilters((previous) => {
      const own = previous[facet.group]
      return {
        ...previous,
        [facet.group]: own.includes(facet.id) ? own.filter((id) => id !== facet.id) : [...own, facet.id],
      }
    })
  }
  function toggleEntry(id: string) {
    setOpen((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    )
  }
  function jumpTo(key: string) {
    const scroller = scrollRef.current
    const element = groupRefs.current.get(key)
    if (!scroller || !element) return
    const top =
      scroller.scrollTop + element.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    scroller.scrollTo({ top: Math.max(0, top - 1), behavior: reduce ? 'auto' : 'smooth' })
  }

  const total = entries_.length
  const shownCount = visible.length
  const wordThis = (count: number) => t('feedWord', { count })
  const layout: Transition = reduce ? instant : motionTokens.spring.smooth

  const shownLabel =
    !anySelected
      ? `${localDigits(shownCount, locale)} ${wordThis(shownCount)}`
      : `${localDigits(shownCount, locale)} ${t('feedOf')} ${localDigits(total, locale)} ${wordThis(total)}`

  return (
    <section className={[styles.feed, className].filter(Boolean).join(' ')} aria-labelledby={title ? `${uid}-title` : undefined}>
      {title && (
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={`${uid}-title`} {...headerAttrs?.title}>
              {title}
            </h2>
            {subtitle && (
              <p {...headerAttrs?.subtitle}>{subtitle}</p>
            )}
          </div>
        </header>
      )}

      {chips.length > 0 && (
        <div className={styles.toolbar}>
          <div className={styles.chips} role="group" aria-label={t('feedFilterBy')}>
            {chips.map((facet, index) => (
              <span
                className={styles.chipSlot}
                key={`${facet.group}!${facet.id}`}
                data-gap={index > 0 && chips[index - 1].group !== facet.group ? '' : undefined}
              >
                <Chip
                  facet={facet}
                  count={localDigits(facet.count, locale)}
                  on={filters[facet.group].includes(facet.id)}
                  onToggle={() => toggle(facet)}
                  reduce={reduce}
                />
              </span>
            ))}
            <AnimatePresence initial={false}>
              {anySelected && (
                <motion.button
                  key="clear"
                  type="button"
                  className={styles.clear}
                  onClick={() => setFilters({ activity: [], material: [] })}
                  initial={{ opacity: 0, x: -6, filter: blurSubtle }}
                  animate={{ opacity: 1, x: 0, filter: none }}
                  exit={{
                    opacity: 0,
                    x: -4,
                    filter: blurSubtle,
                    transition: { duration: motionTokens.duration.instant },
                  }}
                  transition={reduce ? instant : motionTokens.spring.snappy}
                >
                  {t('feedShowAll')}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <p className={styles.shown} aria-hidden="true">
            <motion.span className={styles.shownCount} layout="position" transition={layout}>
              <RollingNumber value={localDigits(shownCount, locale)} reduce={reduce} />
            </motion.span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={!anySelected ? 'all' : 'some'}
                initial={{ opacity: 0, filter: blurSubtle }}
                animate={{ opacity: 1, filter: none }}
                exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
                transition={reduce ? instant : { duration: motionTokens.duration.standard }}
              >
                {!anySelected
                  ? wordThis(shownCount)
                  : `${t('feedOf')} ${localDigits(total, locale)} ${wordThis(total)}`}
              </motion.span>
            </AnimatePresence>
          </p>
          <p className={styles.srOnly} role="status" aria-live="polite">
            {t('feedSr', { text: shownLabel })}
          </p>
        </div>
      )}

      {shown.length > 0 && (
        <div className={styles.monthBar}>
          <div className={styles.monthLabel} aria-hidden="true">
            <span className={styles.monthText}>
              <AnimatePresence mode="popLayout" initial={false} custom={active.direction}>
                <motion.span
                  key={current?.key ?? 'none'}
                  custom={active.direction}
                  variants={rise}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={reduce ? instant : motionTokens.spring.morph}
                >
                  {current?.label ?? t('feedNone')}
                </motion.span>
              </AnimatePresence>
            </span>
            <motion.span className={styles.monthCount} layout="position" transition={layout}>
              <RollingNumber
                value={localDigits(current?.items.length ?? 0, locale)}
                reduce={reduce}
              />
              <span>{wordThis(current?.items.length ?? 0)}</span>
            </motion.span>
          </div>
          <nav className={styles.monthNav} aria-label={t('feedJump')}>
            {shown.map((group) => {
              const selected = group.key === current?.key
              return (
                <button
                  key={group.key}
                  type="button"
                  aria-label={t('feedJumpTo', { month: group.label })}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => jumpTo(group.key)}
                >
                  {selected && (
                    <motion.span
                      layoutId={`${uid}-month`}
                      className={styles.monthPill}
                      transition={reduce ? instant : motionTokens.spring.morph}
                    />
                  )}
                  <span className={styles.monthShort}>{group.short}</span>
                </button>
              )
            })}
          </nav>
        </div>
      )}

      <motion.div
        layoutScroll
        ref={scrollRef}
        className={styles.scroller}
        onScroll={onScroll}
        tabIndex={0}
        aria-label={title ?? t('flow')}
      >
        <div ref={listRef} className={styles.list} {...containerAttrs}>
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.map((group, index) => (
              <motion.section
                key={group.key}
                layout="position"
                className={styles.group}
                ref={(element: HTMLElement | null) => {
                  if (element) groupRefs.current.set(group.key, element)
                  else groupRefs.current.delete(group.key)
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
                transition={{
                  layout,
                  opacity: {
                    duration: reduce
                      ? motionTokens.duration.instant
                      : motionTokens.duration.standard,
                  },
                }}
              >
                <h3
                  id={`${uid}-${group.key}`}
                  className={index === 0 ? styles.srOnly : styles.groupTitle}
                >
                  {group.label}
                </h3>
                <ul className={styles.entries}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {group.items.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        open={open.includes(entry.id)}
                        onToggle={() => toggleEntry(entry.id)}
                        reduce={reduce}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.section>
            ))}
          </AnimatePresence>
          {shown.length === 0 && (
            <motion.p
              layout="position"
              className={styles.none}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {total === 0 ? t('feedEmpty') : t('feedNoMatch')}
            </motion.p>
          )}
          {endNote && shown.length > 0 && (
            <motion.p layout="position" transition={{ layout }} className={styles.endCap}>
              {endNote}
            </motion.p>
          )}
        </div>
      </motion.div>
    </section>
  )
}

/** Preview: a sample syllabus, as the block's demo. */
export function SyllabusFeedBlock() {
  return (
    <div style={{ padding: 40 }}>
      <SyllabusFeed {...defaultSyllabusProps} />
    </div>
  )
}

export default SyllabusFeed
