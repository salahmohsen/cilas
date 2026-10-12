'use client'

import { BookOpen, Calendar, Newspaper, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { Suspense, useEffect, useRef, useState } from 'react'

import { SiteHeader } from '@/components/arc/blocks/site-header/site-header'
import { LanguageSwitch, ThemeToggle } from '@/components/site-controls'

/** The site's main navigation, in the site language, with links under it. */
export function CILASSiteHeader() {
  const t = useTranslations('Header')
  const locale = useLocale()
  // Arc's header renders plain anchors, so each href carries the language.
  const href = (path: string) => `/${locale}${path === '/' ? '' : path}`

  // The header's height, as --site-header-height, so in-page jumps land below it.
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const set = () =>
      document.documentElement.style.setProperty('--site-header-height', `${el.offsetHeight}px`)
    set()
    const observer = new ResizeObserver(set)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Apply shows only while something is open, and leads to it (see /api/open).
  const [applyPath, setApplyPath] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    fetch('/api/open')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { href?: string | null } | null) => {
        if (live) setApplyPath(body?.href ?? null)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const items = [
    {
      value: 'study',
      label: t('study.label'),
      href: href('/study'),
      icon: BookOpen,
      links: [
        {
          label: t('study.thematic'),
          href: href('/study?type=thematic'),
          description: t('study.thematicDescription'),
        },
        {
          label: t('study.labs'),
          href: href('/study?type=lab'),
          description: t('study.labsDescription'),
        },
        {
          label: t('study.workshops'),
          href: href('/study?type=workshop'),
          description: t('study.workshopsDescription'),
        },
      ],
      feature: {
        title: t('study.featureTitle'),
        description: t('study.featureDescription'),
        href: href('/study/bridge'),
        image: { src: '/assets/images/cilas-classroom.jpg', alt: t('study.featureImageAlt') },
      },
    },
    {
      value: 'people',
      label: t('people.label'),
      href: href('/people'),
      icon: Users,
      links: [
        {
          label: t('people.fellows'),
          href: href('/people/fellows'),
          description: t('people.fellowsDescription'),
        },
        {
          label: t('people.cilasians'),
          href: href('/people/cilasians'),
          description: t('people.cilasiansDescription'),
        },
        {
          label: t('people.governance'),
          href: href('/governance'),
          description: t('people.governanceDescription'),
        },
      ],
    },
    {
      value: 'articles',
      label: t('articles.label'),
      href: href('/articles'),
      icon: Newspaper,
      description: t('articles.description'),
    },
    {
      value: 'calendar',
      label: t('calendar.label'),
      href: href('/calendar'),
      icon: Calendar,
    },
  ]

  return (
    <SiteHeader
      ref={headerRef}
      brand={{
        name: t('brand'),
        href: href('/'),
        mark: (
          <Image
            alt="CILAS"
            height={20}
            src="/assets/images/logo.webp"
            style={{ width: 'auto' }}
            className="dark:invert"
            width={20}
          />
        ),
      }}
      items={items}
      label={t('label')}
      primaryAction={applyPath ? { label: t('apply'), href: href(applyPath) } : null}
      secondaryAction={{ label: t('signIn'), href: '/admin' }}
      utilities={
        <>
          {/* useSearchParams needs a Suspense boundary on static pages. */}
          <Suspense fallback={null}>
            <LanguageSwitch />
          </Suspense>
          <ThemeToggle />
        </>
      }
      variant="mega"
    />
  )
}
