import { CilasLogo } from '@/components/cilas-logo'

/**
 * The CILAS mark for Payload's own logo slots (`admin.components.graphics`).
 * Inline SVG in `currentColor`, so it follows the admin's light and dark
 * themes. payload-theme draws the sidebar and login logos itself, from the
 * files in public/assets/admin (see payloadTheme() in src/payload.config.ts).
 */
export function AdminLogo() {
  return (
    <span
      role="img"
      aria-label="CILAS admin"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: 'var(--theme-text)',
      }}
    >
      <CilasLogo style={{ height: '3.5rem', width: 'auto' }} />
      <span style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '0.08em' }}>CILAS</span>
    </span>
  )
}

/** The small mark, for the spots that show an icon only. */
export function AdminIcon() {
  return (
    <span
      role="img"
      aria-label="CILAS"
      style={{ display: 'inline-flex', color: 'var(--theme-text)' }}
    >
      <CilasLogo style={{ height: '1.5rem', width: 'auto' }} />
    </span>
  )
}
