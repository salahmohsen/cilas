import { DefaultDashboard } from '@payloadcms/next/views'
import type { DashboardViewServerProps } from '@payloadcms/next/views'
import { Dashboard } from 'payload-theme/rsc'

import { isAdminUser } from '@/access'

import './arc-scope.css'
import styles from './dashboard.module.css'

/**
 * The admin home. Admins get Payload's native modular dashboard (they can
 * drag, resize, add and remove widgets; the layout is saved per account) in
 * our scoped Arc tokens; everyone else keeps the theme's own cards. Custom
 * views skip Payload's access rules, so the role check happens here, before
 * any widget reads with `overrideAccess`.
 */
export async function DashboardView(props: DashboardViewServerProps) {
  const { user } = props.initPageResult.req
  if (!user || !isAdminUser(user)) return <Dashboard {...props} />

  return (
    <div className={`arc-scope ${styles.native}`}>
      <DefaultDashboard {...props} />
    </div>
  )
}
