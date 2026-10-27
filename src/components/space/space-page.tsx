import { personAvatarSeed } from '@/lib/avatar'
import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { personOf } from '@/access'
import { Alert } from '@/components/arc/alert/alert'
import { Badge } from '@/components/arc/badge/badge'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs'
import type { Course, Programme, Space, User } from '@/payload-types'
import { linkTitles } from '@/lib/link-preview'
import { pageAddresses, threadTexts } from '@/lib/link-title'
import { introGates, mayComment, membership } from '@/lib/spaces'
import { CourseSyllabus, directionOf, textOf } from '@/components/course/course-syllabus'
import { RichTextField } from '@/components/RichTextField'
import { profileMessages } from '@/components/profile/load-messages'
import { readProfile } from '@/lib/profile'
import { StudyWithAI } from '@/components/study-with-ai'
import { cairoDay } from '@/lib/cairo-day'
import { nextSession } from '@/lib/schedule'
import {
  COMMUNITY_COVER,
  coverOf,
  coursePlace,
  memberState,
  participation,
  spaceEvents,
  spaceFeed,
  sessionCounts,
  spaceNotice,
} from '@/lib/spaces-data'
import { eventsAllow, postingAllows, visitRecord } from '@/lib/spaces-write'

import { AboutClamp } from './about-clamp'
import { Composer, type PostKind } from './composer'
import { sessionOptions } from './session-options'
import { EventList } from './event-list'
import { FeedFilter } from './feed-filter'
import { FeedRow, type FeedContext } from './feed-row'
import { FreshPosts } from './fresh-posts'
import { IntroLock } from './intro-lock'
import { LoadMore } from './load-more'
import { MembersPanel } from './members-panel'
import { PINNED_CARDS, PinnedCards, pinnedOrder } from './pinned-cards'
import { NextSession } from './next-session'
import { sessionContextOf } from './session-block'
import { CHECKLIST_COOKIE, OnboardingChecklist } from './onboarding-checklist'
import { SpaceHeadActions } from './space-head-actions'
import { spacePeopleCards } from './space-people'
import { SpaceRail } from './space-rail'
import { StickyRail } from './sticky-rail'
import styles from './space.module.css'

export type SpaceTab = 'all' | 'announcements' | 'syllabus' | 'events'

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
  /** A course session's id: only the posts that point at it. */
  session?: string | null
}

/**
 * Spec §2: the one space page both routes render. Every read happens first;
 * the visit stamp comes last and is awaited, so unread counts and the "new
 * since your last visit" line compare against the previous visit.
 */
