import { MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { getLocale, getTranslations } from 'next-intl/server'

import { Accordion } from '@/components/arc/accordion/accordion'
import type { NoticePart } from '@/lib/space-consent'
import type { CoursePlace } from '@/lib/spaces-data'

import { DigestForm } from './digest-form'
import { NoticeText } from './notice-text'
import styles from './space.module.css'

/**
 * The space's standing facts (spec §2, §9, §13): what it is for, how posting
 * works, privacy and the digest; where a course meets.
 */
export async function SpaceRail({
  about,
  posting,
  notice,
  digest,
  place = null,
}: {
  about: ReactNode
  posting: string
  notice: NoticePart[]
  digest: 'daily' | 'weekly' | 'off' | null
  /** Where an in-person course meets */
  place?: CoursePlace | null
}) {
  const [t, locale] = await Promise.all([getTranslations('Spaces'), getLocale()])
  return (
    <>
      <section className={styles.group}>
        <div className={styles.groupHead}>
          <h2 className={styles.sectionTitle}>{t('aboutSpace')}</h2>
        </div>
        <div className={styles.groupBody}>
          {about}
          <div className={styles.accordionFlush}>
            <Accordion
              defaultOpen={-1}
              items={[
                {
                  title: t('howPosting'),
                  content: <p className={styles.prose}>{t(`posting_${posting}`)}</p>,
                },
                { title: t('privacy'), content: <NoticeText notice={notice} /> },
                { title: t('emailDigest'), content: <DigestForm digest={digest} /> },
              ]}
            />
          </div>
        </div>
      </section>

      {place && (
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <h2 className={styles.sectionTitle}>{t('place')}</h2>
          </div>
          <div className={styles.groupBody}>
            {place.address && (
              <iframe
                className={styles.placeMap}
                src={`https://www.google.com/maps?${new URLSearchParams({ q: place.address, hl: locale, z: '16', output: 'embed' })}`}
                title={t('placeMap', { name: place.name })}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
            <div className={styles.placeText}>
              <p dir="auto" className={styles.placeName}>
                {place.name}
              </p>
              {place.address && (
                <p dir="auto" className={styles.placeAddress}>
                  {place.address}
                </p>
              )}
            </div>
            {/* The embedded map carries its own "Open in Maps" link. */}
            {!place.address && place.mapUrl && (
              <a
                className={styles.placeLink}
                href={place.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin size={16} aria-hidden="true" />
                {t('openInMaps')}
              </a>
            )}
          </div>
        </section>
      )}
    </>
  )
}
