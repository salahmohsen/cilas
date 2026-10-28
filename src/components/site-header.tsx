'use client'

import { personAvatarSeed } from '@/lib/avatar'

import {
  BookOpen,
  Calendar,
  LayoutDashboard,
  MessagesSquare,
  Newspaper,
  UserRound,
  Users,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { Suspense, useEffect, useRef, useState } from 'react'

import { SiteHeader } from '@/components/arc/blocks/site-header/site-header'
import { UserMenu, type UserMenuUser } from '@/components/arc/user-menu/user-menu'
import { LanguageSwitch, ThemeToggle } from '@/components/site-controls'
import { SiteNotifications } from '@/components/site-notifications'
import { SiteSearch } from '@/components/site-search'
import { useRouter } from '@/i18n/navigation'
import { ALL_SHOWN, type Navigation } from '@/lib/navigation'

/** The site's main navigation, in the site language, with links under it. */
export function CILASSiteHeader({ nav = ALL_SHOWN }: { nav?: Navigation }) {
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
  // signed-in account gets its account menu instead of "Sign in". Depth 2
  // brings the linked person's name and photo; an account with no person shows its email.
  const [account, setAccount] = useState<UserMenuUser | null>(null)
  const [spaces, setSpaces] = useState(false)
  useEffect(() => {
    let live = true
    fetch('/api/users/me?depth=2', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          body: {
            user?: {
              id: number
              email: string
              person?:
                | {
                    id: number
                    name?: string
                    photo?:
                      | { url?: string | null; sizes?: { thumbnail?: { url?: string | null } } }
                      | number
                      | null
                  }
                | number
                | null
            } | null
          } | null,
        ) => {
          const user = body?.user
          if (!live || !user) return
          const person = typeof user.person === 'object' ? user.person : null
          const photo = typeof person?.photo === 'object' ? person.photo : null
          setAccount({
            name: person?.name || user.email,
            email: user.email,
            fallbackSeed: person
              ? personAvatarSeed(person.id)
              : typeof user.person === 'number'
                ? personAvatarSeed(user.person)
                : `account:${user.id}`,
            avatarSrc: photo?.sizes?.thumbnail?.url || photo?.url || undefined,
          })
          // Spaces shows only to an account that can read one (see /api/spaces-nav).
          return fetch('/api/spaces-nav', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : null))
            .then((entry: { spaces?: boolean } | null) => {
              if (live) setSpaces(entry?.spaces === true)
            })
        },
      )
      .catch(() => {})
    return () => {
      live = false
    }
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
        ...(nav.thematic
          ? [
              {
                label: t('study.thematic'),
                href: href('/study?type=thematic'),
                description: t('study.thematicDescription'),
              },
            ]
          : []),
        ...(nav.labs
          ? [
              {
                label: t('study.labs'),
                href: href('/study?type=lab'),
                description: t('study.labsDescription'),
              },
            ]
          : []),
        ...(nav.workshops
          ? [
              {
                label: t('study.workshops'),
                href: href('/study?type=workshop'),
                description: t('study.workshopsDescription'),
              },
            ]
          : []),
        ...(nav.short
          ? [
              {
                label: t('study.short'),
                href: href('/study?type=short'),
                description: t('study.shortDescription'),
              },
            ]
          : []),
      ],
      feature: nav.bridge
        ? {
            title: t('study.featureTitle'),
            description: t('study.featureDescription'),
            href: href('/study/bridge'),
            image: { src: '/assets/images/cilas-classroom.jpg', alt: t('study.featureImageAlt') },
          }
        : undefined,
    },
    {
      value: 'people',
      label: t('people.label'),
      href: href('/people'),
      icon: Users,
      links: [
        ...(nav.fellows
          ? [
              {
                label: t('people.fellows'),
                href: href('/people/fellows'),
                description: t('people.fellowsDescription'),
              },
            ]
          : []),
        ...(nav.cilasians
          ? [
              {
                label: t('people.cilasians'),
                href: href('/people/cilasians'),
                description: t('people.cilasiansDescription'),
              },
            ]
          : []),
        ...(nav.governance
          ? [
              {
                label: t('people.governance'),
                href: href('/governance'),
                description: t('people.governanceDescription'),
              },
            ]
          : []),
      ],
    },
    ...(nav.articles
      ? [
          {
            value: 'articles',
            label: t('articles.label'),
            href: href('/articles'),
            icon: Newspaper,
            description: t('articles.description'),
          },
        ]
      : []),
    ...(nav.events || nav.calendar
      ? [
          {
            value: 'whatsOn',
            label: t('whatsOn'),
            href: href(nav.events ? '/events' : '/calendar'),
            icon: Calendar,
            links: [
              ...(nav.events
                ? [
                    {
                      label: t('events.label'),
                      href: href('/events'),
                      description: t('events.description'),
                    },
                  ]
                : []),
              ...(nav.calendar
                ? [
                    {
                      label: t('calendar.label'),
                      href: href('/calendar'),
                      description: t('calendar.description'),
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
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
                  label: t('profile'),
                  icon: <UserRound size={16} />,
                  onSelect: () => router.push('/profile'),
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
              onSignOut={() =>
                fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).then(() =>
                  window.location.reload(),
                )
              }
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
