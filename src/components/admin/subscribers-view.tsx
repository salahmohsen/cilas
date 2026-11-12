import Link from 'next/link'
import type { AdminViewServerProps, Payload } from 'payload'

import { isAdminUser } from '@/access'
import { Alert } from '@/components/arc/alert/alert'
import { MetricCard } from '@/components/arc/metric-card/metric-card'
import { mailingList, newsletterList, type ListTarget } from '@/lib/newsletter-list'
import {
  accountContactCount,
  CONTACT_WARN_AT,
  FREE_CONTACT_LIMIT,
  listContacts,
  type Contact,
} from '@/lib/resend-contacts'

import { adminLanguage, ArcAdminView } from './arc-admin-view'
import { ContactsMeter } from './contacts-meter'
import { subscribersCopy } from './subscribers-copy'
import { SubscribersTable } from './subscribers-table'
import styles from './subscribers.module.css'

async function Subscribers({
  payload,
  asked,
  ar,
}: {
  payload: Payload
  /** The Mailing list in `?list=`; without it, the signup list. */
  asked: number
  ar: boolean
}) {
  const t = subscribersCopy(ar)
  const { docs: lists } = await payload.find({
    collection: 'mailing-lists',
    sort: 'name',
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const list: ListTarget | null = asked
    ? await mailingList(payload, asked)
    : await newsletterList(payload)
  const switcher = lists.length > 1 && (
    <nav aria-label={t.lists} className={styles.lists}>
      {lists.map((l) => (
        <Link
          aria-current={l.id === list?.id ? 'page' : undefined}
          href={`/admin/subscribers?list=${l.id}`}
          key={l.id}
          dir="auto"
        >
          {l.name}
        </Link>
      ))}
    </nav>
  )
  if (!list)
    return (
      <>
        {switcher}
        <Alert tone="info" title={t.offTitle}>
          {t.offBody}
        </Alert>
      </>
    )

  let contacts: Contact[]
  let stored: number | null
  try {
    ;[contacts, stored] = await Promise.all([listContacts(list.segmentId), accountContactCount()])
  } catch (error) {
    return (
      <Alert tone="danger" title={t.errorTitle}>
        {(error as Error).message}
      </Alert>
    )
  }

  const subscribed = contacts.filter((c) => !c.unsubscribed).length
  const total = stored ?? contacts.length
  return (
    <>
      <p className={styles.intro}>
        {list.source === 'members' ? t.membersList(list.name) : t.signupList(list.name)}{' '}
        {t.livesInResend}
      </p>
      {switcher}
      <div className={styles.metrics}>
        <MetricCard label={t.subscribed} value={subscribed} context={t.subscribedContext} />
        <MetricCard
          label={t.unsubscribed}
          value={contacts.length - subscribed}
          context={t.unsubscribedContext}
        />
      </div>
      <ContactsMeter total={total} ar={ar} />
      {total >= FREE_CONTACT_LIMIT * CONTACT_WARN_AT ? (
        <Alert tone="warning" title={t.nearTitle}>
          {t.nearBody(FREE_CONTACT_LIMIT)}
        </Alert>
      ) : null}
      <SubscribersTable contacts={contacts} list={list.id} ar={ar} />
    </>
  )
}

/**
 * Admin → Subscribers: the newsletter list, read live from Resend (ADR 0005),
 * with the free plan's contact limit and CSV exports for Mailchimp.
 */
export function SubscribersView(view: AdminViewServerProps) {
  const req = view.initPageResult.req
  const language = adminLanguage(req)
  const ar = language === 'ar'
  const asked = Number(new URLSearchParams(view.searchParams as Record<string, string>).get('list'))
  return (
    <ArcAdminView
      view={view}
      language={language}
      title={subscribersCopy(ar).title}
      allowed={isAdminUser(view.user)}
    >
      <Subscribers payload={req.payload} asked={asked} ar={ar} />
    </ArcAdminView>
  )
}
