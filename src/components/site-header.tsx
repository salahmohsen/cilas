'use client'

import { BookOpen, Calendar, Newspaper, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { Suspense } from 'react'

import { SiteHeader } from '@/components/arc/blocks/site-header/site-header'
import { LanguageSwitch, ThemeMenu } from '@/components/site-controls'

/** The site's main navigation, in the site language, with links under it. */
export function CILASSiteHeader() {
  const t = useTranslations('Header')
  const locale = useLocale()
  // Arc's header renders plain anchors, so each href carries the language.
  const href = (path: string) => `/${locale}${path === '/' ? '' : path}`

  const items = [
    {
      value: 'study',
      label: t('study.label'),
      href: href('/study'),
      icon: BookOpen,
      links: [
        { label: t('study.thematic'), href: href('/study/thematic'), description: t('study.thematicDescription') },
        { label: t('study.labs'), href: href('/study/labs'), description: t('study.labsDescription') },
        { label: t('study.workshops'), href: href('/study/workshops'), description: t('study.workshopsDescription') },
      ],
      feature: {
        title: t('study.featureTitle'),
        description: t('study.featureDescription'),
        href: href('/study'),
        image: { src: '/assets/images/cilas-classroom.jpg', alt: t('study.featureImageAlt') },
      },
    },
    {
      value: 'people',
      label: t('people.label'),
      href: href('/people'),
      icon: Users,
      links: [
        { label: t('people.fellows'), href: href('/people/fellows'), description: t('people.fellowsDescription') },
        { label: t('people.cilasians'), href: href('/people/cilasians'), description: t('people.cilasiansDescription') },
        { label: t('people.governance'), href: href('/governance'), description: t('people.governanceDescription') },
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
      brand={{
        name: t('brand'),
        href: href('/'),
        mark: <Image alt="CILAS" height={25} src="/assets/images/logo.webp" width={25} />,
      }}
      items={items}
      label={t('label')}
      primaryAction={{ label: t('apply'), href: href('/study/bridge/apply') }}
      secondaryAction={{ label: t('signIn'), href: '/admin' }}
      utilities={
        <>
          {/* useSearchParams needs a Suspense boundary on static pages. */}
          <Suspense fallback={null}>
            <LanguageSwitch />
          </Suspense>
          <ThemeMenu />
        </>
      }
      variant="mega"
    />
  )
}
