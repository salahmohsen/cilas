'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Heart } from 'lucide-react'
import Image from 'next/image'

import {
  siCreativecommons,
  siFacebook,
  siInstagram,
  siX,
  siYoutube,
  type SimpleIcon,
} from 'simple-icons'

import type { SocialLink } from '@/api/social.api'
import { SiteFooter as ArcSiteFooter } from '@/components/arc/blocks/site-footer/site-footer'

/** Each platform's mark and name; Twitter is X now. */
const PLATFORMS: Record<SocialLink['platform'], { icon: SimpleIcon; label: string }> = {
  facebook: { icon: siFacebook, label: 'Facebook' },
  twitter: { icon: siX, label: 'X' },
  youtube: { icon: siYoutube, label: 'YouTube' },
  instagram: { icon: siInstagram, label: 'Instagram' },
}

/** The site footer: where to go next, the newsletter, the social accounts and the licence line. */
export function SiteFooter({ socials = [] }: { socials?: SocialLink[] }) {
  const t = useTranslations('Footer')
  const brand = useTranslations('Header')
  const locale = useLocale()
  const href = (path: string) => `/${locale}${path}`

  return (
    <ArcSiteFooter
      brand={{
        name: brand('brand').replace('\n', ' '),
        href: href(''),
        mark: (
          <Image
            alt=""
            height={22}
            src="/assets/images/logo.webp"
            style={{ width: 'auto' }}
            className="dark:invert"
            width={22}
          />
        ),
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
      legal={[]}
      notice={
        <a
          className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
          href="https://creativecommons.org/licenses/"
          rel="license noopener"
          target="_blank"
        >
          <svg aria-hidden className="size-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d={siCreativecommons.path} />
          </svg>
          {t('license')}
        </a>
      }
      // Not translated: a signature, the same on every page.
      credit={
        <span dir="ltr" lang="en">
          Made with{' '}
          <Heart
            aria-label="love"
            className="inline-block size-3 -translate-y-px fill-current text-red-500"
            role="img"
          />{' '}
          by{' '}
          <a
            className="underline-offset-4 hover:underline"
            href="https://salahmohsen.com"
            rel="noopener"
            target="_blank"
          >
            Salah Mohsen
          </a>
        </span>
      }
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
          if (!res.ok)
            throw new Error((await res.json().catch(() => null))?.error ?? 'Subscribe failed')
        },
      }}
      // Icons only, from Site settings; the platform names their links.
      socials={socials.map(({ platform, url }) => ({
        label: PLATFORMS[platform].label,
        href: url,
        external: true,
        icon: (
          <svg aria-hidden fill="currentColor" viewBox="0 0 24 24">
            <path d={PLATFORMS[platform].icon.path} />
          </svg>
        ),
      }))}
      status={null}
      tagline={t('tagline')}
      variant="columns"
    />
  )
}
