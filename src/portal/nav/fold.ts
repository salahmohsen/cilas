/** The cookie that keeps an account's sidebar folded; the server reads it, so the first paint is right. */
export const foldCookie = (accountId: number): string => `portal-folded-${accountId}`

/** Folds or unfolds the sidebar for this account on this device (client only). */
export const writeFold = (accountId: number, folded: boolean): void => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const life = folded ? 'Max-Age=31536000' : 'Max-Age=0'
  document.cookie = `${foldCookie(accountId)}=1; Path=/; ${life}; SameSite=Lax${secure}`
}

/** The id of the portal nav, which the fold button controls. A page has one shell. */
export const PORTAL_NAV_ID = 'portal-nav'
