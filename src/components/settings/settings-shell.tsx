'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'

import { AnimatedCounter } from '@/components/arc/animated-counter/animated-counter'
import { Button } from '@/components/arc/button/button'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { isRtl } from '@/i18n/routing'

import styles from './settings-shell.module.css'

/** What a section tells the shell: how many fields changed, and how to save or drop them. */
export type SectionState = {
  count: number
  save: () => Promise<{ ok: true } | { ok: false; message?: string }>
  discard: () => void
}

type Registry = { report: (id: string, state: SectionState | null) => void }
const RegistryContext = createContext<Registry | null>(null)

/**
 * Hands a section's changes to the shell's save bar. Returns whether the
 * section sits inside a shell, so a form can hide its own Save button there.
 * The latest save and discard are called, so they may close over fresh state.
 */
export function useSettingsSection(id: string, state: SectionState): boolean {
  const registry = useContext(RegistryContext)
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  })
  const report = registry?.report
  const { count } = state
  useEffect(() => {
    report?.(id, {
      count,
      save: () => latest.current.save(),
      discard: () => latest.current.discard(),
    })
  }, [id, count, report])
  useEffect(() => () => report?.(id, null), [id, report])
  return registry !== null
}

export type SettingsSectionDef = {
  id: string
  label: string
  icon?: ReactNode
  content: ReactNode
}

type Props = {
  title: string
  intro?: string
  navLabel: string
  sections: SettingsSectionDef[]
}

const NARROW = '(max-width: 719px)'
const subscribeNarrow = (notify: () => void) => {
  const query = window.matchMedia(NARROW)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const useNarrow = () =>
  useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  )

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message?: string }

/**
 * An account settings page: a section nav, the sections, and a save bar that
 * appears while something is changed. The sections stay mounted so their
 * edits survive a switch; each reports its changed fields with
 * `useSettingsSection`. Save runs every section with changes, Discard drops
 * them all, and Cmd or Ctrl+S saves. The nav is a row of tabs below 720px,
 * a column above, and the arrow keys move along either.
 */
