import { Gutter } from '@payloadcms/ui'
import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'

import { isAdminUser } from '@/access'
import { LIST_OFF, newsletterList } from '@/lib/newsletter-list'
import { accountContactCount, FREE_CONTACT_LIMIT, listContacts, type Contact } from '@/lib/resend-contacts'

import { SubscribersTable } from './subscribers-table'

const box = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '6px',
  padding: '16px',
} as const

/**
 * Admin → Subscribers: the newsletter list, read live from Resend (ADR 0005),
 * with the free plan's contact limit and CSV exports for Mailchimp.
 */
export async function SubscribersView({ initPageResult, params, searchParams, user }: AdminViewServerProps) {
  const template = (children: React.ReactNode) => (
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
        <h1 style={{ margin: '24px 0 8px' }}>Subscribers</h1>
        {children}
      </Gutter>
    </DefaultTemplate>
  )

  // Custom views are not protected by Payload's access rules.
  if (!isAdminUser(user)) return template(<p>Only admins can see the newsletter list.</p>)
  const list = await newsletterList(initPageResult.req.payload)
  if (!list) return template(<p>{LIST_OFF}</p>)

  let contacts: Contact[]
  let stored: number | null
  try {
    ;[contacts, stored] = await Promise.all([
      listContacts(list.apiKey, list.segmentId),
      accountContactCount(list.apiKey),
    ])
  } catch (error) {
    return template(<p>Resend did not answer: {(error as Error).message}</p>)
  }

  const subscribed = contacts.filter((c) => !c.unsubscribed).length
  const total = stored ?? contacts.length
  const share = Math.min(100, Math.round((total / FREE_CONTACT_LIMIT) * 100))
  const near = total >= FREE_CONTACT_LIMIT * 0.9

  return template(
    <>
      <p style={{ color: 'var(--theme-elevation-500)', marginTop: 0 }}>
        The list lives in Resend; people unsubscribe from the link in each newsletter.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', margin: '20px 0' }}>
        <div style={box}>
          <div style={{ fontSize: '28px', fontWeight: 600 }}>{subscribed}</div>
          <div>Subscribed</div>
        </div>
        <div style={box}>
          <div style={{ fontSize: '28px', fontWeight: 600 }}>{contacts.length - subscribed}</div>
          <div>Unsubscribed</div>
        </div>
        <div style={box}>
          <div style={{ fontSize: '28px', fontWeight: 600 }}>
            {total} / {FREE_CONTACT_LIMIT}
          </div>
          <div>Contacts stored, of the free plan’s limit</div>
          <div
            role="meter"
            aria-label="Contacts stored, of the free plan's limit"
            aria-valuemin={0}
            aria-valuemax={FREE_CONTACT_LIMIT}
            aria-valuenow={total}
            style={{ height: '6px', borderRadius: '3px', background: 'var(--theme-elevation-100)', marginTop: '10px' }}
          >
            <div
              style={{
                width: `${share}%`,
                height: '100%',
                borderRadius: '3px',
                background: near ? 'var(--theme-warning-500, #d97706)' : 'var(--theme-success-500, #16a34a)',
              }}
            />
          </div>
        </div>
      </div>
      {near ? (
        <p style={{ ...box, borderColor: 'var(--theme-warning-500, #d97706)' }}>
          Near the free plan’s limit. Above {FREE_CONTACT_LIMIT} stored contacts Resend refuses to send newsletters
          until the plan is upgraded. You can delete long-unsubscribed contacts in Resend, or export the list to
          Mailchimp.
        </p>
      ) : null}
      <SubscribersTable contacts={contacts} />
    </>,
  )
}