export async function SpacePage({
  locale,
  user,
  landing,
  tab,
  shown,
  path,
  session = null,
}: SpacePageProps) {
  const { space } = landing
  const payload = await getPayload({ config })
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') notFound()
  const moderator = mem.role === 'moderator'
  // The intro post, while this member has not commented on it: the only post they read here.
  const gatedBy = (await introGates(payload, user)).get(space.id) ?? null

  const lang = locale === 'ar' ? 'ar' : 'en'
  const [
    t,
    tp,
    ts,
    feed,
    state,
    { cards, byId, moderators },
    numbers,
    jar,
    custom,
    events,
    place,
    rules,
  ] = await Promise.all([
    getTranslations('Spaces'),
    getTranslations('SpacePost'),
    getTranslations('Share'),
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
    tab === 'events'
      ? spaceEvents(payload, user, space, lang)
      : Promise.resolve({ upcoming: [], past: [] }),
    landing.course ? coursePlace(payload, user, landing.course, lang) : Promise.resolve(null),
    spaceNotice(payload, space.id, lang),
  ])
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
  const aboutBody = customAbout ? (
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
  const aboutText = customAbout || descriptionText || defaultAbout
  const about = aboutBody && <AboutClamp text={aboutText}>{aboutBody}</AboutClamp>
  const notice = rules.parts
  const viewerPerson = personOf(user)

  const memberMe = (viewerPerson != null && byId.get(viewerPerson)) || {
    name: user.email,
    photo: null,
  }
  const me = {
    name: memberMe.name,
    photo: memberMe.photo,
    fallbackSeed: viewerPerson != null ? personAvatarSeed(viewerPerson) : `account:${user.id}`,
  }
  // The same rules postCreate enforces, so the type switch never offers a closed door.
  const kinds = (['discussion', 'event', 'vote', 'announcement'] as const).filter(
    (k): k is PostKind =>
      gatedBy == null &&
      postingAllows(space.posting ?? 'open', mem.role, k) &&
      (k !== 'event' || eventsAllow(space.events, mem.role)),
  )
  // Any member may name one of the course's sessions with # or place it with /,
  // named as the syllabus numbers and dates it.
  const sessionChoices = landing.course ? await sessionOptions(landing.course, locale) : []
  const titles = await linkTitles(
    pageAddresses(feed.rows.flatMap((r) => threadTexts([r.post.body], r.comments))),
  )
  const context: FeedContext = {
    archived: feed.archived,
    viewer: { personId: viewerPerson, moderator, me },
    moderators,
    people: byId,
    cards,
    mayComment: mayComment(mem, space.posting ?? 'open'),
    consented: state.consented,
    notice,
    now: renderedAt,
    titles,
    sessions: sessionContextOf(feed.sessions),
    introPost:
      typeof space.introduction_post === 'object'
        ? (space.introduction_post?.id ?? null)
        : (space.introduction_post ?? null),
  }

  const course = landing.course
  const cover = coverOf(course ?? landing.programme)
  const announcements = feed.rows.filter((r) => r.post.kind === 'announcement')
  const view = tab === 'syllabus' && !course ? 'all' : tab
  // How many posts are about each session (linked, or named in the post or
  // its thread), from the rows the feed already read.
  const { named, counts: linked } = sessionCounts(feed.rows)
  const bySession = course && session ? session : null
  const listed = (view === 'announcements' && gatedBy == null ? announcements : feed.rows).filter(
    (r) => !bySession || named.get(r.post.id)?.has(bySession),
  )
  const lastVisit = state.lastVisitedAt
  // In the whole feed, pinned posts show as a row of cards, newest to this
  // member first; a moderator keeps one whole at the top with `pinned_full`,
  // and the intro post is always whole. Cards past the row's limit fall into
  // the feed by their activity. The announcements tab and a session's posts
  // list every post whole.
  const asCards = view === 'all' && !bySession && gatedBy == null
  const carded = asCards
    ? pinnedOrder(
        listed.filter(
          (r) => r.post.pinned && !r.post.pinned_full && r.post.id !== context.introPost,
        ),
        lastVisit,
        context.viewer.personId,
      )
    : []
  const pinCards = carded.slice(0, PINNED_CARDS)
  const spilled = carded.slice(PINNED_CARDS)
  const pinned = listed.filter((r) => r.post.pinned && !carded.includes(r))
  const unpinned = listed.filter((r) => !r.post.pinned)
  const activity = (r: (typeof listed)[number]) => r.post.last_activity_at ?? r.post.createdAt
  const rest = spilled.length
    ? [...spilled, ...unpinned].sort((a, b) => activity(b).localeCompare(activity(a)))
    : unpinned
  const feedTotal = listed.length - pinCards.length
  const visible = rest.slice(0, Math.max(BATCH, shown))
  // The divider sits above the first post the reader saw last time, and only
  // when something newer sits above it.
  const firstSeen = lastVisit ? visible.findIndex((r) => activity(r) <= lastVisit) : -1
  // The intro post has its own step.
  const pinnedPost =
    pinCards[0] ?? feed.rows.find((r) => r.post.pinned && r.post.id !== context.introPost)

  // Behind the gate: how many posts wait, for the lock under the intro post.
  const hiddenPosts =
    gatedBy != null
      ? (
          await payload.count({
            collection: 'space-posts',
            where: {
              and: [
                { space: { equals: space.id } },
                { deleted_at: { exists: false } },
                { id: { not_equals: gatedBy } },
              ],
            },
            overrideAccess: true,
          })
        ).totalDocs
      : 0

  // The profile step edits in a drawer, so its form is read while the checklist shows; ticking
  // the step must not take the open drawer away.
  const profileView =
    jar.get(CHECKLIST_COOKIE)?.value !== '1' ? await readProfile(payload, user) : null
  const profileStep = profileView
    ? {
        view: profileView,
        messages: await profileMessages(),
        title: (await getTranslations('Profile'))('title'),
      }
    : null

  await visitRecord({ payload, user, space: space.id })

  const rail = (
    <SpaceRail
      about={about}
      posting={space.posting ?? 'open'}
      notice={notice}
      digest={state.digest}
      place={place}
    />
  )
  // After the last session there is none to show.
  const next = course
    ? nextSession(course.schedule, course.sessions, cairoDay(new Date()) ?? '')
    : null
  const nextId = next?.session.id
  const nextCard = (titled: boolean) =>
    course && nextId ? (
      <NextSession
        course={course}
        session={nextId}
        tentative={Boolean(course.syllabus_tentative)}
        titled={titled}
      />
    ) : null

  const row = (r: (typeof listed)[number], position: number) => (
    <FeedRow
      row={r}
      position={position}
      total={feedTotal}
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
          {/* The title is the heading right below, so the trail names only where it leads back to. */}
          <nav aria-label={t('breadcrumb')} className={styles.headBack}>
            <Link href={`/${locale}/spaces`}>
              <ChevronLeft size={16} aria-hidden="true" className={styles.headBackIcon} />
              {t('title')}
            </Link>
          </nav>
          <div className={styles.titleBlock}>
            <div className={styles.titleRow}>
              <h1 className={styles.spaceTitle}>
                <bdi>{title}</bdi>
              </h1>
              <Badge tone={feed.archived ? 'neutral' : 'success'}>
                {feed.archived ? t('archived') : t('open')}
              </Badge>
            </div>
            <MembersPanel members={cards} viewerId={viewerPerson} />
          </div>
          <div className={styles.headActions}>
            <SpaceHeadActions
              coursePage={course ? `/${locale}/study/${course.slug}` : null}
              rail={rail}
              participation={numbers}
              now={renderedAt}
              settings={
                moderator
                  ? {
                      space: space.id,
                      posting: space.posting ?? 'open',
                      events: space.events ?? 'members',
                      archived: feed.archived,
                      about: custom,
                      aboutDefault: defaultAbout,
                      rules: rules.custom,
                      rulesDefault: rules.fallback,
                    }
                  : null
              }
            />
            {course && (
              <div className={styles.headAi}>
                <span>{ts('ai')}</span>
                <StudyWithAI kind="course" path={`/${locale}/study/${course.slug}`} size="sm" />
              </div>
            )}
          </div>
        </div>
      </header>
      <div className={styles.layout}>
        <main className={styles.feed} aria-label={title}>
          {course && nextId && <div className={styles.phoneBlock}>{nextCard(true)}</div>}
          <OnboardingChecklist
            space={space.id}
            steps={{
              saw_privacy: state.consented,
              // Behind the gate the step is the intro comment itself.
              introduced:
                context.introPost != null && !moderator
                  ? gatedBy == null
                  : (state.steps?.introduced ?? false),
              read_pinned: state.steps?.read_pinned ?? false,
              checked_profile: state.steps?.checked_profile ?? false,
              chose_digest: state.digest != null || (state.steps?.chose_digest ?? false),
            }}
            pinnedId={pinnedPost?.post.id ?? null}
            introPost={context.introPost}
            gated={gatedBy != null}
            profileHref={`/${locale}/profile`}
            profile={profileStep}
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
              sessions={sessionChoices}
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
                { value: 'events', label: t('events') },
              ]}
            />
          </div>
          {view === 'syllabus' && course ? (
            course.sessions?.length ? (
              <CourseSyllabus
                course={course}
                decorate={(entry) => {
                  const count = linked.get(entry.id) ?? 0
                  if (!count) return entry
                  return {
                    ...entry,
                    meta: {
                      ...entry.meta,
                      extra: [...(entry.meta?.extra ?? []), t('sessionPostCount', { count })],
                    },
                    body: (
                      <>
                        {entry.body}
                        <a
                          className={styles.sessionPosts}
                          href={`${path}?${new URLSearchParams({ session: entry.id })}`}
                        >
                          {t('sessionPostsSee', { count })}
                        </a>
                      </>
                    ),
                  }
                }}
              />
            ) : (
              <EmptyState title={t('noSyllabus')} description={t('noSyllabusHint')} />
            )
          ) : view === 'events' ? (
            <EventList
              upcoming={events.upcoming}
              past={events.past}
              context={context}
              path={path}
            />
          ) : (
            <>
              <FreshPosts space={space.id} since={renderedAt} />
              {bySession && (
                <Alert
                  tone="info"
                  title={t('sessionFilterTitle', {
                    name: sessionChoices.find((c) => c.id === bySession)?.label ?? '',
                  })}
                >
                  <a className={styles.sessionPosts} href={path}>
                    {t('sessionFilterClear')}
                  </a>
                </Alert>
              )}
              {listed.length === 0 ? (
                <EmptyState
                  title={view === 'announcements' ? t('noAnnouncements') : tp('empty')}
                  description={
                    view === 'announcements' ? t('noAnnouncementsHint') : tp('emptyHint')
                  }
                />
              ) : (
                <>
                  {pinCards.length > 0 && (
                    <PinnedCards
                      rows={pinCards}
                      context={context}
                      path={path}
                      lastVisit={lastVisit}
                      seeAll={
                        spilled.some((r) => r.post.kind === 'announcement')
                          ? `${path}?${new URLSearchParams({ tab: 'announcements' })}`
                          : null
                      }
                    />
                  )}
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
                </>
              )}
              {gatedBy != null && <IntroLock post={gatedBy} hidden={hiddenPosts} />}
              {rest.length > visible.length && (
                <LoadMore
                  href={`${path}?${new URLSearchParams({
                    ...(view === 'announcements' ? { tab: view } : {}),
                    ...(bySession ? { session: bySession } : {}),
                    shown: String(visible.length + BATCH),
                  })}`}
                  label={t('loadMore')}
                  status={t('showing', {
                    shown: pinCards.length + pinned.length + visible.length,
                    total: listed.length,
                  })}
                />
              )}
            </>
          )}
        </main>
        <StickyRail className={styles.rail} label={t('aboutSpace')}>
          {/* Two tabs keep the rail short enough to stay in view; without a next session there is only the space. */}
          {course && nextId ? (
            <Tabs defaultValue="session">
              <TabsList aria-label={t('aboutSpace')}>
                <TabsTrigger value="session">{t('nextSession')}</TabsTrigger>
                <TabsTrigger value="space">{t('about')}</TabsTrigger>
              </TabsList>
              <TabsContent value="session" className={styles.railPanel}>
                {nextCard(false)}
              </TabsContent>
              <TabsContent value="space" className={styles.railPanel}>
                {rail}
              </TabsContent>
            </Tabs>
          ) : (
            rail
          )}
        </StickyRail>
      </div>
    </div>
  )
}
