import { getTranslations } from 'next-intl/server'

import { Accordion } from '@/components/arc/accordion/accordion'
import { Avatar } from '@/components/arc/avatar/avatar'
import { AvatarGroup } from '@/components/arc/avatar-group/avatar-group'
import { Badge } from '@/components/arc/badge/badge'
import { Button } from '@/components/arc/button/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/arc/drawer/drawer'
import { MetricCard } from '@/components/arc/metric-card/metric-card'
import type { ParticipationRow } from '@/lib/spaces-data'

import { DigestForm } from './digest-form'
import { ParticipationSummary } from './participation-summary'
import styles from './space.module.css'

/** Arc's avatar group keys by name, so two people sharing a name show once there. */
export const uniqueByName = <T extends { name: string }>(list: T[]): T[] => [
  ...new Map(list.map((m) => [m.name, m])).values(),
]

export type RailMember = { personId: number; name: string; photo: string | null; fellow: boolean }

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
  participation,
}: {
  about: string
  posting: string
  notice: string
  digest: 'daily' | 'weekly' | 'off' | null
  members: RailMember[]
  participation: ParticipationRow[] | null
}) {
  const [t, tp] = await Promise.all([getTranslations('Spaces'), getTranslations('Participation')])
  const ordered = [...members].sort(
    (a, b) => Number(b.fellow) - Number(a.fellow) || a.name.localeCompare(b.name),
  )
  return (
    <>
      <section className={styles.group}>
        <div className={styles.groupHead}>
          <h2 className={styles.sectionTitle}>{t('aboutSpace')}</h2>
        </div>
        <div className={styles.groupBody}>
          <p dir="auto" className={styles.prose}>
            {about}
          </p>
          <Accordion
            defaultOpen={-1}
            items={[
              {
                title: t('howPosting'),
                content: <p className={styles.prose}>{t(`posting_${posting}`)}</p>,
              },
              {
                title: t('privacy'),
                content: (
                  <p dir="auto" className={styles.prose}>
                    {notice}
                  </p>
                ),
              },
              { title: t('emailDigest'), content: <DigestForm digest={digest} /> },
            ]}
          />
        </div>
      </section>

      <section className={styles.group}>
        <div className={styles.groupHead}>
          <h2 className={styles.sectionTitle}>{t('members')}</h2>
          <span className={`${styles.meta} ${styles.numeric}`}>
            {t('membersCount', { count: members.length })}
          </span>
        </div>
        <div className={styles.groupBody}>
          <AvatarGroup
            members={uniqueByName(ordered).map((m) => ({
              name: m.name,
              src: m.photo ?? undefined,
            }))}
            max={8}
            label={t('membersLabel')}
          />
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="secondary" size="sm">
                {t('seeAllMembers')}
              </Button>
            </DrawerTrigger>
            <DrawerContent
              title={t('members')}
              description={t('membersCount', { count: members.length })}
            >
              <ul className={styles.memberList}>
                {ordered.map((m) => (
                  <li key={m.personId} className={styles.memberRow}>
                    <Avatar name={m.name} src={m.photo ?? undefined} size="sm" />
                    <bdi className={styles.rowTitle}>{m.name}</bdi>
                    {m.fellow && <Badge size="sm">{t('fellow')}</Badge>}
                  </li>
                ))}
              </ul>
            </DrawerContent>
          </Drawer>
        </div>
      </section>

      {participation && (
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <h2 className={styles.sectionTitle}>{tp('title')}</h2>
          </div>
          <div className={styles.groupBody}>
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="secondary" size="sm">
                  {t('viewParticipation')}
                </Button>
              </DrawerTrigger>
              <DrawerContent title={tp('title')} description={t('kpiContext')}>
                <div className={styles.column}>
                  <div className={styles.kpis}>
                    <MetricCard
                      label={t('members')}
                      value={members.length}
                      context={t('kpiContext')}
                    />
                    <MetricCard
                      label={t('neverVisited')}
                      value={participation.filter((r) => !r.lastVisit).length}
                      context={t('kpiContext')}
                    />
                    <MetricCard
                      label={tp('posts')}
                      value={participation.reduce((n, r) => n + r.posts, 0)}
                      context={t('kpiContext')}
                    />
                    <MetricCard
                      label={tp('comments')}
                      value={participation.reduce((n, r) => n + r.comments, 0)}
                      context={t('kpiContext')}
                    />
                  </div>
                  <ParticipationSummary rows={participation} />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </section>
      )}
    </>
  )
}
