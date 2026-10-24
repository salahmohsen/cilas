import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { Info } from 'lucide-react'

import { personOf } from '@/access'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Button } from '@/components/arc/button/button'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { PageHeader } from '@/components/arc/page-header/page-header'
import type { Course, Programme, Space, User } from '@/payload-types'
import { NOTICE } from '@/lib/space-consent'
import { membership } from '@/lib/spaces'
import { memberState, moderatorPeople, participation, spaceFeed } from '@/lib/spaces-data'
import { spaceRoster, visitRecord } from '@/lib/spaces-write'

import { Composer } from './composer'
import { FeedFilter } from './feed-filter'
import { FeedRow, type Person } from './feed-row'
import { FreshPosts } from './fresh-posts'
import { LoadMore } from './load-more'
import { CHECKLIST_COOKIE, OnboardingChecklist } from './onboarding-checklist'
import { SpaceRail, uniqueByName } from './space-rail'
import { SpaceSettings } from './space-settings'
import styles from './space.module.css'

export type SpaceTab = 'all' | 'announcements'

/** NN/g: "Load more" in batches, never an endless feed. */
const BATCH = 20

type SpacePageProps = {
  locale: string
  user: User
  landing: { space: Space; course?: Course; programme?: Programme }
  tab: SpaceTab
  /** How many posts the reader has loaded so far. */
  shown: number
  /** The page's own route, so the filter and the post links build on it. */
  path: string
}

/**
 * Spec §2: the one space page both routes render. Every read happens first;
 * the visit stamp comes last and is awaited, so unread counts and the "new
 * since your last visit" line compare against the previous visit.
 */
