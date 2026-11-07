'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

import { Accordion } from '@/components/arc/accordion/accordion'
import { BounceSidebar } from '@/components/ui/bounce-sidebar'
import type { Section, SectionTag } from '@/lib/article-body'

/** A thin bar across the top of the viewport that fills as the essay is read. */
export function ReadingProgress({ target }: { target: string }) {
  const t = useTranslations('Article')
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const el = document.getElementById(target)
    if (!el) return
    const update = () => {
      const { top, height } = el.getBoundingClientRect()
      const total = height - window.innerHeight
      setProgress(total <= 0 ? 1 : Math.min(1, Math.max(0, -top / total)))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [target])
  return (
    <div
      aria-label={t('progress')}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(progress * 100)}
      className="fixed inset-x-0 top-0 z-50 h-0.5"
      role="progressbar"
    >
      <div
        className="h-full origin-[0_50%] bg-foreground transition-transform duration-150 ease-out rtl:origin-[100%_50%]"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  )
}

/**
 * The essay's sections, sticky beside the text on wide screens and folded
 * under the title on narrow ones. The current section is the last heading
 * that has scrolled past the top third of the viewport.
 */
export function ArticleContents({
  sections,
  sectionTag = 'h2',
  container,
  bare = false,
}: {
  sections: Section[]
  /** The heading level the sections come from. */
  sectionTag?: SectionTag
  container: string
  /** Only the list: a side card's section names it. */
  bare?: boolean
}) {
  const t = useTranslations('Article')
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    // The rich text renders plain headings; give them the ids the list links to.
    const headings = [...(document.getElementById(container)?.querySelectorAll(sectionTag) ?? [])]
    headings.forEach((h, i) => {
      if (sections[i]) h.id = sections[i].id
    })
    const text = document.getElementById(container)
    // A section is current only while it is on screen: before the first
    // heading reaches the line, and once the text has scrolled away, none is.
    const update = () => {
      const line = window.innerHeight / 3
      let current: string | null = null
      for (const h of headings) if (h.getBoundingClientRect().top <= line) current = h.id
      if (text && text.getBoundingClientRect().bottom < line) current = null
      setActive(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [container, sections, sectionTag])

  // rareui's BounceSidebar: the dot travels to the section in view.
  const list = (
    <BounceSidebar
      aria-label={t('contents')}
      className="text-sm leading-snug"
      items={sections.map((s) => ({ label: s.title, href: `#${s.id}` }))}
      value={sections.findIndex((s) => s.id === active)}
    />
  )

  if (bare)
    return (
      <nav aria-label={t('contents')} className="side-card-body">
        {list}
      </nav>
    )
  return (
    <nav aria-label={t('contents')}>
      <details className="border-y border-border py-3 lg:hidden">
        <summary className="cursor-pointer font-mono text-[0.7rem] tracking-[0.14em] uppercase">
          {t('contents')}
        </summary>
        <div className="pt-3">{list}</div>
      </details>
      <div className="hidden lg:block">
        <p className="mb-3 font-mono text-[0.68rem] tracking-[0.14em] uppercase opacity-60">
          {t('onThisPage')}
        </p>
        {list}
      </div>
    </nav>
  )
}

const SIZES = [0.92, 1, 1.1, 1.22] as const
const SIZE_KEY = 'cilas-text-size'
const SIZE_EVENT = 'cilas-text-size'

/** The saved size step, read from this browser (the default on the server). */
const readStep = (): number => {
  try {
    const saved = Number(localStorage.getItem(SIZE_KEY) ?? 1)
    return saved >= 0 && saved < SIZES.length ? saved : 1
  } catch {
    return 1 // Storage blocked: the default size.
  }
}
const subscribeStep = (onChange: () => void) => {
  window.addEventListener(SIZE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(SIZE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** A− / A+ for the essay text, remembered in this browser. */
export function TextSize({ target, cells = false }: { target: string; cells?: boolean }) {
  const t = useTranslations('Article')
  const step = useSyncExternalStore(subscribeStep, readStep, () => 1)
  const setStep = (update: (s: number) => number) => {
    try {
      localStorage.setItem(SIZE_KEY, String(update(step)))
    } catch {
      // Storage blocked: the size will not be remembered.
    }
    window.dispatchEvent(new Event(SIZE_EVENT))
  }
  useEffect(() => {
    document.getElementById(target)?.style.setProperty('--reading-scale', String(SIZES[step]))
  }, [step, target])
  if (cells)
    return (
      <div aria-label={t('textSize')} className="side-card-buttons" role="group">
        <button
          aria-label={t('smaller')}
          className="side-card-button text-xs"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          type="button"
        >
          <bdi dir="ltr">A−</bdi>
        </button>
        <button
          aria-label={t('larger')}
          className="side-card-button text-base"
          disabled={step === SIZES.length - 1}
          onClick={() => setStep((s) => s + 1)}
          type="button"
        >
          <bdi dir="ltr">A+</bdi>
        </button>
      </div>
    )
  const button =
    'inline-flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-30'
  return (
    <div aria-label={t('textSize')} className="inline-flex items-center gap-1" role="group">
      <button
        aria-label={t('smaller')}
        className={`${button} text-xs`}
        disabled={step === 0}
        onClick={() => setStep((s) => s - 1)}
        type="button"
      >
        A−
      </button>
      <button
        aria-label={t('larger')}
        className={`${button} text-base`}
        disabled={step === SIZES.length - 1}
        onClick={() => setStep((s) => s + 1)}
        type="button"
      >
        A+
      </button>
    </div>
  )
}

/** The essay's notes, folded so the text ends cleanly. */
export function ArticleNotes({ title, children }: { title: string; children: ReactNode }) {
  return <Accordion defaultOpen={-1} items={[{ title, content: children }]} />
}
