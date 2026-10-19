import { Button } from '@payloadcms/ui'

const muted = { color: 'var(--theme-elevation-600)', margin: 0, lineHeight: 1.6 } as const

/** Email settings → Newsletter: who newsletters go to is set in Mailing lists now. */
export function MailingListsNote() {
  return (
    <div
      style={{
        display: 'grid',
        gap: '12px',
        maxWidth: '640px',
        margin: '8px 0 24px',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '6px',
        padding: '20px',
      }}
    >
      <h3 style={{ margin: 0 }}>Mailing lists</h3>
      <p style={muted}>Who newsletters go to is set in Mailing lists, not here.</p>
      <ul style={{ ...muted, display: 'grid', gap: '4px', paddingInlineStart: '20px' }}>
        <li>The signup list: people who join from the site’s forms.</li>
        <li>Synced lists: CILAS accounts picked by role, course, programme or by name.</li>
        <li>Each newsletter picks its list in “Send to”.</li>
      </ul>
      <p style={muted}>The Resend API key stays a server setting (RESEND_API_KEY), as it is a secret.</p>
      <div>
        <Button buttonStyle="secondary" el="link" margin={false} url="/admin/collections/mailing-lists">
          Open Mailing lists
        </Button>
      </div>
    </div>
  )
}