export function SettingsShell({ title, intro, navLabel, sections }: Props) {
  const t = useTranslations('Settings')
  const locale = useLocale()
  const reduceMotion = useReducedMotion()
  const narrow = useNarrow()
  const base = useId()
  const [active, setActive] = useState(sections[0]?.id ?? '')
  const [states, setStates] = useState<Record<string, SectionState>>({})
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({})

  const report = useCallback((id: string, state: SectionState | null) => {
    setStates((prev) => {
      if (state === null) {
        if (!(id in prev)) return prev
        const { [id]: _gone, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: state }
    })
  }, [])
  const registry = useMemo(() => ({ report }), [report])

  // The section in the address (#notifications) opens first; a change keeps the address in step.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1)
    if (sections.some((s) => s.id === fromHash)) setActive(fromHash)
  }, [sections])
  const select = useCallback((id: string, focus = false) => {
    setActive(id)
    window.history.replaceState(null, '', `#${id}`)
    if (focus) tabs.current[id]?.focus()
  }, [])

  const total = Object.values(states).reduce((sum, s) => sum + s.count, 0)
  const saving = status.kind === 'saving'

  const save = useCallback(async () => {
    if (saving) return
    const dirty = Object.entries(states).filter(([, s]) => s.count > 0)
    if (!dirty.length) return
    setStatus({ kind: 'saving' })
    for (const [id, section] of dirty) {
      const result = await section
        .save()
        .catch((): { ok: false; message?: string } => ({ ok: false }))
      if (!result.ok) {
        // Show the section that needs attention: its field has the error.
        select(id)
        setStatus({ kind: 'error', message: result.message })
        return
      }
    }
    setStatus({ kind: 'saved' })
  }, [saving, states, select])

  const discard = () => {
    for (const section of Object.values(states)) section.discard()
    setStatus({ kind: 'idle' })
  }

  // Cmd or Ctrl+S saves; without this the browser would offer to save the page.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  // A change after a save or an error starts a fresh round.
  useEffect(() => {
    if (total > 0 && (status.kind === 'saved' || status.kind === 'error'))
      setStatus({ kind: 'idle' })
  }, [total, status.kind])
  useEffect(() => {
    if (status.kind !== 'saved') return
    const timer = window.setTimeout(() => setStatus({ kind: 'idle' }), 5000)
    return () => window.clearTimeout(timer)
  }, [status.kind])

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const rtl = isRtl(locale)
    const forward = narrow ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown'
    const back = narrow ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp'
    let next = -1
    if (event.key === forward) next = (index + 1) % sections.length
    else if (event.key === back) next = (index - 1 + sections.length) % sections.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = sections.length - 1
    if (next < 0) return
    event.preventDefault()
    select(sections[next]!.id, true)
  }

  const announcement =
    status.kind === 'saving'
      ? t('saving')
      : status.kind === 'saved'
        ? t('saved')
        : status.kind === 'error'
          ? (status.message ?? t('saveFailed'))
          : total > 0
            ? t('unsavedAnnounce', { count: total })
            : ''

  return (
    <RegistryContext.Provider value={registry}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          {intro ? <p className={styles.intro}>{intro}</p> : null}
        </header>

        <div className={styles.layout}>
          <div
            role="tablist"
            aria-label={navLabel}
            aria-orientation={narrow ? 'horizontal' : 'vertical'}
            className={styles.nav}
          >
            {sections.map((section, index) => {
              const selected = section.id === active
              const count = states[section.id]?.count ?? 0
              return (
                <button
                  key={section.id}
                  ref={(node) => {
                    tabs.current[section.id] = node
                  }}
                  type="button"
                  role="tab"
                  id={`${base}-tab-${section.id}`}
                  aria-selected={selected}
                  aria-controls={`${base}-panel-${section.id}`}
                  tabIndex={selected ? 0 : -1}
                  className={styles.tab}
                  data-selected={selected || undefined}
                  onClick={() => select(section.id)}
                  onKeyDown={(event) => onTabKey(event, index)}
                >
                  {section.icon ? (
                    <span className={styles.tabIcon} aria-hidden="true">
                      {section.icon}
                    </span>
                  ) : null}
                  <span>{section.label}</span>
                  {count > 0 ? (
                    <span className={styles.tabCount}>
                      <span aria-hidden="true">{count}</span>
                      <span className="sr-only">{t('sectionChanges', { count })}</span>
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className={styles.panels}>
            {sections.map((section) => (
              <section
                key={section.id}
                role="tabpanel"
                id={`${base}-panel-${section.id}`}
                aria-labelledby={`${base}-tab-${section.id}`}
                hidden={section.id !== active}
                className={styles.panel}
              >
                {section.content}
              </section>
            ))}
          </div>
        </div>

        {/* Always present, so a screen reader hears each change of count and each result. */}
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <AnimatePresence>
          {total > 0 || saving ? (
            <motion.div
              key="bar"
              className={styles.barWrap}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: motionTokens.duration.instant } }
                  : { opacity: 0, y: 12, transition: { duration: motionTokens.duration.exit } }
              }
              transition={
                reduceMotion
                  ? { duration: motionTokens.duration.instant }
                  : motionTokens.spring.smooth
              }
            >
              <div className={styles.bar}>
                <p className={styles.barText}>
                  <span className={styles.barCount}>
                    <AnimatedCounter value={total} locale={locale === 'ar' ? 'ar-EG' : undefined} />
                  </span>
                  <span>{t('unsaved', { count: total })}</span>
                </p>
                <div className={styles.barActions}>
                  <Button type="button" variant="ghost" onClick={discard} disabled={saving}>
                    {t('discard')}
                  </Button>
                  <Button type="button" onClick={() => void save()} loading={saving}>
                    {t('save')}
                  </Button>
                </div>
                {status.kind === 'error' ? (
                  <p className={styles.barError}>{status.message ?? t('saveFailed')}</p>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </RegistryContext.Provider>
  )
}