export async function SpacePage({ locale, user, landing, tab, shown, path }: SpacePageProps) {
  const { space } = landing
  const payload = await getPayload({ config })
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') notFound()
  const moderator = mem.role === 'moderator'

  const [t, tp, feed, state, roster, moderatorIds, numbers, jar] = await Promise.all([
    getTranslations('Spaces'),
    getTranslations('SpacePost'),
    spaceFeed(payload, user, space),
    memberState(payload, user, space.id),
    spaceRoster({ payload, user, space: space.id }),
    moderatorPeople(payload, space),
    moderator ? participation(payload, space) : Promise.resolve(null),
    cookies(),
  ])
  const renderedAt = new Date().toISOString()

  const title =
    landing.course?.title ??
    landing.programme?.title ??
    (space.kind === 'community' ? t('community') : t(space.kind))
  const about =
    landing.course?.summary ??
    landing.programme?.tagline ??
    (space.kind === 'community' ? t('communityAbout') : '')
  const notice = NOTICE[locale === 'ar' ? 'ar' : 'en']
  const viewerPerson = personOf(user)

  const members = roster.ok ? roster.data.members : []
  const people = new Map<number, Person>(
    members.map((m) => [m.personId, { name: m.name, photo: m.photo?.url ?? null }]),
  )
  const me = (viewerPerson != null && people.get(viewerPerson)) || {
    name: user.email,
    photo: null,
  }

  const announcements = feed.rows.filter((r) => r.post.kind === 'announcement')
  const listed = tab === 'announcements' ? announcements : feed.rows
  const pinned = listed.filter((r) => r.post.pinned)
  const rest = listed.filter((r) => !r.post.pinned)
  const visible = rest.slice(0, Math.max(BATCH, shown))
  // The divider sits above the first post the reader saw last time, and only
  // when something newer sits above it.
  const lastVisit = state.lastVisitedAt
  const firstSeen = lastVisit
    ? visible.findIndex((r) => (r.post.last_activity_at ?? r.post.createdAt) <= lastVisit)
    : -1
  const pinnedPost = feed.rows.find((r) => r.post.pinned)

  await visitRecord({ payload, user, space: space.id })

  const rail = (
    <SpaceRail
      about={about}
      posting={space.posting ?? 'open'}
      notice={notice}
      digest={state.digest}
      members={members.map((m) => ({
        personId: m.personId,
        name: m.name,
        photo: m.photo?.url ?? null,
        fellow: moderatorIds.has(m.personId),
      }))}
      participation={numbers}
    />
  )

  const row = (r: (typeof listed)[number], position: number) => (
    <FeedRow
      row={r}
      position={position}
      total={listed.length}
      archived={feed.archived}
      viewer={{ personId: viewerPerson, moderator }}
      moderators={moderatorIds}
      people={people}
      postHref={`${path}/posts/${r.post.id}`}
    />
  )

  return (
    <div className={`${styles.page} ${styles.wide}`}>
      <PageHeader
        breadcrumb={[{ label: t('title'), href: `/${locale}/spaces` }, { label: title }]}
        title={title}
        badge={
          feed.archived
            ? { text: t('archived'), tone: 'muted' }
            : { text: t('open'), tone: 'success' }
        }
        members={uniqueByName(members).map((m) => ({ name: m.name, src: m.photo?.url ?? null }))}
        membersLabel={t('membersLabel')}
        actions={
          <>
            <span className={styles.phoneOnly}>
              <BottomSheet
                title={t('about')}
                detents={[0.6, 0.92]}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Info size={16} aria-hidden="true" />
                    {t('about')}
                  </Button>
                }
              >
                <div className={styles.column}>{rail}</div>
              </BottomSheet>
            </span>
            {moderator && (
              <SpaceSettings
                space={space.id}
                posting={space.posting ?? 'open'}
                archived={feed.archived}
              />
            )}
          </>
        }
      />
      <div className={styles.layout}>
        <main className={styles.feed} aria-label={title}>
          <OnboardingChecklist
            space={space.id}
            steps={{
              saw_privacy: state.consented,
              introduced: state.steps?.introduced ?? false,
              read_pinned: state.steps?.read_pinned ?? false,
              checked_profile: state.steps?.checked_profile ?? false,
              chose_digest: state.digest != null,
            }}
            pinnedId={pinnedPost?.post.id ?? null}
            profileHref={`/${locale}/profile`}
            hidden={jar.get(CHECKLIST_COOKIE)?.value === '1'}
          />
          <Composer
            space={space.id}
            moderator={moderator}
            archived={feed.archived}
            me={me}
            mentions={members.map((m) => ({ id: m.personId, name: m.name }))}
            consented={state.consented}
            notice={notice}
          />
          <div className={styles.feedBar}>
            <FeedFilter
              path={path}
              value={tab}
              label={t('filterLabel')}
              options={[
                { value: 'all', label: t('all') },
                { value: 'announcements', label: t('announcements') },
              ]}
            />
          </div>
          <FreshPosts space={space.id} since={renderedAt} />
          {listed.length === 0 ? (
            <EmptyState
              title={tab === 'announcements' ? t('noAnnouncements') : tp('empty')}
              description={tab === 'announcements' ? t('noAnnouncementsHint') : tp('emptyHint')}
            />
          ) : (
            <div role="feed" aria-label={title} aria-busy={false} className={styles.column}>
              {pinned.map((r, i) => (
                <div key={r.post.id}>{row(r, i + 1)}</div>
              ))}
              {visible.map((r, i) => (
                <div key={r.post.id} className={styles.column}>
                  {i === firstSeen && i > 0 && (
                    <p className={styles.divider} role="separator">
                      {t('newSince')}
                    </p>
                  )}
                  {row(r, pinned.length + i + 1)}
                </div>
              ))}
            </div>
          )}
          {rest.length > visible.length && (
            <LoadMore
              href={`${path}?${new URLSearchParams({
                ...(tab === 'announcements' ? { tab } : {}),
                shown: String(visible.length + BATCH),
              })}`}
              label={t('loadMore')}
              status={t('showing', {
                shown: pinned.length + visible.length,
                total: listed.length,
              })}
            />
          )}
        </main>
        <aside className={styles.rail} aria-label={t('aboutSpace')}>
          {rail}
        </aside>
      </div>
    </div>
  )
}
