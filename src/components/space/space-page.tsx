import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { Info, Users } from 'lucide-react'
import Image from 'next/image'

import { personOf } from '@/access'
import { Badge } from '@/components/arc/badge/badge'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Button } from '@/components/arc/button/button'
import { Breadcrumb } from '@/components/arc/breadcrumb/breadcrumb'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import type { Course, Programme, Space, User } from '@/payload-types'
import { NOTICE } from '@/lib/space-consent'
import { mayComment, membership } from '@/lib/spaces'
import { CourseSyllabus, directionOf, textOf } from '@/components/course/course-syllabus'
import { RichTextField } from '@/components/RichTextField'
import { COMMUNITY_COVER, coverOf, memberState, participation, spaceFeed } from '@/lib/spaces-data'
import { eventsAllow, postingAllows, visitRecord } from '@/lib/spaces-write'

import { Composer, type PostKind } from './composer'
import { FeedFilter } from './feed-filter'
import { FeedRow, type FeedContext } from './feed-row'
import { FreshPosts } from './fresh-posts'
import { LoadMore } from './load-more'
import { OpenCourseButton } from './open-course-button'
import { CHECKLIST_COOKIE, OnboardingChecklist } from './onboarding-checklist'
import { spacePeopleCards } from './space-people'
import { SpaceRail } from './space-rail'
import { SpaceSettings } from './space-settings'
import styles from './space.module.css'

