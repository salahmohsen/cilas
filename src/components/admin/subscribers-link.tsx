import Link from 'next/link'

/**
 * Above the Newsletters list: the way to Admin → Subscribers (the theme's
 * sidebar has no place for custom links).
 */
export function SubscribersLink() {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '6px',
        padding: '12px 16px',
        margin: '0 0 16px',
      }}
    >
      <span>The people who receive the newsletter live in Resend.</span>
      <Link href="/admin/subscribers" style={{ fontWeight: 600 }}>
        Subscribers and CSV export →
      </Link>
    </div>
  )
}
