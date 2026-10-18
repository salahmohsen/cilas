import type { PayloadRequest } from 'payload'
import { OAuth2Plugin } from 'payload-oauth2'

import { env } from '@/env'
import { safeNext } from '@/lib/safe-next'

/**
 * "Continue with Google" for existing accounts. Google proves the email; the
 * account with that email signs in through Payload's own cookie, so the admin
 * panel and the site see the same user. Nobody gets an account by signing in:
 * an email with no account is refused.
 *
 * `users.sub` is declared on the collection itself, so the schema does not
 * change with the env: without Google credentials the plugin is simply off.
 */

/** Google sends back the `state` the login link sent: the page to return to. */
const nextOf = (req: PayloadRequest) => safeNext(req.searchParams.get('state'))

/**
 * Only the email and Google's id reach the account. The plugin writes whatever
 * this returns onto the user, so nothing else (no name, no picture) is passed.
 */
const getUserInfo = async (accessToken: string) => {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Google userinfo failed: ${res.status}`)
  const info = (await res.json()) as { email?: string; email_verified?: boolean; sub?: string }
  // An unverified address could belong to someone else's account here.
  if (!info.email || info.email_verified !== true || !info.sub) {
    throw new Error('Google did not return a verified email')
  }
  return { email: info.email.toLowerCase(), sub: info.sub }
}

export const googleAuth = () =>
  OAuth2Plugin({
    enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    strategyName: 'google',
    useEmailAsIdentity: true,
    onUserNotFoundBehavior: 'error',
    serverURL: env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, ''),
    clientId: env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
    authCollection: 'users',
    // GET /api/users/oauth/google?state=/en/articles → Google → callback.
    authorizePath: '/oauth/google',
    callbackPath: '/oauth/google/callback',
    providerAuthorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: ['openid', 'email'],
    prompt: 'select_account',
    pkceEnabled: true,
    getUserInfo,
    successRedirect: (req) => nextOf(req),
    failureRedirect: (req, error) => {
      req.payload.logger.warn({ err: error }, 'Google sign-in refused')
      return `/login?error=google&next=${encodeURIComponent(nextOf(req))}`
    },
  })
