import type { AdminViewServerProps } from 'payload'

import { isAdminUser } from '@/access'
import { INVITATION_DAYS } from '@/lib/invitation'

import { adminLanguage, ArcAdminView } from './arc-admin-view'
import { inviteCopy } from './invite-copy'
import { InviteForm } from './invite-form'
import styles from './invite.module.css'

/** Admin → Invite someone: a new account that sets its own password. */
export function InviteView(view: AdminViewServerProps) {
  const language = adminLanguage(view.initPageResult.req)
  const ar = language === 'ar'
  const t = inviteCopy(ar)
  return (
    <ArcAdminView view={view} language={language} title={t.title} allowed={isAdminUser(view.user)}>
      <p className={styles.intro}>{t.intro(INVITATION_DAYS)}</p>
      <InviteForm ar={ar} />
    </ArcAdminView>
  )
}
