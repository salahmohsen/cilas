import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps, PayloadRequest } from 'payload'
import type { ReactNode } from 'react'

import './dashboard/arc-scope.css'
import styles from './arc-admin-view.module.css'

export type AdminLanguage = 'ar' | 'en'

/** The language of the admin's own interface: Arabic, or else English. */
export const adminLanguage = (req: PayloadRequest): AdminLanguage =>
  req.i18n.language === 'ar' ? 'ar' : 'en'

const DENIED: Record<AdminLanguage, string> = {
  ar: 'ليس لديك إذن لعرض هذه الصفحة.',
  en: 'You do not have access to this page.',
}

/**
 * The frame of every custom admin view built with Arc: Payload's template,
 * the scoped Arc tokens, the page direction and one heading. Payload's access
 * rules do not protect custom views, so each view says who may see it, and
 * the frame renders `children` only for them. Keep data loading inside
 * `children` (an async component), so it never runs for anyone else.
 */
export function ArcAdminView({
  view,
  language,
  title,
  allowed,
  children,
}: {
  view: AdminViewServerProps
  language: AdminLanguage
  title: string
  allowed: boolean
  children: ReactNode
}) {
  const { initPageResult, params, searchParams, user } = view
  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div
          className={`arc-scope ${styles.page}`}
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          lang={language}
        >
          <h1>{title}</h1>
          {allowed ? children : <p className={styles.denied}>{DENIED[language]}</p>}
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}
