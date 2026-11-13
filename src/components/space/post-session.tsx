import { detailPath } from '@/lib/paths'
import { useLocale, useTranslations } from 'next-intl'
import { MessagesSquare } from 'lucide-react'

import { Alert } from '@/components/arc/alert/alert'
import { Badge } from '@/components/arc/badge/badge'
import { CourseSession } from '@/components/course/course-syllabus'
import { StudyWithAI } from '@/components/study-with-ai'
import { AIInstructions } from '@/components/ai-instructions'
import { sessionsInOrder } from '@/lib/schedule'
import { SESSION_CARD_KINDS } from '@/lib/space-rules'
import type { SessionView } from '@/lib/spaces-data'

import { oldSyllabus } from './old-syllabus'
import styles from './space.module.css'

/**
 * The course session a post points at, as the syllabus shows it, from the
 * course's live data, with a way to discuss it with AI. A session the course
 * dropped, or a course the reader may not read, says so instead.
 */
export function PostSession({
  session,
  kind,
  postHref,
}: {
  session: SessionView
  kind: string
  postHref: string
}) {
  const t = useTranslations('SpacePost')
  const tc = useTranslations('Course')
  const ts = useTranslations('Share')
  const locale = useLocale()
  if (session.state === 'hidden') return <Alert tone="info" title={t('sessionHidden')} />
  if (session.state === 'gone') return <Alert tone="info" title={t('sessionGone')} />

  const { course } = session
  const sessions = sessionsInOrder(course.sessions ?? [])
  const at = sessions.findIndex((s) => s.id === session.session)
  const row = sessions[at]
  const unit = tc(course.session_unit === 'week' ? 'week' : 'session', { number: at + 1 })
  const name = row?.session_title ? `${unit}: ${row.session_title}` : unit

  // Only a moderator's announcement carries the whole session; a member's post, a small tag that opens the posts about it.
  if (!SESSION_CARD_KINDS.includes(kind)) {
    const space = postHref.replace(/\/posts\/\d+$/, '')
    return (
      <a
        className={styles.sessionChip}
        href={`${space}?${new URLSearchParams({ session: session.session })}`}
        aria-label={t('sessionChipLabel', { name })}
        dir="auto"
      >
        <Badge size="md" icon={<MessagesSquare size={14} aria-hidden="true" />}>
          {name}
        </Badge>
      </a>
    )
  }
  const readings = (row?.bibliography ?? []).flatMap((m) =>
    m.title ? [m.note ? `${m.title} (${m.note})` : m.title] : [],
  )

  const ai = (
    <div className={styles.sessionAi}>
      <span className="inline-flex items-center gap-1">
        {ts('aiSession')}
        <AIInstructions />
      </span>
      <StudyWithAI
        kind="course"
        path={detailPath('courses', String(course.slug), locale)}
        label={ts('aiSession')}
        size="sm"
        session={{
          course: course.title,
          session: name,
          readings,
        }}
      />
    </div>
  )

  return (
    <CourseSession
      course={course}
      sessions={oldSyllabus(course)}
      session={session.session}
      label={t('sessionLabel')}
      footer={ai}
    />
  )
}
