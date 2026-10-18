import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { RichTextField } from '@/components/RichTextField'
import { ogImages } from '@/lib/og'
import { localDigits } from '@/lib/digits'
import type { About, Media, Space } from '@/payload-types'

type Props = { params: Promise<{ locale: string }> }

// Admins edit it in Site → About page; the page follows within the hour.
export const revalidate = 3600

const aboutIn = async (locale: string) =>
  (await (await getPayload({ config })).findGlobal({
    slug: 'about',
    depth: 1,
    locale: locale === 'ar' ? 'ar' : 'en',
    fallbackLocale: locale === 'ar' ? 'en' : 'ar',
  })) as About

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const about = await aboutIn(locale)
  const cover = about.cover && typeof about.cover === 'object' ? (about.cover as Media) : null
  return {
    title: about.title,
    description: about.intro ?? undefined,
    openGraph: { title: about.title, description: about.intro ?? undefined, images: ogImages(cover?.url ?? undefined) },
  }
}

/** The spaces, the current one first, from the Spaces collection. */
const spacesIn = async (locale: string) => {
  const { docs } = await (await getPayload({ config })).find({
    collection: 'spaces',
    depth: 1,
    limit: 20,
    locale: locale === 'ar' ? 'ar' : 'en',
    fallbackLocale: locale === 'ar' ? 'en' : 'ar',
    overrideAccess: false,
  })
  const rank = (s: Space) => (s.state === 'current' ? 0 : 1)
  return docs.sort((a, b) => rank(a) - rank(b) || (b.opened_year ?? 0) - (a.opened_year ?? 0))
}

/** What CILAS is: the About global, then the spaces it has taught in. */
export default async function AboutPage({ params }: Props) {
  const { locale } = await params
  const [about, spaces, t] = await Promise.all([aboutIn(locale), spacesIn(locale), getTranslations('About')])
  if (!about.title) notFound()
  const cover = about.cover && typeof about.cover === 'object' ? (about.cover as Media) : null
  const years = (space: Space) =>
    space.opened_year
      ? localDigits(`${space.opened_year}${space.closed_year ? `–${space.closed_year}` : ''}`, locale)
      : null

  return (
    <article className="about-page mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <header>
        <h1 className="course-title" dir="auto">
          {about.title}
        </h1>
        {about.intro ? (
          <p className="article-lead mt-5" dir="auto">
            {about.intro}
          </p>
        ) : null}
      </header>
      {cover?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={cover.alt ?? ''} className="course-cover mt-10" src={cover.url} />
      ) : null}
      {about.body ? <RichTextField className="article-prose mt-10" data={about.body} /> : null}

      {spaces.length ? (
        <section aria-labelledby="about-spaces" className="mt-14 border-t border-(--border-strong,var(--border)) pt-8">
          <h2 className="course-heading" id="about-spaces">
            {t('spaces')}
          </h2>
          <p className="mt-2 text-(--text-secondary)">{t('spacesText')}</p>
          <ul className="mt-8 grid gap-10">
            {spaces.map((space) => {
              const image = space.images?.find((i) => typeof i.image === 'object' && i.image?.url)?.image as
                | Media
                | undefined
              return (
                <li className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_1fr]" key={space.id}>
                  {image?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={image.alt ?? space.name} className="course-cover aspect-[4/3] w-full object-cover" src={image.url} />
                  ) : null}
                  <div className={image?.url ? '' : 'sm:col-span-2'}>
                    <p className="text-sm text-(--text-secondary)">
                      {[space.state === 'current' ? t('current') : t('former'), space.city, years(space)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <h3 className="mt-1 text-xl font-medium" dir="auto">
                      {space.name}
                    </h3>
                    {space.description ? (
                      <RichTextField className="article-prose mt-3" data={space.description} />
                    ) : null}
                    {space.address ? (
                      <p className="mt-3 text-sm" dir="auto">
                        {space.address}
                        {space.map_url ? (
                          <>
                            {' · '}
                            <a className="home-more" href={space.map_url} rel="noopener" target="_blank">
                              {t('map')}
                            </a>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </article>
  )
}
