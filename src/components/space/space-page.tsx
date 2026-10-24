import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { PageHeader } from '@/components/arc/page-header/page-header'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import type { Course, Programme, Space, User } from '@/payload-types'
import { NOTICE } from '@/lib/space-consent'
import { membership } from '@/lib/spaces'
import { memberState, participation, spaceFeed } from '@/lib/spaces-data'
import { spaceRoster, visitRecord } from '@/lib/spaces-write'

import { Composer } from './composer'
import { ConsentSheet } from './consent-sheet'
import { FeedRow } from './feed-row'
import { LiveRefresh } from './live-refresh'
import { OnboardingChecklist } from './onboarding-checklist'
import { ParticipationSummary } from './participation-summary'
import { SpaceSettings } from './space-settings'
import styles from './space.module.css'

export type SpaceTab = 'all' | 'announcements'

type SpacePageProps = {
  locale: string
  user: User
  landing: { space: Space; course?: Course; programme?: Programme }
  tab: SpaceTab
  /** The page's own route, so the tabs link back to it. */
  path: string
}

/**
 * Spec §2: the one space page both routes render. Every read happens first;
 * the visit stamp comes last and is awaited, so the unread counts compare
 * against the previous visit and a restart never drops the write.
 */
export async function SpacePage({ locale, user, landing, tab, path }: SpacePageProps) {
  const { space } = landing
  const payload = await getPayload({ config })
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') notFound()
  const moderator = mem.role === 'moderator'

  const [t, tp, feed, state, roster, numbers] = await Promise.all([
    getTranslations('Spaces'),
    getTranslations('SpacePost'),
    spaceFeed(payload, user, space),
    memberState(payload, user, space.id),
    spaceRoster({ payload, user, space: space.id }),
    moderator ? participation(payload, space) : Promise.resolve(null),
  ])

  const title =
    landing.course?.title ??
    landing.programme?.title ??
    (space.kind === 'community' ? t('community') : t(space.kind))
  const announcements = feed.rows.filter((r) => r.post.kind === 'announcement')
  const rows = tab === 'announcements' ? announcements : feed.rows
  const pinned = feed.rows.find((r) => r.post.pinned)
  const members = roster.ok
    ? roster.data.members.map((m) => ({ name: m.name, src: m.photo?.url ?? null }))
    : []

  await visitRecord({ payload, user, space: space.id })

  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumb={[{ label: t('title'), href: `/${locale}/spaces` }, { label: title }]}
        title={title}
        badge={
          feed.archived
            ? { text: t('archived'), tone: 'muted' }
            : { text: t('open'), tone: 'success' }
        }
        members={members}
        membersLabel={t('membersLabel')}
        tabs={[
          { key: path, label: t('all'), count: feed.rows.length },
          {
            key: `${path}?tab=announcements`,
            label: t('announcements'),
            count: announcements.length,
          },
        ]}
        activeTab={tab === 'announcements' ? `${path}?tab=announcements` : path}
        tabsLabel={t('tabsLabel')}
        actions={
          moderator ? (
            <SpaceSettings
              space={space.id}
              posting={space.posting ?? 'open'}
              archived={feed.archived}
            />
          ) : undefined
        }
      />
      <LiveRefresh />
      <OnboardingChecklist
        space={space.id}
        steps={{
          saw_privacy: state.consented,
          introduced: state.steps?.introduced ?? false,
          read_pinned: state.steps?.read_pinned ?? false,
          checked_profile: state.steps?.checked_profile ?? false,
          chose_digest: state.digest != null,
        }}
        digest={state.digest}
        pinnedId={pinned?.post.id ?? null}
        profileHref={`/${locale}/profile`}
      />
      {state.consented ? (
        <Composer space={space.id} moderator={moderator} archived={feed.archived} />
      ) : (
        <ConsentSheet notice={NOTICE[locale === 'ar' ? 'ar' : 'en']} />
      )}
      {rows.length === 0 ? (
        <EmptyState title={tp('empty')} description={tp('emptyHint')} />
      ) : (
        <div className={styles.column}>
          {rows.map((row) => (
            <FeedRow key={row.post.id} row={row} archived={feed.archived} />
          ))}
        </div>
      )}
      {numbers && <ParticipationSummary rows={numbers} />}
    </div>
  )
}
