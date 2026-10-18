/**
 * Colors, type and spacing for CILAS's emails, from React Email's MIT
 * "Barebone" demo (github.com/resend/react-email, apps/demo/emails/01-Barebone),
 * as inline styles: mail clients drop most stylesheets.
 */
export const colors = {
  bg: '#FFFFFF',
  bg2: '#F3F4F6',
  fg: '#14171E',
  fg2: '#43454B',
  fg3: '#7B7D81',
  stroke: '#E4E4E7',
} as const

export const font = "Inter, 'IBM Plex Sans Arabic', system-ui, Arial, sans-serif"

export const type = {
  small: { fontSize: '13px', lineHeight: '1.5', color: colors.fg3 },
  body: { fontSize: '16px', lineHeight: '1.6', color: colors.fg2 },
  title: { fontSize: '20px', lineHeight: '1.3', fontWeight: 600, color: colors.fg },
  heading: { fontSize: '28px', lineHeight: '1.25', fontWeight: 600, color: colors.fg },
} as const

export const button = (accent: string) =>
  ({
    backgroundColor: accent,
    color: '#FFFFFF',
    borderRadius: '6px',
    padding: '12px 22px',
    fontSize: '15px',
    fontWeight: 500,
    textDecoration: 'none',
    display: 'inline-block',
  }) as const