export type SpaceTab = 'all' | 'announcements' | 'syllabus'

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

  const lang = locale === 'ar' ? 'ar' : 'en'
  const [t, tp, feed, state, { cards, byId, moderators }, numbers, jar, custom] = await Promise.all(
    [
      getTranslations('Spaces'),
      getTranslations('SpacePost'),
      spaceFeed(payload, user, space, lang),
      memberState(payload, user, space.id),
      spacePeopleCards(payload, user, space, locale),
      moderator ? participation(payload, space) : Promise.resolve(null),
      cookies(),
      // Each language keeps its own text, so an empty one shows the default, not the other language's.
      payload
        .findByID({
          collection: 'spaces',
          id: space.id,
          user,
          depth: 0,
          locale: lang,
          fallbackLocale: false,
          overrideAccess: false,
          select: { about: true },
        })
        .then((row) => row.about ?? '')
        .catch(() => ''),
    ],
  )
  const renderedAt = new Date().toISOString()

  const title =
    landing.course?.title ??
    landing.programme?.title ??
    (space.kind === 'community' ? space.name?.trim() || t('community') : t(space.kind))
  const description = landing.course?.description
  // The course's own text, flattened for the settings placeholder.
  const descriptionText = textOf(description).replace(/\s+/g, ' ').trim()
  const defaultAbout =
    descriptionText ||
    landing.course?.summary ||
    landing.programme?.tagline ||
    (space.kind === 'community'
      ? t(
          space.audience === 'fellows'
            ? 'communityAboutFellows'
            : space.audience === 'admins'
              ? 'communityAboutAdmins'
              : 'communityAbout',
        )
      : '')
  const customAbout = custom.trim()
  // A moderator's text wins; without one a course shows its description, with links, bold, italic and lists only.
  const about = customAbout ? (
    <p dir="auto" className={`${styles.prose} ${styles.aboutText}`}>
      {customAbout}
    </p>
  ) : descriptionText ? (
    <div dir={directionOf(descriptionText)} className={`${styles.prose} ${styles.richAbout}`}>
      <RichTextField plain data={description} className={styles.richAboutBody} />
    </div>
  ) : defaultAbout ? (
    <p dir="auto" className={`${styles.prose} ${styles.aboutText}`}>
      {defaultAbout}
    </p>
  ) : null
  const notice = NOTICE[locale === 'ar' ? 'ar' : 'en']
  const viewerPerson = personOf(user)

  const me = (viewerPerson != null && byId.get(viewerPerson)) || {
    name: user.email,
    photo: null,
  }
  // The same rules postCreate enforces, so the type switch never offers a closed door.
  const kinds = (['discussion', 'event', 'vote', 'announcement'] as const).filter(
    (k): k is PostKind =>
      postingAllows(space.posting ?? 'open', mem.role, k) &&
      (k !== 'event' || eventsAllow(space.events, mem.role)),
  )
  const context: FeedContext = {
    archived: feed.archived,
    viewer: { personId: viewerPerson, moderator, me: { name: me.name, photo: me.photo } },
    moderators,
    people: byId,
    cards,
    mayComment: mayComment(mem, space.posting ?? 'open'),
    consented: state.consented,
    notice,
    now: renderedAt,
  }

  const course = landing.course
  const cover = coverOf(course ?? landing.programme)
  const announcements = feed.rows.filter((r) => r.post.kind === 'announcement')
  const view = tab === 'syllabus' && !course ? 'all' : tab
  const listed = view === 'announcements' ? announcements : feed.rows
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
      members={cards}
      viewerId={viewerPerson}
      now={renderedAt}
      participation={numbers}
    />
  )

  const row = (r: (typeof listed)[number], position: number) => (
    <FeedRow
      row={r}
      position={position}
      total={listed.length}
      context={context}
      postHref={`${path}/posts/${r.post.id}`}
    />
  )

  return (
    <div className={`${styles.page}`}>
      <header className={styles.spaceHead}>
        <Image
          src={cover ?? COMMUNITY_COVER}
          alt=""
          fill
          priority
          sizes="(min-width: 1280px) 1200px, 100vw"
          className={styles.headImage}
        />
        <div className={styles.headInner}>
          <Breadcrumb
            items={[{ label: t('title'), href: `/${locale}/spaces` }, { label: title }]}
          />
          <div className={styles.titleRow}>
            <h1 className={styles.spaceTitle}>
              <bdi>{title}</bdi>
            </h1>
            <Badge tone={feed.archived ? 'neutral' : 'success'}>
              {feed.archived ? t('archived') : t('open')}
            </Badge>
            <span className={styles.headMeta}>
              <Users size={16} aria-hidden="true" />
              {t('membersCount', { count: cards.length })}
            </span>
          </div>
          <div className={styles.headActions}>
            {course && (
              <OpenCourseButton href={`/${locale}/study/${course.slug}`} label={t('coursePage')} />
            )}
            <span className={styles.phoneOnly}>
              <BottomSheet
                title={t('about')}
                detents={[0.6, 0.92]}
                trigger={
                  <Button variant="secondary" size="sm">
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
                events={space.events ?? 'members'}
                archived={feed.archived}
                about={custom}
                aboutDefault={defaultAbout}
              />
            )}
          </div>
        </div>
      </header>
      <div className={styles.layout}>
        <main className={styles.feed} aria-label={title}>
          <OnboardingChecklist
            space={space.id}
            steps={{
              saw_privacy: state.consented,
              introduced: state.steps?.introduced ?? false,
              read_pinned: state.steps?.read_pinned ?? false,
              checked_profile: state.steps?.checked_profile ?? false,
              chose_digest: state.digest != null || (state.steps?.chose_digest ?? false),
            }}
            pinnedId={pinnedPost?.post.id ?? null}
            profileHref={`/${locale}/profile`}
            hidden={jar.get(CHECKLIST_COOKIE)?.value === '1'}
          />
          {view !== 'syllabus' && (
            <Composer
              space={space.id}
              kinds={kinds}
              archived={feed.archived}
              me={me}
              mentions={cards.map((c) => ({ id: c.id, name: c.name }))}
              consented={state.consented}
              notice={notice}
            />
          )}
          <div className={styles.feedBar}>
            <FeedFilter
              path={path}
              value={view}
              label={t('filterLabel')}
              options={[
                { value: 'all', label: t('all') },
                { value: 'announcements', label: t('announcements') },
                ...(course ? [{ value: 'syllabus', label: t('syllabus') }] : []),
              ]}
            />
          </div>
          {view === 'syllabus' && course ? (
            course.sessions?.length ? (
              <CourseSyllabus course={course} />
            ) : (
              <EmptyState title={t('noSyllabus')} description={t('noSyllabusHint')} />
            )
          ) : (
            <>
              <FreshPosts space={space.id} since={renderedAt} />
              {listed.length === 0 ? (
                <EmptyState
                  title={view === 'announcements' ? t('noAnnouncements') : tp('empty')}
                  description={
                    view === 'announcements' ? t('noAnnouncementsHint') : tp('emptyHint')
                  }
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
                    ...(view === 'announcements' ? { tab: view } : {}),
                    shown: String(visible.length + BATCH),
                  })}`}
                  label={t('loadMore')}
                  status={t('showing', {
                    shown: pinned.length + visible.length,
                    total: listed.length,
                  })}
                />
              )}
            </>
          )}
        </main>
        <aside className={styles.rail} aria-label={t('aboutSpace')}>
          {rail}
        </aside>
      </div>
    </div>
  )
}
