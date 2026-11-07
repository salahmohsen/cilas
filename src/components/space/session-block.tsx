import { sessionFacts, type SessionFact } from '@/lib/session-refs'
import type { SessionRead } from '@/lib/spaces-data'

import { PostSession } from './post-session'
import type { SessionLinks } from './session-chip'
import styles from './space.module.css'

export function SessionBlock({ id, read }: { id: string; read: SessionRead | null | undefined }) {
  const view =
    read?.state === 'shown'
      ? (read.course.sessions ?? []).some((s) => s.id === id)
        ? ({ state: 'shown', course: read.course, session: id } as const)
        : ({ state: 'gone' } as const)
      : (read ?? ({ state: 'gone' } as const))
  return (
    <div className={styles.sessionBlock}>
      <PostSession session={view} kind="announcement" postHref="" />
    </div>
  )
}

/** The course sessions a space's posts may name, read once for the whole page. */
export type SessionContext = {
  read: SessionRead | null
  facts: Record<string, SessionFact>
}

export const sessionContextOf = (read: SessionRead | null): SessionContext => ({
  read,
  facts: read?.state === 'shown' ? sessionFacts(read.course) : {},
})

/** What one post's body needs to show its sessions; its space page is the route above the post's. */
export const sessionsFor = (
  context: SessionContext | null | undefined,
  postHref: string,
): { links: SessionLinks | null; read: SessionRead | null } => ({
  read: context?.read ?? null,
  links: context?.read
    ? {
        spaceHref: postHref.replace(/\/posts\/\d+$/, ''),
        facts: context.facts,
        known: context.read.state !== 'hidden',
      }
    : null,
})
