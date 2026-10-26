import config from '@payload-config'
import { getFormatter, getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import Image from 'next/image'

import { personOf } from '@/access'
import { Alert } from '@/components/arc/alert/alert'
import { Badge } from '@/components/arc/badge/badge'
import { Breadcrumb } from '@/components/arc/breadcrumb/breadcrumb'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs'
import type { Course, Programme, Space, User } from '@/payload-types'
import { linkTitles } from '@/lib/link-preview'
import { pageAddresses, threadTexts } from '@/lib/link-title'
import { NOTICE } from '@/lib/space-consent'
import { mayComment, membership } from '@/lib/spaces'
import { CourseSyllabus, directionOf, textOf } from '@/components/course/course-syllabus'
import { RichTextField } from '@/components/RichTextField'
import { StudyWithAI } from '@/components/study-with-ai'
import { numberingSystemOf } from '@/lib/digits'
import { cairoDay } from '@/lib/cairo-day'
import { expandSchedule, nextSession, sessionsInOrder } from '@/lib/schedule'
import {
  COMMUNITY_COVER,
  coverOf,
  coursePlace,
  memberState,
  participation,
  spaceEvents,
  spaceFeed,
  sessionCounts,
} from '@/lib/spaces-data'
import { eventsAllow, postingAllows, visitRecord } from '@/lib/spaces-write'

import { AboutClamp } from './about-clamp'
import { Composer, type PostKind, type SessionChoice } from './composer'
import { EventList } from './event-list'
import { FeedFilter } from './feed-filter'
import { FeedRow, type FeedContext } from './feed-row'
import { FreshPosts } from './fresh-posts'
import { LoadMore } from './load-more'
import { MembersPanel } from './members-panel'
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

  const lang = locale === 'ar' ? 'ar' : 'en'
  const [t, tp, ts, feed, state, { cards, byId, moderators }, numbers, jar, custom, events, place] =
    await Promise.all([
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
  // Any member may name one of the course's sessions with # or place it with /,
  // named as the syllabus numbers and dates it.
  const sessionChoices = landing.course ? await sessionOptions(landing.course, locale) : []
  const titles = await linkTitles(
    pageAddresses(feed.rows.flatMap((r) => threadTexts([r.post.body], r.comments))),
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
    titles,
    sessions: sessionContextOf(feed.sessions),
  }

  const course = landing.course
  const cover = coverOf(course ?? landing.programme)
  const announcements = feed.rows.filter((r) => r.post.kind === 'announcement')
  const view = tab === 'syllabus' && !course ? 'all' : tab
  // How many posts are about each session (linked, or named in the post or
  // its thread), from the rows the feed already read.
  const { named, counts: linked } = sessionCounts(feed.rows)
  const bySession = course && session ? session : null
  const listed = (view === 'announcements' ? announcements : feed.rows).filter(
    (r) => !bySession || named.get(r.post.id)?.has(bySession),
  )
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
                    ...(bySession ? { session: bySession } : {}),
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

/** "Session 2: Title · Mon 4 May": one choice per session, in the syllabus's order. */
async function sessionOptions(course: Course, locale: string): Promise<SessionChoice[]> {
  const [t, format] = await Promise.all([getTranslations('Course'), getFormatter()])
  const meetings = expandSchedule(course.schedule, course.sessions)
  return sessionsInOrder(course.sessions ?? []).flatMap((session, i) => {
    if (!session.id) return []
    const n = i + 1
    const unit =
      course.session_unit === 'week' ? t('week', { number: n }) : t('session', { number: n })
    const own = meetings.filter((m) => m.session === n)
    const day = (own.find((m) => !m.cancelled) ?? own[0])?.date
    const when = day
      ? format.dateTime(new Date(`${day}T00:00:00Z`), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
          numberingSystem: numberingSystemOf(locale),
        })
      : null
    const name = session.session_title ? `${unit}: ${session.session_title}` : unit
    return [
      {
        id: session.id,
        label: name,
        mention: `#${n}${session.session_title ? ` ${session.session_title}` : ''}`,
        hint: [when, session.cancelled ? t('cancelled') : null].filter(Boolean).join(' · '),
      },
    ]
  })
}
