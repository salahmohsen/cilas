'use client'

import { BRIDGE_PATH } from '@/lib/paths'
import { personAvatarSeed } from '@/lib/avatar'

import {
  BookOpen,
  Calendar,
  LayoutDashboard,
  MessagesSquare,
  Newspaper,
  Ticket,
  UserRound,
  Users,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { SiteHeader } from '@/components/arc/blocks/site-header/site-header'
import { CilasLogo } from '@/components/cilas-logo'
import { UserMenu, type UserMenuUser } from '@/components/arc/user-menu/user-menu'
import { LanguageSwitch, ThemeToggle } from '@/components/site-controls'
import { SiteNotifications } from '@/components/site-notifications'
import { announceAuthChange } from '@/lib/auth-events'
import { forgetThisDevice } from '@/lib/push/forget'
import { SiteSearch } from '@/components/site-search'
import { useSession } from '@/components/use-session'
import { useRouter } from '@/i18n/navigation'
import { ALL_ON, livePeoplePages, type PeoplePages } from '@/lib/people-pages'

export function CILASSiteHeader({ peoplePages = ALL_ON }: { peoplePages?: PeoplePages }) {
  const t = useTranslations('Header')
  const locale = useLocale()
  const router = useRouter()
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

  // The header is cached for everyone, so it asks who is signed in: a
  // signed-in account gets its account menu instead of "Sign in". The linked
  // person's name and photo are used; an account with no person shows its email.
  const session = useSession()
  const account: UserMenuUser | null = useMemo(() => {
    if (!session) return null
    const person = typeof session.person === 'object' ? session.person : null
    const photo = typeof person?.photo === 'object' ? person.photo : null
    return {
      name: person?.name || session.email,
      email: session.email,
      fallbackSeed: person
        ? personAvatarSeed(person.id)
        : typeof session.person === 'number'
          ? personAvatarSeed(session.person)
          : `account:${session.id}`,
      avatarSrc: photo?.sizes?.thumbnail?.url || photo?.url || undefined,
    }
  }, [session])
  // Spaces shows only to an account that can read one (see /api/spaces-nav).
  const [spaces, setSpaces] = useState(false)
  useEffect(() => {
    if (!session) {
      setSpaces(false)
      return
    }
    let live = true
    fetch('/api/spaces-nav', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((entry: { spaces?: boolean } | null) => {
        if (live) setSpaces(entry?.spaces === true)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [session])

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

  const people = livePeoplePages(peoplePages).map(({ key, path }) => ({
    value: key,
    label: t(`people.${key}`),
    href: href(path),
    description: t(`people.${key}Description`),
  }))

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
        {
          label: t('study.short'),
          href: href('/study?type=short'),
          description: t('study.shortDescription'),
        },
      ],
      feature: {
        title: t('study.featureTitle'),
        description: t('study.featureDescription'),
        href: href(BRIDGE_PATH),
        image: {
          src: '/assets/images/bridge-studio-drawing.webp',
          alt: t('study.featureImageAlt'),
        },
      },
    },
    // People opens a menu of the pages that are on; one page stands in for it.
    ...(people.length === 1
      ? [{ ...people[0], icon: Users }]
      : people.length
        ? [
            {
              value: 'people',
              label: t('people.label'),
              href: href('/people'),
              icon: Users,
              links: people,
            },
          ]
        : []),
    {
      value: 'articles',
      label: t('articles.label'),
      href: href('/articles'),
      icon: Newspaper,
      description: t('articles.description'),
    },
    // The header has the room, so events and the calendar are top-level items.
    {
      value: 'events',
      label: t('events.label'),
      href: href('/events'),
      icon: Ticket,
      description: t('events.description'),
    },
    {
      value: 'calendar',
      label: t('calendar.label'),
      href: href('/calendar'),
      icon: Calendar,
      description: t('calendar.description'),
    },
    ...(spaces
      ? [{ value: 'spaces', label: t('spaces.label'), href: href('/spaces'), icon: MessagesSquare }]
      : []),
  ]

  return (
    <SiteHeader
      ref={headerRef}
      className="site-header"
      brand={{
        name: t('brand'),
        href: href('/'),
        mark: <CilasLogo data-site-mark height={32} width={19} style={{ flexShrink: 0 }} />,
      }}
      items={items}
      label={t('label')}
      primaryAction={applyPath ? { label: t('apply'), href: href(applyPath) } : null}
      secondaryAction={account ? null : { label: t('signIn'), href: href('/login') }}
      utilities={
        <>
          <SiteSearch />
          {/* On narrow screens these two move into the menu sheet (sheetUtilities). */}
          <span className="site-wide-only">
            {/* useSearchParams needs a Suspense boundary on static pages. */}
            <Suspense fallback={null}>
              <LanguageSwitch />
            </Suspense>
            <ThemeToggle />
          </span>
          {/* Decisions on their work and new submissions, the same as in the admin. */}
          {account && <SiteNotifications />}
          {account && (
            <UserMenu
              user={account}
              // The header's own toggle sets the theme.
              showTheme={false}
              items={[
                {
                  label: t('settings'),
                  icon: <UserRound size={16} />,
                  onSelect: () => router.push('/settings'),
                },
                {
                  label: t('dashboard'),
                  icon: <LayoutDashboard size={16} />,
                  // The admin has its own root layout, so it needs a full load.
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                  onSelect: () => window.location.assign('/admin'),
                },
              ]}
              // Reload so nothing of the account stays on the page.
              onSignOut={() => {
                announceAuthChange()
                // This device stops getting the account's alerts (needs the session, so first).
                return forgetThisDevice()
                  .then(() =>
                    fetch('/api/users/logout', { method: 'POST', credentials: 'include' }),
                  )
                  .then(() => window.location.reload())
              }}
              labels={{ account: t('account'), signOut: t('signOut'), signingOut: t('signingOut') }}
            />
          )}
        </>
      }
      menuLabels={{ open: t('openMenu'), close: t('closeMenu') }}
      sheetUtilities={
        <>
          <Suspense fallback={null}>
            <LanguageSwitch full />
          </Suspense>
          <ThemeToggle full />
        </>
      }
      variant="mega"
    />
  )
}
