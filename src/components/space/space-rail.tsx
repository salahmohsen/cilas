import { MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'

import { Accordion } from '@/components/arc/accordion/accordion'
import { Alert } from '@/components/arc/alert/alert'
import type { NoticePart } from '@/lib/space-consent'
import type { CoursePlace, Participation } from '@/lib/spaces-data'

import { DigestForm } from './digest-form'
import { MembersPanel } from './members-panel'
import { NoticeText } from './notice-text'
import { ParticipationDialog } from './participation-dialog'
import type { PersonCard } from './person-hover'
import styles from './space.module.css'

/**
 * The space's standing facts (spec §2, §9, §13): what it is for, how posting
 * works, privacy and the digest; who belongs; and, for moderators only, the
 * participation numbers.
 */
export async function SpaceRail({
  about,
  posting,
  notice,
  digest,
  members,
  viewerId,
  participation,
  now,
  warning = null,
  facilitator = null,
  place = null,
}: {
  about: ReactNode
  posting: string
  notice: NoticePart[]
  digest: 'daily' | 'weekly' | 'off' | null
  /** Fellows first, then by name. */
  members: PersonCard[]
  viewerId: number | null
  participation: Participation | null
  /** When the page rendered, so relative times read the same on server and client. */
  now: string
  /** The course's content warning, in the reader's language */
  warning?: string | null
  /** The course's note from the facilitator, in the reader's language */
  facilitator?: string | null
  /** Where an in-person course meets */
  place?: CoursePlace | null
}) {
  const [t, tp] = await Promise.all([getTranslations('Spaces'), getTranslations('Participation')])
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

      {(warning || facilitator) && (
        <div className={styles.railNotes}>
          {warning && (
            <Alert tone="warning" title={t('contentNote')}>
              <span dir="auto" className={styles.noteText}>
                {warning}
              </span>
            </Alert>
          )}
          {facilitator && (
            <Alert tone="info" title={t('facilitatorNote')}>
              <span dir="auto" className={styles.noteText}>
                {facilitator}
              </span>
            </Alert>
          )}
        </div>
      )}

      {place && (
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <h2 className={styles.sectionTitle}>{t('place')}</h2>
          </div>
          <div className={styles.groupBody}>
            <p dir="auto" className={styles.placeName}>
              {place.name}
            </p>
            {place.address && (
              <p dir="auto" className={styles.placeAddress}>
                {place.address}
              </p>
            )}
            {place.mapUrl && (
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

      <section className={styles.group}>
        <div className={styles.groupHead}>
          <h2 className={styles.sectionTitle}>{t('members')}</h2>
          <span className={`${styles.meta} ${styles.numeric}`}>
            {t('membersCount', { count: members.length })}
          </span>
        </div>
        <div className={styles.groupBody}>
          <MembersPanel members={members} viewerId={viewerId} />
        </div>
      </section>

      {participation && (
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <h2 className={styles.sectionTitle}>{tp('title')}</h2>
          </div>
          <div className={styles.groupBody}>
            <ParticipationDialog data={participation} now={now} />
          </div>
        </section>
      )}
    </>
  )
}
