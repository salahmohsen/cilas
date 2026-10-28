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

import type { Place } from '@/api/place.api'
import { ALL_SHOWN, type Navigation } from '@/lib/navigation'
import { subscribeToNewsletter } from '@/lib/newsletter-subscribe'
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
export function SiteFooter({
  socials = [],
  place = null,
  newsletter = true,
  nav = ALL_SHOWN,
}: {
  socials?: SocialLink[]
  place?: Place | null
  /** Whether signup is set up (a signup Mailing list and the Resend key); off, the form is left out. */
  newsletter?: boolean
  /** What the menus show (Site settings → Navigation). */
  nav?: Navigation
}) {
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
            ...(nav.articles ? [{ label: t('articles'), href: href('/articles') }] : []),
            { label: t('people'), href: href('/people') },
            ...(nav.events ? [{ label: t('events'), href: href('/events') }] : []),
            ...(nav.calendar ? [{ label: t('calendar'), href: href('/calendar') }] : []),
          ],
        },
        {
          title: t('institute'),
          links: [
            // The current place's address, linked to its map (Places → Google Maps link).
            ...(place?.mapUrl
              ? [{ label: place.address, href: place.mapUrl, external: true }]
              : []),
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
      newsletter={
        newsletter
          ? {
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
              onSubscribe: subscribeToNewsletter,
            }
          : null
      }
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
