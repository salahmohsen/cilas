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

/** Barebone's type scale: size, weight, tracking and leading together. */
export const type = {
  11: {
    fontSize: '11px',
    fontWeight: 420,
    letterSpacing: '-0.033px',
    lineHeight: '1.5',
    color: colors.fg3,
  },
  13: {
    fontSize: '13px',
    fontWeight: 420,
    letterSpacing: '-0.039px',
    lineHeight: '1.5',
    color: colors.fg3,
  },
  16: {
    fontSize: '16px',
    fontWeight: 420,
    letterSpacing: '-0.048px',
    lineHeight: '1.5',
    color: colors.fg2,
  },
  20: {
    fontSize: '20px',
    fontWeight: 600,
    letterSpacing: '-0.06px',
    lineHeight: '1.3',
    color: colors.fg,
  },
  28: {
    fontSize: '28px',
    fontWeight: 600,
    letterSpacing: '-0.084px',
    lineHeight: '1.3',
    color: colors.fg,
  },
  32: {
    fontSize: '32px',
    fontWeight: 600,
    letterSpacing: '-0.64px',
    lineHeight: '1.25',
    color: colors.fg,
  },
} as const

/**
 * Links as the site draws them: the text's own colour, underlined in a light
 * tint of it, a little below the line — never the mail app's default blue.
 */
export const link = {
  color: colors.fg,
  textDecoration: 'underline',
  textDecorationColor: '#C4C5C9',
  textUnderlineOffset: '3px',
} as const

/** The same, as a style attribute for links inside converted rich text. */
export const linkCss =
  'color:#14171E;text-decoration:underline;text-decoration-color:#C4C5C9;text-underline-offset:3px'

export const button = (accent: string) =>
  ({
    backgroundColor: accent,
    color: '#FFFFFF',
    borderRadius: '8px',
    padding: '16px 28px',
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 500,
    textDecoration: 'none',
    display: 'inline-block',
  }) as const

/**
 * Narrow screens. Gmail, Apple Mail and Outlook apps read this from the head;
 * the rest get the desktop layout, which still fits at 640 px.
 */
export const mobileCss = `
@media (max-width: 600px) {
  .m-container { margin-top: 0 !important; }
  .m-frame { padding-left: 8px !important; padding-right: 8px !important; }
  .m-box { padding: 40px 16px !important; margin-bottom: 8px !important; }
  .m-col { display: block !important; width: 100% !important; max-width: 100% !important; padding: 0 0 24px 0 !important; }
  .m-img { max-width: 100% !important; }
}`
