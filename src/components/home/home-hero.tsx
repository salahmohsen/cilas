'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { TextMorph } from '@/components/arc/text-morph/text-morph'
import { TextReveal } from '@/components/arc/text-reveal/text-reveal'
import { GrainGradient } from '@/components/ui/grain-gradient'
import { Link } from '@/i18n/navigation'

type Action = { label: string; href: string }

/** How long each audience stays before the next takes its place. */
const STEP = 2400

/**
 * The home page's opening: the motto over a slow grain gradient, the dusk
 * over the Nile, and who CILAS is for, one after another. The list runs once
 * and rests on its last line; with reduced motion it starts there.
 */
export function HomeHero({
  title,
  text,
  who,
  primary,
  secondary,
  locale,
}: {
  title: string
  text: string
  who: string[]
  primary: Action
  secondary: Action
  locale: string
}) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const last = who.length - 1
  const shown = reduced ? last : index

  useEffect(() => {
    if (reduced || index >= last) return
    const timer = window.setTimeout(() => setIndex((i) => i + 1), STEP)
    return () => window.clearTimeout(timer)
  }, [index, last, reduced])

  return (
    <section aria-labelledby="home-title" className="home-hero">
      <GrainGradient
        angle={-14}
        className="home-hero-ground"
        colorDark="#0f1a1c"
        colorLight="#cfd5c7"
        colorMid="#4c6f69"
        curve={0.35}
        grain={0.28}
        position={0.42}
        softness={0.22}
        speed={0.6}
      />
      <div className="home-hero-inner">
        <TextReveal as="h1" className="home-hero-title" id="home-title" text={title} />
        <p className="home-hero-text">{text}</p>
        {/* Read once, whole, by screen readers; the moving line is for the eye. */}
        <p className="sr-only">{who.join(locale === 'ar' ? '، ' : ', ')}</p>
        <p aria-hidden className="home-hero-who">
          {locale === 'ar' ? (
            // Arabic letters join, so the line changes whole instead of letter by letter.
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(4px)' }}
                initial={{ opacity: 0, filter: 'blur(4px)' }}
                key={shown}
                transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
              >
                {who[shown]}
              </motion.span>
            </AnimatePresence>
          ) : (
            <TextMorph>{who[shown] ?? ''}</TextMorph>
          )}
        </p>
        <div className="home-hero-actions">
          <Link className="home-action" data-primary href={primary.href}>
            {primary.label}
          </Link>
          <Link className="home-action" href={secondary.href}>
            {secondary.label}
          </Link>
        </div>
      </div>
    </section>
  )
}
