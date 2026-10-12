'use client'

import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'

import { SiteFooter as ArcSiteFooter } from '@/components/arc/blocks/site-footer/site-footer'

/** The site footer: where to go next, the newsletter and the licence line. */
export function SiteFooter() {
  const t = useTranslations('Footer')
  const brand = useTranslations('Header')
  const locale = useLocale()
  const href = (path: string) => `/${locale}${path}`

  return (
    <ArcSiteFooter
      brand={{
        name: brand('brand').replace('\n', ' '),
        href: href(''),
        mark: <Image alt="" height={22} src="/assets/images/logo.webp" style={{ width: 'auto' }} width={22} />,
      }}
      columns={[
        {
          title: t('explore'),
          links: [
            { label: t('study'), href: href('/study') },
            { label: t('articles'), href: href('/articles') },
            { label: t('people'), href: href('/people') },
            { label: t('calendar'), href: href('/calendar') },
          ],
        },
        {
          title: t('institute'),
          links: [
            { label: t('about'), href: href('/about') },
            { label: t('spaces'), href: href('/spaces') },
            { label: t('contact'), href: href('/contact') },
          ],
        },
      ]}
      legal={[{ label: t('license') }]}
      newsletter={{
        title: t('newsletterTitle'),
        description: t('newsletterText'),
        placeholder: t('newsletter.placeholder'),
        labels: {
          subscribe: t('newsletter.subscribe'),
          subscribed: t('newsletter.subscribed'),
          empty: t('newsletter.empty'),
          invalid: t('newsletter.invalid'),
          failed: t('newsletter.failed'),
          done: t('newsletter.done'),
        },
        onSubscribe: async (email) => {
          const res = await fetch('/api/newsletter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          // The Arc form shows its error state when this throws.
          if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Subscribe failed')
        },
      }}
      // No social accounts or status page yet; Arc's samples would show otherwise.
      socials={[]}
      status={null}
      tagline={t('tagline')}
      variant="columns"
    />
  )
}
