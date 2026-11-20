import config from '@payload-config'
import { getLocale, getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'
import React from 'react'

import { getPeoplePages } from '@/api/people-pages.api'
import { getCurrentPlace } from '@/api/place.api'
import { getSocialLinks } from '@/api/social.api'
import { Schema } from '@/components/schema'
import { SiteDeadlines } from '@/components/site-deadlines'
import { SiteFooter } from '@/components/site-footer'
import { CILASSiteHeader } from '@/components/site-header'
import { localeOf } from '@/i18n/routing'
import { newsletterList } from '@/lib/newsletter-list'
import { organizationSchema, websiteSchema } from '@/lib/schema'

/** The public chrome: deadlines bar, header, the page column, footer and the JSON-LD that names the site. */
export async function SiteFrame({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const [t, socials, place, list, peoplePages] = await Promise.all([
    getTranslations('Meta'),
    getSocialLinks(),
    getCurrentPlace(localeOf(locale)),
    // The footer's signup shows only when there is a list to join.
    getPayload({ config }).then((payload) => newsletterList(payload)),
    getPeoplePages(),
  ])

  return (
    <>
      {/* Search engines read this, not people: the institute and the site. */}
      <Schema
        data={[
          organizationSchema({
            siteName: t('siteName'),
            description: t('description'),
            location: place ? { address: place.address, mapUrl: place.mapUrl } : undefined,
            sameAs: socials.map((s) => s.url),
          }),
          websiteSchema({ siteName: t('siteName'), locale }),
        ]}
      />
      {/* Open deadlines, across the whole width, above the header. */}
      <SiteDeadlines locale={locale as 'en' | 'ar'} />
      <CILASSiteHeader peoplePages={peoplePages} />
      <main className="mx-auto min-h-[60vh] max-w-page">{children}</main>
      {/* The same width as the page content. */}
      <div className="mx-auto max-w-page">
        <SiteFooter
          peoplePages={peoplePages}
          newsletter={Boolean(list)}
          place={place}
          socials={socials}
        />
      </div>
    </>
  )
}
