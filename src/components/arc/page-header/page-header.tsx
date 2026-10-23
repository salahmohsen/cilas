import type { ReactNode } from 'react'
import Link from 'next/link'

import { AvatarGroup } from '../avatar-group/avatar-group'
import { Badge } from '../badge/badge'
import { Breadcrumb } from '../breadcrumb/breadcrumb'
import { Progress } from '../progress/progress'
import { Fold } from './fold'
import styles from './page-header.module.css'

export type PageHeaderProps = {
  breadcrumb: { label: string; href?: string }[]
  badge?: { text: string; tone?: 'success' | 'muted' }
  title: string
  members?: { name: string; src?: string | null }[]
  progress?: { done: number; total: number; label?: string }
  tabs?: { key: string; label: string; count?: number }[]
  activeTab?: string
  actions?: ReactNode
  /** The tabs row navigates routes, so it renders as links; callers name it. */
  tabsLabel?: string
  /** The accessible name of the members row, for translated pages. */
  membersLabel?: string
  className?: string
}

/**
 * Spec §2: the space header. Two rows: crumbs, badge and the space's own
 * actions; then title, members, the checklist progress, and the space's
 * routes as links (`aria-current="page"`). `<Fold>` marks `folded` past
 * 12px of scroll and the module carries both variants. The tab row uses
 * links rather than Arc's panel-swapping `tabs`: these routes are pages.
 */
export function PageHeader({
  breadcrumb,
  badge,
  title,
  members,
  progress,
  tabs,
  activeTab,
  actions,
  tabsLabel,
  membersLabel,
  className,
}: PageHeaderProps) {
  return (
    <Fold className={[styles.header, className].filter(Boolean).join(' ')}>
      <div className={styles.top}>
        <Breadcrumb items={breadcrumb} />
        <div className={styles.topEnd}>
          {badge && (
            <Badge tone={badge.tone === 'success' ? 'success' : 'neutral'}>{badge.text}</Badge>
          )}
          {actions}
        </div>
      </div>
      <div className={styles.foldable}>
        <div className={styles.foldableInner}>
          <div className={styles.main}>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.meta}>
              {members && members.length > 0 && (
                <AvatarGroup
                  members={members.map((m) => ({ name: m.name, src: m.src ?? undefined }))}
                  label={membersLabel}
                />
              )}
              {progress && progress.total > 0 && (
                <div className={styles.progress}>
                  <Progress value={progress.done} max={progress.total} label={progress.label} />
                  <span className={styles.progressLabel}>
                    {progress.label
                      ? `${progress.done}/${progress.total} ${progress.label}`
                      : `${progress.done}/${progress.total}`}
                  </span>
                </div>
              )}
            </div>
          </div>
          {tabs && tabs.length > 0 && (
            <nav className={styles.tabs} aria-label={tabsLabel ?? 'Sections'}>
              {tabs.map((t) => (
                <Link
                  key={t.key}
                  href={t.key}
                  aria-current={activeTab === t.key ? 'page' : undefined}
                  className={styles.tab}
                >
                  {t.label}
                  {t.count != null && <span className={styles.tabCount}>{t.count}</span>}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </Fold>
  )
}
